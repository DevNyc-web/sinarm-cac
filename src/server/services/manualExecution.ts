/**
 * Execucao assistida MANUAL — Fase 7 (docs/21).
 *
 * O QUE ESTE MODULO **NAO** FAZ (limite absoluto, docs/21 §2):
 * nao acessa Gov.br, nao acessa SINARM/CAC, nao automatiza, nao usa navegador,
 * nao protocola, nao clica em "Gerar GRU e Salvar" e nao guarda credencial.
 *
 * O QUE ELE FAZ: registra a **declaracao** do operador humano sobre o que ele
 * fez FORA do app, com trilha auditavel (quem/perfil/quando/de-para/observacao).
 */
import { type ManualExecutionStatus } from "@prisma/client";
import { type AuthUser } from "@/server/auth/mockUsers";
import { MANUAL_EXECUTION_LABELS } from "@/server/processes/statusLabels";
import {
  findManualExecution,
  upsertManualExecution,
} from "@/server/repositories/manualExecutionRepository";
import { recordOperationalEvent } from "@/server/repositories/processEventRepository";
import {
  findProcessByIdForAdmin,
  updateManualExecutionStatus,
} from "@/server/repositories/processRepository";

export const MAX_OBSERVATION_LENGTH = 500;

/** Valor esperado da GRU (docs/09 §15.11) — referencia de conferencia, nao fixacao. */
export const EXPECTED_GRU_CENTS = 2000;

export type ManualResult = { ok: true } | { ok: false; error: string };

const MANUAL_STATUSES: readonly ManualExecutionStatus[] = [
  "EXECUCAO_MANUAL_NAO_INICIADA",
  "GOVBR_ABERTO_PELO_OPERADOR",
  "SINARM_ABERTO_PELO_OPERADOR",
  "FORMULARIO_PREENCHIDO_MANUALMENTE",
  "CHECKPOINT_DADOS_GRU_CONFERIDO",
  "PROTOCOLO_MANUAL_REGISTRADO",
  "GRU_MANUAL_REGISTRADA",
  "AGUARDANDO_PAGAMENTO_GRU_EMPRESA",
  "GRU_PAGA_MANUALMENTE_DEV",
  "BLOQUEADO_OPERACIONALMENTE",
];

export function isManualExecutionStatus(value: string): value is ManualExecutionStatus {
  return (MANUAL_STATUSES as readonly string[]).includes(value);
}

function checkObservation(text: string, required: boolean): string | null {
  const trimmed = text.trim();
  if (required && !trimmed) return null;
  return trimmed.slice(0, MAX_OBSERVATION_LENGTH);
}

/**
 * Avanca a etapa manual. Exige `declaration` — a confirmacao explicita de que a
 * acao foi feita MANUALMENTE, FORA do app (docs/21 §14).
 * Bloqueio operacional exige motivo (docs/21 §9).
 */
