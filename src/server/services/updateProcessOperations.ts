/**
 * Casos de uso operacionais do painel — Fase 6 (docs/11 §4).
 * Atribuir responsavel, mudar prioridade e mover o status operacional.
 * Cada acao registra evento na trilha append-only (docs/11 §18).
 *
 * As permissoes sao exigidas pelos guards nas server actions; aqui validamos
 * entrada, aplicamos a regra e registramos quem/quando.
 */
import { type OperationalStatus, type ProcessPriority } from "@prisma/client";
import { type AuthUser } from "@/server/auth/mockUsers";
import { INTERNAL_ROLES, type InternalRole } from "@/server/auth/roles";
import { findMockUser } from "@/server/auth/mockUsers";
import {
  OPERATIONAL_STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/server/processes/statusLabels";
import { recordOperationalEvent } from "@/server/repositories/processEventRepository";
import {
  findProcessByIdForAdmin,
  updateProcessOperations,
} from "@/server/repositories/processRepository";
import { transitionInternalStatus } from "@/server/services/transitionInternalStatus";

export type OperationResult = { ok: true } | { ok: false; error: string };

const OPERATIONAL_STATUSES: readonly OperationalStatus[] = [
  "RASCUNHO",
  "DOCUMENTO_ENVIADO",
  "DOCUMENTO_APROVADO",
  "AGUARDANDO_PAGAMENTO",
  "PAGO_EM_FILA",
  "EM_REVISAO_OPERACIONAL",
  "PRONTO_PARA_PROTOCOLO_MANUAL",
  "BLOQUEADO",
  "CANCELADO_DEV",
];

const PRIORITIES: readonly ProcessPriority[] = ["BAIXA", "NORMAL", "ALTA", "URGENTE"];

/**
 * Status operacional -> status visivel ao usuario (docs/11 §11).
 * Mantem as duas visoes sincronizadas para o usuario nunca ver algo divergente.
 */
const USER_FACING_BY_OPERATIONAL: Record<
  OperationalStatus,
  "RECEBIDO" | "PAGAMENTO_CONFIRMADO" | "EM_ANDAMENTO" | "PRECISAMOS_DE_UM_AJUSTE" | "CANCELADO"
> = {
  RASCUNHO: "RECEBIDO",
  DOCUMENTO_ENVIADO: "EM_ANDAMENTO",
  DOCUMENTO_APROVADO: "EM_ANDAMENTO",
  AGUARDANDO_PAGAMENTO: "RECEBIDO",
  PAGO_EM_FILA: "PAGAMENTO_CONFIRMADO",
  EM_REVISAO_OPERACIONAL: "EM_ANDAMENTO",
  PRONTO_PARA_PROTOCOLO_MANUAL: "EM_ANDAMENTO",
  BLOQUEADO: "PRECISAMOS_DE_UM_AJUSTE",
  CANCELADO_DEV: "CANCELADO",
};

export function isOperationalStatus(value: string): value is OperationalStatus {
  return (OPERATIONAL_STATUSES as readonly string[]).includes(value);
}

export function isPriority(value: string): value is ProcessPriority {
  return (PRIORITIES as readonly string[]).includes(value);
}

/** Responsaveis possiveis: usuarios MOCK de perfil interno (docs/11 §4). */
export function assignableMockUsers() {
  return INTERNAL_ROLES.flatMap((role: InternalRole) => {
    const user = [
      "mock-admin",
      "mock-operador",
      "mock-financeiro",
      "mock-suporte",
    ]
      .map(findMockUser)
      .find((candidate) => candidate?.role === role);
    return user ? [user] : [];
  });
}

export async function assignProcess(
  actor: AuthUser,
  processId: string,
  assigneeId: string | null,
): Promise<OperationResult> {
  const assignee = assigneeId ? findMockUser(assigneeId) : null;
  if (assigneeId && !assignee) return { ok: false, error: "Responsavel invalido." };
  if (assignee && assignee.role === "USER") {
    return { ok: false, error: "Responsavel deve ser um perfil interno." };
  }

  try {
    const process = await findProcessByIdForAdmin(processId, false);
    if (!process) return { ok: false, error: "Processo nao encontrado." };

    const current = process.assignedToMockUserId
      ? (findMockUser(process.assignedToMockUserId)?.name ?? process.assignedToMockUserId)
      : "sem responsavel";

    await updateProcessOperations(processId, { assignedToMockUserId: assignee?.id ?? null });
    await recordOperationalEvent({
      processId,
      kind: "RESPONSAVEL",
      fromValue: current,
      toValue: assignee ? assignee.name : "sem responsavel",
      actorMockUserId: actor.id,
      actorRole: actor.role,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Nao foi possivel atribuir. Verifique o Postgres local." };
  }
}

export async function changePriority(
  actor: AuthUser,
  processId: string,
  priority: string,
): Promise<OperationResult> {
  if (!isPriority(priority)) return { ok: false, error: "Prioridade invalida." };

  try {
    const process = await findProcessByIdForAdmin(processId, false);
    if (!process) return { ok: false, error: "Processo nao encontrado." };
    if (process.priority === priority) return { ok: true };

    await updateProcessOperations(processId, { priority });
    await recordOperationalEvent({
      processId,
      kind: "PRIORIDADE",
      fromValue: PRIORITY_LABELS[process.priority],
      toValue: PRIORITY_LABELS[priority],
      actorMockUserId: actor.id,
      actorRole: actor.role,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Nao foi possivel alterar a prioridade." };
  }
}

export async function changeOperationalStatus(
  actor: AuthUser,
  processId: string,
  status: string,
): Promise<OperationResult> {
  if (!isOperationalStatus(status)) return { ok: false, error: "Status operacional invalido." };

  try {
    const process = await findProcessByIdForAdmin(processId, false);
    if (!process) return { ok: false, error: "Processo nao encontrado." };
    if (process.operationalStatus === status) return { ok: true };

    // Quatro dos nove valores passam pela porta canonica aqui: os 3 com
    // InternalStatus homonimo (Fase 5g, docs/46 §3.5) e `BLOQUEADO`, que ganhou
    // categoria propria — `BLOQUEADO_OPERACIONAL`, docs/48 — e ja migrou no
    // fluxo natural (rejeicao de `reviewProcessDocument`).
    //
    // Os outros 5 continuam no caminho legado abaixo. DOCUMENTO_ENVIADO e
    // DOCUMENTO_APROVADO TEM candidato canonico nos fluxos naturais
    // (uploadProcessDocument/reviewProcessDocument), mas esta porta e
    // MANUAL/admin e sem validacao de maquina de transicoes: mover o
    // internalStatus aqui poderia retroceder uma jornada ja avancada por um
    // fluxo real, sem a checagem que so aquele fluxo faz. Os outros tres
    // (EM_REVISAO_OPERACIONAL, PRONTO_PARA_PROTOCOLO_MANUAL, CANCELADO_DEV)
    // permanecem so operacionais por decisao do docs/47 §9 — nao ha candidato
    // para eles, nem havera.
    //
    // Ramos LITERAIS de proposito, nao uma tabela `status -> toStatus`: uma
    // tabela seria exatamente o mapa `operationalStatus -> internalStatus` que
    // docs/46 §11 proibe. A repeticao aqui e o que impede o atalho.
    if (status === "RASCUNHO") {
      const result = await transitionInternalStatus({
        processId,
        toStatus: "RASCUNHO",
        actorMockUserId: actor.id,
        actorRole: actor.role,
        alsoSet: { operationalStatus: "RASCUNHO", userFacingStatus: "RECEBIDO" },
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (status === "AGUARDANDO_PAGAMENTO") {
      const result = await transitionInternalStatus({
        processId,
        toStatus: "AGUARDANDO_PAGAMENTO",
        actorMockUserId: actor.id,
        actorRole: actor.role,
        alsoSet: { operationalStatus: "AGUARDANDO_PAGAMENTO", userFacingStatus: "RECEBIDO" },
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (status === "PAGO_EM_FILA") {
      const result = await transitionInternalStatus({
        processId,
        toStatus: "PAGO_EM_FILA",
        actorMockUserId: actor.id,
        actorRole: actor.role,
        alsoSet: { operationalStatus: "PAGO_EM_FILA", userFacingStatus: "PAGAMENTO_CONFIRMADO" },
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (status === "BLOQUEADO") {
      // Bloqueio decidido por HUMANO, igual ao da rejeicao de documento — a
      // causa nao e apurada pelo sistema. CONTINUA PROIBIDO usar
      // `BLOQUEADO_INSTABILIDADE` ou qualquer `EXCECAO_*` (docs/46 §3.4).
      //
      // Sem `note`: o dropdown do admin nao coleta motivo hoje, e inventar um
      // texto fixo aqui afirmaria mais do que se sabe. Tornar o motivo
      // obrigatorio nesta porta e decisao de produto, fora deste PR (docs/48 §5).
      const result = await transitionInternalStatus({
        processId,
        toStatus: "BLOQUEADO_OPERACIONAL",
        actorMockUserId: actor.id,
        actorRole: actor.role,
        alsoSet: {
          operationalStatus: "BLOQUEADO",
          userFacingStatus: "PRECISAMOS_DE_UM_AJUSTE",
        },
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }

    await updateProcessOperations(processId, {
      operationalStatus: status,
      // Mantem a visao do usuario coerente com a operacao (docs/11 §11).
      userFacingStatus: USER_FACING_BY_OPERATIONAL[status],
    });
    await recordOperationalEvent({
      processId,
      kind: "STATUS_OPERACIONAL",
      fromValue: OPERATIONAL_STATUS_LABELS[process.operationalStatus],
      toValue: OPERATIONAL_STATUS_LABELS[status],
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note:
        status === "PRONTO_PARA_PROTOCOLO_MANUAL"
          ? "Protocolo e MANUAL, fora do app (nada foi protocolado)"
          : undefined,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Nao foi possivel mudar o status operacional." };
  }
}
