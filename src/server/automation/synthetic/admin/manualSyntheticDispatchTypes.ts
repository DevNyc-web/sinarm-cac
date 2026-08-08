/**
 * Tipos FECHADOS do acionador administrativo manual do dispatcher sintético.
 * Módulo puro: só declara forma — nenhuma regra de política, nenhum I/O.
 *
 * O contexto administrativo (`ManualSyntheticDispatchAdminContext`) NÃO é
 * autenticação real: é a forma fechada que a política exige para considerar
 * uma solicitação como vinda de alguém autorizado — quem monta esse objeto
 * (ex.: uma Server Action futura que já resolveu a sessão real) é responsável
 * por preenchê-lo corretamente. Este PR não resolve sessão nem verifica
 * credencial — ver `manualSyntheticDispatchTrigger.ts`.
 */
import type { SyntheticBatchStopReason } from "../dispatcher/syntheticBatchDispatcher";
import type { SyntheticEngineHealthStatus } from "../observability/syntheticEngineHealth";
import type { SyntheticEngineMetrics } from "../observability/syntheticEngineMetrics";
import type { SyntheticEngineReadinessStatus } from "../observability/syntheticEngineReadiness";

// ------------------------------------------------------------- solicitante

/** Papéis aceitos. Lista fechada — nenhum outro papel autoriza o lote. */
export const MANUAL_DISPATCH_ADMIN_ROLES = ["ADMIN", "OPERATOR"] as const;
export type ManualDispatchAdminRole = (typeof MANUAL_DISPATCH_ADMIN_ROLES)[number];

/** Só o laboratório sintético — nenhum outro valor existe neste PR de propósito. */
export const MANUAL_DISPATCH_ENVIRONMENTS = ["SYNTHETIC_LAB"] as const;
export type ManualDispatchEnvironment = (typeof MANUAL_DISPATCH_ENVIRONMENTS)[number];

/**
 * Contexto fechado do solicitante. `requestedBy` é um IDENTIFICADOR
 * (ex.: id/e-mail já resolvido por quem chama) — texto livre, mas sempre
 * redigido antes de aparecer em log/resultado; nunca é, sozinho, prova de
 * autorização — só o par (`role` permitido + `environment` certo +
 * `explicitConfirmation === true`) autoriza.
 */
export interface ManualSyntheticDispatchAdminContext {
  role: ManualDispatchAdminRole;
  environment: ManualDispatchEnvironment;
  explicitConfirmation: boolean;
  requestedBy: string;
}

// ------------------------------------------------------------------ limites

/** Limites ADMINISTRATIVOS — sempre dentro (nunca acima) dos limites do dispatcher (`SYNTHETIC_BATCH_MAX_RUNS_CAP`). */
export const MANUAL_DISPATCH_LIMITS = {
  MAX_RUNS_MIN: 1,
  MAX_RUNS_MAX: 10,
  MAX_CONCURRENCY_MIN: 1,
  MAX_CONCURRENCY_MAX: 5,
} as const;

// ------------------------------------------------------------------ política

export const MANUAL_DISPATCH_POLICY_DECISIONS = [
  "ALLOWED",
  "DENIED_ROLE",
  "DENIED_ENVIRONMENT",
  "DENIED_CONFIRMATION",
  "DENIED_REASON",
  "DENIED_HEALTH",
  "DENIED_READINESS",
  "DENIED_CONFIGURATION",
  "DENIED_RATE_LIMIT",
  "DENIED_DUPLICATE_REQUEST",
] as const;

export type ManualSyntheticDispatchPolicyDecision = (typeof MANUAL_DISPATCH_POLICY_DECISIONS)[number];

/**
 * `reasonCode` é um rótulo curto e fechado-o-bastante para log/depuração —
 * nunca texto livre não redigido (quem monta sempre usa uma string fixa,
 * nunca ecoa `reason`/`requestedBy` de volta aqui).
 */
export interface ManualSyntheticDispatchPolicyResult {
  decision: ManualSyntheticDispatchPolicyDecision;
  reasonCode: string;
}

// ------------------------------------------------------------------- avisos

export const MANUAL_DISPATCH_WARNING_CODES = [
  "DEGRADED_HEALTH_OVERRIDE",
  "PARTIAL_BATCH",
  "UNEXPECTED_DISPATCH_FAILURE",
] as const;

export type ManualSyntheticDispatchWarningCode = (typeof MANUAL_DISPATCH_WARNING_CODES)[number];

export interface ManualSyntheticDispatchWarning {
  code: ManualSyntheticDispatchWarningCode;
  detail: string;
}

// ----------------------------------------------------------------- outcome

export const MANUAL_DISPATCH_OUTCOMES = [
  "DISPATCH_COMPLETED",
  "DISPATCH_PARTIAL",
  "DISPATCH_EMPTY",
  "REQUEST_DENIED",
  "REQUEST_REPLAYED",
  "DISPATCH_CANCELLED",
  "DISPATCH_FAILED",
] as const;

export type ManualSyntheticDispatchOutcome = (typeof MANUAL_DISPATCH_OUTCOMES)[number];

// ------------------------------------------------------------------ resumo

/** Só os agregados do lote — nunca a lista de itens, run ou sessão. */
export interface ManualSyntheticDispatchBatchSummary {
  stopReason: SyntheticBatchStopReason;
  requested: number;
  dispatched: number;
  completed: number;
  conflicted: number;
  noWork: number;
  interrupted: number;
}

// ----------------------------------------------------------------- resultado

/**
 * Resultado administrativo FECHADO. Nunca carrega sessão viva,
 * `sessionHandle`, credencial, CPF, cookie, token, stack trace, erro bruto,
 * URL externa, objeto de run completo, plano completo ou evidência integral.
 */
export interface ManualSyntheticDispatchResult {
  requestId: string;
  batchId: string;
  requestedAt: string;
  completedAt: string;
  /** Sempre redigido (`redactLabText`). */
  requestedBy: string;
  /** Sempre redigido (`redactLabText`). */
  reason: string;
  decision: ManualSyntheticDispatchPolicyDecision;
  outcome: ManualSyntheticDispatchOutcome;
  batch: ManualSyntheticDispatchBatchSummary | null;
  metrics: SyntheticEngineMetrics | null;
  health: SyntheticEngineHealthStatus;
  readiness: SyntheticEngineReadinessStatus;
  warnings: readonly ManualSyntheticDispatchWarning[];
}
