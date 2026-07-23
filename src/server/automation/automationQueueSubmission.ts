/**
 * Envio para a FILA DE AUTOMACAO — regra de elegibilidade (dominio puro).
 *
 * Este e o "gate interno": o ato de LIBERAR um processo pronto para a automacao
 * FUTURA. NAO executa automacao, NAO acessa Gov.br/SINARM, NAO cria robo, NAO
 * protocola, NAO gera GRU. Apenas decide se o envio pode acontecer e marca o
 * processo na trilha append-only ja existente.
 *
 * DECISAO DE MODELAGEM (sem migration): o envio e registrado como um EVENTO na
 * trilha `process_status_events` (kind NOTA), com um MARCADOR estavel em
 * `toValue`. "Ja enviado" e derivado por match exato desse marcador — sem coluna
 * nova, sem estado que envelhece, e consultavel na fila e no historico.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */
import { type AutomationReadiness } from "./automationReadiness";

/**
 * Marcador gravado em `toValue` do evento de envio. Valor SENTINELA estavel
 * (nunca texto livre) para deteccao por igualdade exata — sem PII.
 */
export const AUTOMATION_QUEUE_SUBMISSION_MARKER = "ENVIADO_PARA_FILA_AUTOMACAO";

/** Observacao fixa gravada no evento — deixa claro que nada foi executado. */
export const AUTOMATION_QUEUE_SUBMISSION_NOTE =
  "Processo enviado para a fila de automacao futura. Nenhuma automacao foi executada nesta etapa.";

export const SUBMISSION_REJECTIONS = [
  "SEM_CONFIRMACAO",
  "JA_ENVIADO",
  "NAO_PRONTO",
] as const;

export type SubmissionRejection = (typeof SUBMISSION_REJECTIONS)[number];

export const SUBMISSION_REJECTION_MESSAGES: Record<SubmissionRejection, string> = {
  SEM_CONFIRMACAO: "Marque a confirmação para enviar o processo à fila de automação.",
  JA_ENVIADO: "Este processo já foi enviado para a fila de automação.",
  NAO_PRONTO:
    "O processo ainda não está pronto para automação. Resolva os bloqueios do checklist pré-execução antes de enviar.",
};

export type EligibilityResult =
  | { ok: true }
  | { ok: false; reason: SubmissionRejection; error: string };

function reject(reason: SubmissionRejection): EligibilityResult {
  return { ok: false, reason, error: SUBMISSION_REJECTION_MESSAGES[reason] };
}

/**
 * Decide se o processo PODE ser enviado para a fila de automacao.
 *
 * Exige, nesta ordem: confirmacao humana explicita; nao ter sido enviado antes
 * (idempotencia — evita evento duplicado); e o checklist em
 * PRONTO_PARA_AUTOMACAO. `readiness` DEVE vir regenerado no servidor — nunca do
 * cliente (ver `submitToAutomationQueue`).
 */
export function checkAutomationQueueEligibility(
  readiness: AutomationReadiness,
  confirmed: boolean,
  alreadySubmitted: boolean,
): EligibilityResult {
  if (!confirmed) return reject("SEM_CONFIRMACAO");
  if (alreadySubmitted) return reject("JA_ENVIADO");
  if (readiness.status !== "PRONTO_PARA_AUTOMACAO") return reject("NAO_PRONTO");
  return { ok: true };
}

/**
 * `true` se a trilha ja contem o evento de envio (match exato do marcador).
 * Fonte unica de verdade para "ja enviado" — usada pela fila e pelo gate.
 */
export function wasSubmittedToAutomationQueue(
  events: ReadonlyArray<{ toValue: string | null }>,
): boolean {
  return events.some((event) => event.toValue === AUTOMATION_QUEUE_SUBMISSION_MARKER);
}
