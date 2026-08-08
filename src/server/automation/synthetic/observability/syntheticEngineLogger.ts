/**
 * Log ESTRUTURADO do motor sintético — união fechada de 24 códigos de
 * evento (18 do motor + 6 do acionador administrativo manual,
 * `admin/manualSyntheticDispatchTrigger.ts`), cada um com campos tipados e
 * redigidos. Reusa `redactLabText` e
 * `scanSyntheticValue` já existentes (Fase 2/8D) — nenhuma regra de
 * segurança nova, nenhuma regex duplicada.
 *
 * NUNCA carrega: `sessionHandle`, sessão viva, CPF, senha, cookie, token,
 * storage state, stack trace, erro bruto, HTML, screenshot, URL externa,
 * payload arbitrário. `reason` é sempre texto REDIGIDO — nunca cru.
 *
 * Módulo puro: sem I/O, sem `Date.now()`, sem console.
 */
import { redactLabText } from "../../redaction";
import { scanSyntheticValue } from "../sessionContract";

export const SYNTHETIC_ENGINE_LOG_EVENT_CODES = [
  "BATCH_STARTED",
  "BATCH_FINISHED",
  "BATCH_LIMIT_REACHED",
  "BATCH_DEADLINE_REACHED",
  "BATCH_CANCELLED",
  "WORKER_STARTED",
  "WORKER_FINISHED",
  "RUN_COMPLETED",
  "RUN_WAITING_HUMAN",
  "RUN_FAILED",
  "RUN_EXPIRED",
  "RUN_CANCELLED",
  "CLAIM_CONFLICT",
  "VERSION_CONFLICT",
  "SESSION_REQUIRED",
  "SESSION_MISMATCH",
  "RECOVERY_DETECTED",
  "READINESS_CHANGED",
  "MANUAL_DISPATCH_REQUESTED",
  "MANUAL_DISPATCH_ALLOWED",
  "MANUAL_DISPATCH_DENIED",
  "MANUAL_DISPATCH_STARTED",
  "MANUAL_DISPATCH_FINISHED",
  "MANUAL_DISPATCH_REPLAYED",
] as const;

export type SyntheticEngineLogEventCode = (typeof SYNTHETIC_ENGINE_LOG_EVENT_CODES)[number];

export const SYNTHETIC_ENGINE_LOG_LEVELS = ["INFO", "WARN", "ERROR"] as const;
export type SyntheticEngineLogLevel = (typeof SYNTHETIC_ENGINE_LOG_LEVELS)[number];

/** Nível padrão por código — chamador pode sobrepor via `input.level`. */
const DEFAULT_LEVEL_BY_CODE: Readonly<Record<SyntheticEngineLogEventCode, SyntheticEngineLogLevel>> = {
  BATCH_STARTED: "INFO",
  BATCH_FINISHED: "INFO",
  BATCH_LIMIT_REACHED: "INFO",
  BATCH_DEADLINE_REACHED: "WARN",
  BATCH_CANCELLED: "WARN",
  WORKER_STARTED: "INFO",
  WORKER_FINISHED: "INFO",
  RUN_COMPLETED: "INFO",
  RUN_WAITING_HUMAN: "INFO",
  RUN_FAILED: "WARN",
  RUN_EXPIRED: "WARN",
  RUN_CANCELLED: "WARN",
  CLAIM_CONFLICT: "WARN",
  VERSION_CONFLICT: "WARN",
  SESSION_REQUIRED: "WARN",
  SESSION_MISMATCH: "WARN",
  RECOVERY_DETECTED: "WARN",
  READINESS_CHANGED: "INFO",
  MANUAL_DISPATCH_REQUESTED: "INFO",
  MANUAL_DISPATCH_ALLOWED: "INFO",
  MANUAL_DISPATCH_DENIED: "WARN",
  MANUAL_DISPATCH_STARTED: "INFO",
  MANUAL_DISPATCH_FINISHED: "INFO",
  MANUAL_DISPATCH_REPLAYED: "INFO",
};

/**
 * Evento fechado — só os campos abaixo. Campo ausente na situação usa o
 * default declarado (nunca `undefined`, para que o formato seja estável em
 * serialização/snapshot).
 */
export interface SyntheticEngineLogEvent {
  code: SyntheticEngineLogEventCode;
  level: SyntheticEngineLogLevel;
  /** Relógio INJETADO — nunca `Date.now()`. */
  timestamp: string;
  runId: string | null;
  workerId: string | null;
  /** Valor de `SyntheticWorkerOutcome`, quando aplicável. */
  outcome: string | null;
  durationMs: number | null;
  /** Contadores fechados (nome -> número finito não-negativo); nunca label livre. */
  counters: Readonly<Record<string, number>> | null;
  auditCorrelationId: string | null;
  /** Sempre passado por `redactLabText` — nunca texto cru. */
  reason: string;
  /** Evidências novas atribuíveis a este evento (0 quando não aplicável). */
  evidenceDelta: number;
  /** Eventos de sessão novos atribuíveis a este evento (0 quando não aplicável). */
  eventsDelta: number;
}

export interface BuildSyntheticEngineLogEventInput {
  code: SyntheticEngineLogEventCode;
  level?: SyntheticEngineLogLevel;
  timestamp: string;
  runId?: string | null;
  workerId?: string | null;
  outcome?: string | null;
  durationMs?: number | null;
  counters?: Readonly<Record<string, number>> | null;
  auditCorrelationId?: string | null;
  reason?: string;
  evidenceDelta?: number;
  eventsDelta?: number;
}