export async function advanceManualExecution(
  actor: AuthUser,
  processId: string,
  nextStatus: string,
  observation: string,
  declared: boolean,
): Promise<ManualResult> {
  if (!isManualExecutionStatus(nextStatus)) {
    return { ok: false, error: "Etapa manual invalida." };
  }
  if (!declared) {
    return {
      ok: false,
      error: "Confirme que a acao foi feita manualmente, fora do app.",
    };
  }
  const note = checkObservation(observation, false) ?? undefined;
  if (nextStatus === "BLOQUEADO_OPERACIONALMENTE" && !note) {
    return { ok: false, error: "Informe o motivo do bloqueio operacional." };
  }

  try {
    const process = await findProcessByIdForAdmin(processId, false);
    if (!process) return { ok: false, error: "Processo nao encontrado." };
    if (process.manualExecutionStatus === nextStatus) return { ok: true };

    await updateManualExecutionStatus(processId, nextStatus);
    await recordOperationalEvent({
      processId,
      kind: "EXECUCAO_MANUAL",
      fromValue: MANUAL_EXECUTION_LABELS[process.manualExecutionStatus],
      toValue: MANUAL_EXECUTION_LABELS[nextStatus],
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note: note ? `${note} (registro manual — executado fora do app)` : "registro manual — executado fora do app",
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Nao foi possivel registrar. Verifique o Postgres local." };
  }
}

/**
 * Registra o protocolo que o humano obteve no orgao (ficticio/dev).
 * O app NAO protocolou — apenas guarda o numero digitado por quem executou.
 */
export async function registerManualProtocol(
  actor: AuthUser,
  processId: string,
  protocolNumber: string,
  observation: string,
  declared: boolean,
): Promise<ManualResult> {
  const number = protocolNumber.trim();
  if (!number) return { ok: false, error: "Informe o numero de protocolo (ficticio/dev)." };
  if (number.length > 60) return { ok: false, error: "Numero de protocolo muito longo." };
  if (!declared) {
    return {
      ok: false,
      error: 'Confirme que voce clicou em "Gerar GRU e Salvar" manualmente, fora do app.',
    };
  }

  try {
    const process = await findProcessByIdForAdmin(processId, false);
    if (!process) return { ok: false, error: "Processo nao encontrado." };

    const existing = await findManualExecution(processId);
    if (existing?.protocolNumber) {
      return {
        ok: false,
        error: "Protocolo ja registrado. Correcao se faz por nova nota/retificacao (trilha append-only).",
      };
    }

    const now = new Date();
    await upsertManualExecution(processId, {
      protocolNumber: number,
      protocolObservation: checkObservation(observation, false) || null,
      protocolRegisteredByMockUserId: actor.id,
      protocolRegisteredByRole: actor.role,
      protocolRegisteredAt: now,
    });
    await updateManualExecutionStatus(processId, "PROTOCOLO_MANUAL_REGISTRADO");
    await recordOperationalEvent({
      processId,
      kind: "PROTOCOLO_MANUAL",
      toValue: number,
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note: "protocolo obtido pelo operador fora do app (ficticio/dev)",
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Nao foi possivel registrar o protocolo." };
  }
}

/** Registra os dados da GRU que o humano leu na tela do orgao (ficticios/dev). */
export async function registerManualGru(
  actor: AuthUser,
  processId: string,
  reference: string,
  dueDate: string,
  amountReais: string,
  observation: string,
): Promise<ManualResult> {
  const ref = reference.trim();
  if (!ref) return { ok: false, error: "Informe o numero de referencia da GRU." };

  const due = dueDate ? new Date(dueDate) : null;
  if (!due || Number.isNaN(due.getTime())) {
    return { ok: false, error: "Informe a data de vencimento lida do sistema." };
  }

  const amount = Number(amountReais.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Informe o valor da GRU lido do sistema." };
  }

  try {
    const process = await findProcessByIdForAdmin(processId, false);
    if (!process) return { ok: false, error: "Processo nao encontrado." };

    const existing = await findManualExecution(processId);
    if (!existing?.protocolNumber) {
      return { ok: false, error: "Registre o protocolo antes dos dados da GRU." };
    }

    const amountCents = Math.round(amount * 100);
    await upsertManualExecution(processId, {
      gruReference: ref,
      gruDueDate: due,
      gruAmountCents: amountCents,
      gruObservation: checkObservation(observation, false) || null,
      gruRegisteredByMockUserId: actor.id,
      gruRegisteredByRole: actor.role,
      gruRegisteredAt: new Date(),
    });
    await updateManualExecutionStatus(processId, "AGUARDANDO_PAGAMENTO_GRU_EMPRESA");
    await recordOperationalEvent({
      processId,
      kind: "GRU_MANUAL",
      toValue: `ref ${ref} · R$ ${(amountCents / 100).toFixed(2).replace(".", ",")}`,
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note:
        amountCents === EXPECTED_GRU_CENTS
          ? "dados lidos pelo operador na tela do orgao (ficticio/dev)"
          : "ATENCAO: valor diferente do esperado (R$ 20,00) — conferir",
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Nao foi possivel registrar a GRU." };
  }
}

/**
 * Registra o pagamento da GRU pela EMPRESA (docs/11 §9).
 * Segregacao de funcoes: quem executa o protocolo nao libera o pagamento — a
 * server action exige `payment.gru.register` (ADMIN/FINANCEIRO).
 */
export async function registerManualGruPayment(
  actor: AuthUser,
  processId: string,
  observation: string,
): Promise<ManualResult> {
  try {
    const existing = await findManualExecution(processId);
    if (!existing?.gruReference) {
      return { ok: false, error: "Registre os dados da GRU antes do pagamento." };
    }
    if (existing.gruPaidAt) return { ok: false, error: "Pagamento da GRU ja registrado." };

    await upsertManualExecution(processId, {
      gruPaidAt: new Date(),
      gruPaymentObservation: checkObservation(observation, false) || null,
      gruPaymentRegisteredByMockUserId: actor.id,
      gruPaymentRegisteredByRole: actor.role,
    });
    await updateManualExecutionStatus(processId, "GRU_PAGA_MANUALMENTE_DEV");
    await recordOperationalEvent({
      processId,
      kind: "PAGAMENTO_GRU_MANUAL",
      toValue: "GRU paga (dev)",
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note: "pagamento da GRU registrado manualmente pela empresa (ficticio/dev)",
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Nao foi possivel registrar o pagamento da GRU." };
  }
}
