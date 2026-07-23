/**
 * Caso de uso: ENVIAR um processo pronto para a FILA DE AUTOMACAO (gate interno).
 *
 * Principios (docs/25 + regras de fase):
 * - So um processo com checklist PRONTO_PARA_AUTOMACAO pode ser enviado. A
 *   prontidao e REGENERADA NO SERVIDOR aqui — o cliente nunca informa readiness.
 * - Exige confirmacao humana explicita; sem ela, nada e alterado nem registrado.
 * - Idempotente: um processo ja enviado nao gera evento duplicado.
 * - NAO executa automacao, NAO acessa Gov.br/SINARM, NAO cria robo/Playwright,
 *   NAO chama API externa, NAO protocola, NAO gera GRU, NAO toca pagamento.
 * - O envio e registrado na trilha append-only existente (kind NOTA + marcador).
 */
import { type AuthUser } from "@/server/auth/mockUsers";
import {
  deriveAutomationReadiness,
  type AutomationReadiness,
} from "@/server/automation/automationReadiness";
import { snapshotFromRow } from "@/server/automation/automationReadinessInput";
import {
  AUTOMATION_QUEUE_SUBMISSION_MARKER,
  AUTOMATION_QUEUE_SUBMISSION_NOTE,
  checkAutomationQueueEligibility,
  wasSubmittedToAutomationQueue,
} from "@/server/automation/automationQueueSubmission";
import { recordOperationalEvent } from "@/server/repositories/processEventRepository";
import { findProcessForAutomationReadiness } from "@/server/repositories/processRepository";

export type ProcessReadinessState =
  | { found: false }
  | { found: true; readiness: AutomationReadiness; alreadySubmitted: boolean };

/**
 * Le o processo e DERIVA a prontidao no servidor (fonte da verdade). Usado pelo
 * gate e pela tela do detalhe para mostrar/ocultar o botao — nunca confia em
 * readiness vindo do cliente.
 */
export async function getProcessReadinessState(
  processId: string,
): Promise<ProcessReadinessState> {
  const row = await findProcessForAutomationReadiness(processId);
  if (!row) return { found: false };

  const readiness = deriveAutomationReadiness(snapshotFromRow(row));
  const alreadySubmitted = wasSubmittedToAutomationQueue(row.statusEvents);
  return { found: true, readiness, alreadySubmitted };
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

/**
 * Gate de envio para a fila de automacao. A elegibilidade (confirmacao +
 * nao-duplicidade + PRONTO) e checada ANTES de gravar qualquer coisa — o evento
 * append-only so e registrado depois de aprovada.
 */
export async function submitToAutomationQueue(
  actor: AuthUser,
  processId: string,
  /** Marcacao explicita do operador na tela — sem ela nada acontece. */
  confirmed: boolean,
): Promise<SubmitResult> {
  try {
    const state = await getProcessReadinessState(processId);
    if (!state.found) return { ok: false, error: "Processo não encontrado." };

    const eligibility = checkAutomationQueueEligibility(
      state.readiness,
      confirmed,
      state.alreadySubmitted,
    );
    if (!eligibility.ok) return { ok: false, error: eligibility.error };

    // Trilha append-only (docs/11 §18), SO depois de aprovada a elegibilidade.
    // Nenhum status e alterado; o marcador em `toValue` torna o envio consultavel.
    await recordOperationalEvent({
      processId,
      kind: "NOTA",
      toValue: AUTOMATION_QUEUE_SUBMISSION_MARKER,
      actorMockUserId: actor.id,
      actorRole: actor.role,
      note: AUTOMATION_QUEUE_SUBMISSION_NOTE,
    });

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Não foi possível enviar para a fila de automação. Verifique o Postgres local.",
    };
  }
}
