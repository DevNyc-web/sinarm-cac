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
import { SYNTHETIC_BATCH_STOP_REASONS, type SyntheticBatchStopReason } from "../dispatcher/syntheticBatchDispatcher";
import { SYNTHETIC_ENGINE_HEALTH_STATUSES, type SyntheticEngineHealthStatus } from "../observability/syntheticEngineHealth";
import { isValidSyntheticEngineMetrics, type SyntheticEngineMetrics } from "../observability/syntheticEngineMetrics";
import { SYNTHETIC_ENGINE_READINESS_STATUSES, type SyntheticEngineReadinessStatus } from "../observability/syntheticEngineReadiness";
import { scanSyntheticValue } from "../sessionContract";

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
  /**
   * NÃO são decisões da política pura (`evaluateManualSyntheticDispatchPolicy`
   * nunca devolve estas duas) — são decisões de NÍVEL DE REGISTRY, atribuídas
   * pelo trigger quando `registry.reserve()` encontra outro processo dono da
   * reserva ativa, ou uma reserva PENDING com lease vencida. Mesmo padrão já
   * usado por `DENIED_DUPLICATE_REQUEST` (também nunca vem da política pura).
   */
  "DENIED_ALREADY_RUNNING",
  "DENIED_RECOVERY_REQUIRED",
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
  /** O lote pode ter rodado, mas o resultado não pôde ser gravado depois — exige inspeção administrativa, nunca retry automático. */
  "RESULT_PERSISTENCE_FAILED",
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
  /**
   * O caso mais sensível: o dispatcher pode ter rodado (e até concluído com
   * sucesso), mas o resultado NÃO pôde ser persistido depois. NUNCA reexecuta
   * o lote sozinho — só sinaliza que uma inspeção administrativa é necessária.
   */
  "RESULT_PERSISTENCE_FAILED",
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

/** Versão da FORMA deste resultado — o mesmo objeto é usado em memória e persistido; muda só se a forma fechada mudar. */
export const MANUAL_DISPATCH_RESULT_FORMAT_VERSION = "1.0.0";

/**
 * Resultado administrativo FECHADO. Nunca carrega sessão viva,
 * `sessionHandle`, credencial, CPF, cookie, token, stack trace, erro bruto,
 * URL externa, objeto de run completo, plano completo ou evidência integral.
 * A MESMA forma serve para o resultado em memória e para o que é persistido
 * — nenhuma projeção paralela.
 */
export interface ManualSyntheticDispatchResult {
  formatVersion: string;
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

// ------------------------------------------------------------- validação

const RESULT_FIELDS = [
  "formatVersion",
  "requestId",
  "batchId",
  "requestedAt",
  "completedAt",
  "requestedBy",
  "reason",
  "decision",
  "outcome",
  "batch",
  "metrics",
  "health",
  "readiness",
  "warnings",
] as const satisfies readonly (keyof ManualSyntheticDispatchResult)[];

const RESULT_FIELD_SET: ReadonlySet<string> = new Set(RESULT_FIELDS);
const POLICY_DECISION_SET: ReadonlySet<string> = new Set(MANUAL_DISPATCH_POLICY_DECISIONS);
const OUTCOME_SET: ReadonlySet<string> = new Set(MANUAL_DISPATCH_OUTCOMES);
const WARNING_CODE_SET: ReadonlySet<string> = new Set(MANUAL_DISPATCH_WARNING_CODES);
const HEALTH_STATUS_SET: ReadonlySet<string> = new Set(SYNTHETIC_ENGINE_HEALTH_STATUSES);
const READINESS_STATUS_SET: ReadonlySet<string> = new Set(SYNTHETIC_ENGINE_READINESS_STATUSES);
const STOP_REASON_SET: ReadonlySet<string> = new Set(SYNTHETIC_BATCH_STOP_REASONS);

const BATCH_SUMMARY_FIELDS = ["stopReason", "requested", "dispatched", "completed", "conflicted", "noWork", "interrupted"] as const;
const BATCH_SUMMARY_FIELD_SET: ReadonlySet<string> = new Set(BATCH_SUMMARY_FIELDS);

export interface ManualSyntheticDispatchResultViolation {
  code: string;
  field: string | null;
  detail: string;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateBatchSummary(candidate: unknown, violations: ManualSyntheticDispatchResultViolation[]): void {
  if (candidate === null) return;
  if (typeof candidate !== "object" || Array.isArray(candidate)) {
    violations.push({ code: "INVALID_TYPE", field: "batch", detail: "batch precisa ser objeto ou null" });
    return;
  }
  const record = candidate as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!BATCH_SUMMARY_FIELD_SET.has(key)) violations.push({ code: "UNKNOWN_FIELD", field: `batch.${key}`, detail: "campo fora do resumo fechado do lote" });
  }
  for (const field of BATCH_SUMMARY_FIELDS) {
    if (!(field in record)) violations.push({ code: "MISSING_FIELD", field: `batch.${field}`, detail: "campo obrigatório ausente" });
  }
  if (typeof record.stopReason !== "string" || !STOP_REASON_SET.has(record.stopReason)) {
    violations.push({ code: "INVALID_STOP_REASON", field: "batch.stopReason", detail: "fora do vocabulário do dispatcher" });
  }
  for (const field of ["requested", "dispatched", "completed", "conflicted", "noWork", "interrupted"] as const) {
    if (field in record && !isFiniteNonNegative(record[field])) {
      violations.push({ code: "INVALID_NUMBER", field: `batch.${field}`, detail: "precisa ser finito e não-negativo" });
    }
  }
}

