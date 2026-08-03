/**
 * Caso de uso: registrar CANCELAMENTO REAL de processo — docs/51.
 *
 * POR QUE ESTE SERVICE EXISTE: o PR anterior (docs/51 + migration
 * `20260802000000_add_real_cancellation_status`) preparou o `InternalStatus`
 * `CANCELADO_OPERACIONAL` SEM FLUXO nenhum. Este e o primeiro fluxo que o
 * produz — ainda SEM BOTAO/UI (docs/51 §7, PR 6): so o service/backend.
 *
 * NAO E "mover status": e uma DECISAO IRREVERSIVEL sobre o processo, por isso
 * exige motivo, permissao propria (`process.cancel`) e passa pela porta
 * canonica `transitionInternalStatus`, com evento tipado.
 *
 * RBAC DENTRO DO SERVICE, de proposito — diferente de `reopenDocumentReview`/
 * `approveDocumentOutOfFlow`, que confiam a checagem a server action: este PR
 * NAO cria action nem UI (nao altera `src/app`), entao nao ha camada acima
 * para checar `process.cancel`. Mesmo precedente de `createProcessNote.ts`
 * (que tambem decide a permissao dentro do service, ali por depender da
 * visibilidade). Quando a action existir, ela pode continuar chamando este
 * service sem duplicar a checagem — `hasPermission` e idempotente.
 *
 * NAO MUDA `operationalStatus`: nenhum `alsoSet` e passado a
 * `transitionInternalStatus`. `operationalStatusProjection.ts` NAO tem
 * candidato documentado para `CANCELADO_OPERACIONAL` (fica `undefined`, por
 * decisao do docs/51), e inventar um `alsoSet` aqui seria decidir uma
 * equivalencia que ninguem aprovou. O par `CANCELADO_OPERACIONAL` +
 * `operationalStatus` antigo fica divergente de proposito — `statusDivergence`
 * ja classifica isso como `needs_decision`, exatamente o rotulo certo para "a
 * fila ainda nao sabe o que fazer com isto". Fechar essa divergencia (e
 * decidir reembolso/protocolo/reversao — docs/51 §4 itens 11-13) fica para PR
 * futuro.
 */
import { type InternalStatus } from "@prisma/client";
import { hasPermission } from "@/server/auth/guards";
import { type AuthUser } from "@/server/auth/mockUsers";
import { findProcessByIdForAdmin } from "@/server/repositories/processRepository";
import { transitionInternalStatus } from "./transitionInternalStatus";

/** Curto demais nao e motivo — mesmo espirito de `MAX_NOTE_LENGTH`/`MAX_OBSERVATION_LENGTH`, so que como piso. */
export const MIN_CANCEL_REASON_LENGTH = 10;

export type CancelProcessResult = { ok: true } | { ok: false; error: string };

/**
 * De onde e seguro cancelar de verdade (docs/51 — allowlist minima,
 * recomendacao do PR): estados PRE-automacao/revisao documental (nenhum ato
 * externo ainda) mais o bloqueio decidido por HUMANO (docs/48, reversivel).
 *
 * ALLOWLIST, nao blocklist: todo o resto do enum fica de fora por padrao —
 * automacao Gov.br/SINARM em andamento (docs/51 regra 11), pos-protocolo/
 * terminal (`PROTOCOLADO_GRU_GERADA`, `GRU_PAGA_EMPRESA`, `CONCLUIDO` —
 * irreversivel, decisao futura no docs/51 §4 item 12), os dois ja-terminais
 * (`CANCELADO_REEMBOLSADO`, `CANCELADO_OPERACIONAL` — nunca sobrescrever/
 * recancelar, regras 5/7) e os 2 da Fase 2 (docs/44 §6, sem consumidor real).
 *
 * ponytail: array simples, nao `Record<InternalStatus, boolean>` exaustivo —
 * um Record forcaria mencionar os 15 valores bloqueados aqui, e 3 travas
 * estruturais deste repositorio (`internalStatusStates.test.ts`) provam que
 * NENHUM arquivo de fluxo cita os 2 estados da Fase 2. A classificacao
 * completa dos 21 valores (cancelavel/bloqueado) mora em
 * `tests/unit/services/cancelProcess.test.ts`, testada contra o schema — se o
 * enum ganhar um valor, o teste (nao o compilador) acusa a lacuna.
 */
const CANCELLABLE_INTERNAL_STATUS: readonly InternalStatus[] = [
  "RASCUNHO",
  "AGUARDANDO_PAGAMENTO",
  "PAGO_EM_FILA",
  "DOCUMENTO_RECEBIDO_PARA_ANALISE",
  "DOCUMENTO_VALIDADO",
  "BLOQUEADO_OPERACIONAL",
];

/**
 * Exportada para a UI admin decidir se mostra o botao (docs/53) — SEM
 * reescrever a lista de estados na pagina. O backend continua a autoridade:
 * esconder o botao com esta funcao e so UX, `cancelProcess` valida de novo.
 */
export function isCancellableInternalStatus(status: InternalStatus): boolean {
  return CANCELLABLE_INTERNAL_STATUS.includes(status);
}

export async function cancelProcess(
  actor: AuthUser,
  processId: string,
  reason?: string,
): Promise<CancelProcessResult> {
  // Mesmo contrato de motivo das demais acoes explicitas (docs/50): curto e
  // SEM PII. Piso de tamanho e NOVO aqui — as anteriores so exigiam nao-vazio.
  const motivo = reason?.trim() ?? "";
  if (!motivo) {
    return { ok: false, error: "Informe o motivo do cancelamento." };
  }
  if (motivo.length < MIN_CANCEL_REASON_LENGTH) {
    return {
      ok: false,
      error: `Motivo muito curto (minimo ${MIN_CANCEL_REASON_LENGTH} caracteres).`,
    };
  }

  if (!hasPermission(actor, "process.cancel")) {
    return { ok: false, error: "Seu perfil nao pode cancelar processos (docs/51)." };
  }

  try {
    const process = await findProcessByIdForAdmin(processId, false);
    if (!process) return { ok: false, error: "Processo nao encontrado." };

    // `CANCELADO_DEV` e estado TECNICO/de desenvolvimento (docs/49 §3.5,
    // docs/51 regra 6) — nunca tratado como cancelamento real, mesmo que o
    // internalStatus atual esteja numa faixa cancelavel.
    if (process.operationalStatus === "CANCELADO_DEV") {
      return {
        ok: false,
        error: "Processo marcado como cancelamento de desenvolvimento — nao e cancelamento real.",
      };
    }

    if (!isCancellableInternalStatus(process.internalStatus)) {
      return {
        ok: false,
        error: `Processo nao pode ser cancelado neste estado (${process.internalStatus}).`,
      };
    }

    const transition = await transitionInternalStatus({
      processId,
      toStatus: "CANCELADO_OPERACIONAL",
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note: `Processo cancelado: ${motivo}`,
    });
    if (!transition.ok) return { ok: false, error: transition.error };

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel cancelar o processo. Verifique o Postgres local.",
    };
  }
}