function sanitizedCounters(counters: Readonly<Record<string, number>> | null | undefined): Readonly<Record<string, number>> | null {
  if (counters === null || counters === undefined) return null;
  const clean: Record<string, number> = {};
  for (const [key, value] of Object.entries(counters)) {
    if (!Number.isFinite(value) || value < 0) continue;
    clean[redactLabText(key).text] = value;
  }
  return clean;
}

/**
 * Constrói um evento seguro. Único ponto de criação — quem quiser emitir um
 * evento passa por aqui, nunca monta o objeto à mão. `reason` sempre
 * redigido; `durationMs`/`evidenceDelta`/`eventsDelta` nunca negativos.
 */
export function buildSyntheticEngineLogEvent(input: BuildSyntheticEngineLogEventInput): SyntheticEngineLogEvent {
  const reason = redactLabText(input.reason ?? "").text;
  const durationMs = input.durationMs !== undefined && input.durationMs !== null && Number.isFinite(input.durationMs) ? Math.max(0, input.durationMs) : null;

  return {
    code: input.code,
    level: input.level ?? DEFAULT_LEVEL_BY_CODE[input.code],
    timestamp: input.timestamp,
    runId: input.runId ?? null,
    workerId: input.workerId ?? null,
    outcome: input.outcome ?? null,
    durationMs,
    counters: sanitizedCounters(input.counters),
    auditCorrelationId: input.auditCorrelationId ?? null,
    reason,
    evidenceDelta: Number.isFinite(input.evidenceDelta) && (input.evidenceDelta ?? 0) > 0 ? (input.evidenceDelta as number) : 0,
    eventsDelta: Number.isFinite(input.eventsDelta) && (input.eventsDelta ?? 0) > 0 ? (input.eventsDelta as number) : 0,
  };
}

export const SYNTHETIC_ENGINE_LOG_EVENT_FIELDS = [
  "code",
  "level",
  "timestamp",
  "runId",
  "workerId",
  "outcome",
  "durationMs",
  "counters",
  "auditCorrelationId",
  "reason",
  "evidenceDelta",
  "eventsDelta",
] as const;

const LOG_EVENT_FIELD_SET: ReadonlySet<string> = new Set(SYNTHETIC_ENGINE_LOG_EVENT_FIELDS);
const LOG_EVENT_CODE_SET: ReadonlySet<string> = new Set(SYNTHETIC_ENGINE_LOG_EVENT_CODES);
const LOG_EVENT_LEVEL_SET: ReadonlySet<string> = new Set(SYNTHETIC_ENGINE_LOG_LEVELS);

export interface SyntheticEngineLogEventViolation {
  code: string;
  field: string | null;
  detail: string;
}

/**
 * Confere que um evento (já construído ou vindo de fora) respeita a forma
 * fechada e não carrega conteúdo proibido — reusa `scanSyntheticValue`, não
 * duplica regex de host/URL/CPF/segredo.
 */
export function validateSyntheticEngineLogEvent(candidate: unknown): { ok: true; violations: readonly [] } | { ok: false; violations: readonly SyntheticEngineLogEventViolation[] } {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return { ok: false, violations: [{ code: "NOT_AN_OBJECT", field: null, detail: "evento precisa ser objeto" }] };
  }
  const record = candidate as Record<string, unknown>;
  const violations: SyntheticEngineLogEventViolation[] = [];

  for (const key of Object.keys(record)) {
    if (!LOG_EVENT_FIELD_SET.has(key)) {
      violations.push({ code: "UNKNOWN_FIELD", field: key, detail: "campo fora da forma fechada do evento" });
    }
  }
  if (typeof record.code !== "string" || !LOG_EVENT_CODE_SET.has(record.code)) {
    violations.push({ code: "INVALID_CODE", field: "code", detail: "código fora dos 18 eventos permitidos" });
  }
  if (typeof record.level !== "string" || !LOG_EVENT_LEVEL_SET.has(record.level)) {
    violations.push({ code: "INVALID_LEVEL", field: "level", detail: "nível fora de INFO/WARN/ERROR" });
  }
  if (typeof record.durationMs === "number" && (!Number.isFinite(record.durationMs) || record.durationMs < 0)) {
    violations.push({ code: "INVALID_DURATION", field: "durationMs", detail: "duração precisa ser finita e não-negativa" });
  }
  for (const field of ["evidenceDelta", "eventsDelta"] as const) {
    if (typeof record[field] !== "number" || !Number.isFinite(record[field] as number) || (record[field] as number) < 0) {
      violations.push({ code: "INVALID_DELTA", field, detail: "delta precisa ser finito e não-negativo" });
    }
  }
  if (record.counters !== null && typeof record.counters === "object") {
    for (const [key, value] of Object.entries(record.counters as Record<string, unknown>)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        violations.push({ code: "INVALID_COUNTER", field: `counters.${key}`, detail: "contador precisa ser finito e não-negativo" });
      }
    }
  }
  if (typeof record.reason === "string") {
    violations.push(...scanSyntheticValue("reason", record.reason));
  }

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, violations: [] };
}

/**
 * Sumidouro de eventos — pode ser em memória (`InMemorySyntheticEngineLogger`)
 * ou, no futuro, externo. `emit` pode ser síncrono ou assíncrono; falha do
 * logger NUNCA pode propagar, duplicar execução ou causar retry de etapa —
 * quem chama `emit` (integração com o dispatcher) é responsável por isolar
 * o erro, não este contrato.
 */
export interface SyntheticEngineLogger {
  emit(event: SyntheticEngineLogEvent): void | Promise<void>;
}