function validateWarnings(candidate: unknown, violations: ManualSyntheticDispatchResultViolation[]): void {
  if (!Array.isArray(candidate)) {
    violations.push({ code: "INVALID_TYPE", field: "warnings", detail: "warnings precisa ser lista" });
    return;
  }
  candidate.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      violations.push({ code: "INVALID_TYPE", field: `warnings[${index}]`, detail: "aviso precisa ser objeto" });
      return;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.code !== "string" || !WARNING_CODE_SET.has(record.code)) {
      violations.push({ code: "INVALID_WARNING_CODE", field: `warnings[${index}].code`, detail: "fora da lista fechada de avisos" });
    }
    if (typeof record.detail !== "string") {
      violations.push({ code: "INVALID_TYPE", field: `warnings[${index}].detail`, detail: "detail precisa ser string" });
    } else {
      violations.push(...scanSyntheticValue(`warnings[${index}].detail`, record.detail).map((v) => ({ code: v.code, field: v.field, detail: v.detail })));
    }
  });
}

export type ManualSyntheticDispatchResultValidation =
  | { ok: true; violations: readonly [] }
  | { ok: false; violations: readonly ManualSyntheticDispatchResultViolation[] };

/**
 * Valida um candidato a `ManualSyntheticDispatchResult` — usada ANTES de
 * persistir e DEPOIS de ler do banco (nunca confia cegamente em JSON
 * armazenado). Reusa `scanSyntheticValue`/`isValidSyntheticEngineMetrics` já
 * existentes — nenhuma regex de segredo nova.
 */
export function validateManualSyntheticDispatchResult(candidate: unknown): ManualSyntheticDispatchResultValidation {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return { ok: false, violations: [{ code: "NOT_AN_OBJECT", field: null, detail: "resultado precisa ser objeto" }] };
  }
  const record = candidate as Record<string, unknown>;
  const violations: ManualSyntheticDispatchResultViolation[] = [];

  for (const key of Object.keys(record)) {
    if (!RESULT_FIELD_SET.has(key)) violations.push({ code: "UNKNOWN_FIELD", field: key, detail: "campo fora do resultado fechado" });
  }
  for (const field of RESULT_FIELDS) {
    if (!(field in record)) violations.push({ code: "MISSING_FIELD", field, detail: "campo obrigatório ausente" });
  }

  for (const field of ["requestId", "batchId", "requestedAt", "completedAt", "formatVersion"] as const) {
    if (field in record && typeof record[field] !== "string") violations.push({ code: "INVALID_TYPE", field, detail: "esperado string" });
  }
  if (typeof record.requestedBy === "string") violations.push(...scanSyntheticValue("requestedBy", record.requestedBy).map((v) => ({ code: v.code, field: v.field, detail: v.detail })));
  else violations.push({ code: "INVALID_TYPE", field: "requestedBy", detail: "esperado string" });
  if (typeof record.reason === "string") violations.push(...scanSyntheticValue("reason", record.reason).map((v) => ({ code: v.code, field: v.field, detail: v.detail })));
  else violations.push({ code: "INVALID_TYPE", field: "reason", detail: "esperado string" });

  if (typeof record.decision !== "string" || !POLICY_DECISION_SET.has(record.decision)) {
    violations.push({ code: "INVALID_DECISION", field: "decision", detail: "fora da união fechada de decisões" });
  }
  if (typeof record.outcome !== "string" || !OUTCOME_SET.has(record.outcome)) {
    violations.push({ code: "INVALID_OUTCOME", field: "outcome", detail: "fora da união fechada de outcomes" });
  }
  if (typeof record.health !== "string" || !HEALTH_STATUS_SET.has(record.health)) {
    violations.push({ code: "INVALID_HEALTH", field: "health", detail: "fora da união fechada de health" });
  }
  if (typeof record.readiness !== "string" || !READINESS_STATUS_SET.has(record.readiness)) {
    violations.push({ code: "INVALID_READINESS", field: "readiness", detail: "fora da união fechada de readiness" });
  }

  if ("batch" in record) validateBatchSummary(record.batch, violations);
  if ("warnings" in record) validateWarnings(record.warnings, violations);
  if (record.metrics !== null && record.metrics !== undefined) {
    if (typeof record.metrics !== "object" || !isValidSyntheticEngineMetrics(record.metrics as SyntheticEngineMetrics)) {
      violations.push({ code: "INVALID_METRICS", field: "metrics", detail: "métricas fora da forma fechada/válida" });
    }
  }

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, violations: [] };
}
