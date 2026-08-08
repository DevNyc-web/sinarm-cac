/**
 * Snapshot OPERACIONAL do motor sintético — a foto de estado que um
 * comando/painel interno leria, sem carregar run completo, sessão, handle
 * ou evidência/evento integral. Módulo puro: só combina o que
 * métricas/health/readiness já calcularam.
 */
import type { SyntheticBatchStopReason } from "../dispatcher/syntheticBatchDispatcher";
import type { SyntheticEngineHealthStatus } from "./syntheticEngineHealth";
import type { SyntheticEngineMetrics } from "./syntheticEngineMetrics";
import type { SyntheticEngineReadinessStatus } from "./syntheticEngineReadiness";

export const SYNTHETIC_ENGINE_SNAPSHOT_FORMAT_VERSION = "1.0.0";

export const SYNTHETIC_ENGINE_SNAPSHOT_WARNING_CODES = [
  "CLAIMS_EXPIRED_PRESENT",
  "RUNS_RECOVERABLE_PRESENT",
  "CONFLICTS_PRESENT",
  "ISOLATED_FAILURES_PRESENT",
] as const;

export type SyntheticEngineSnapshotWarningCode = (typeof SYNTHETIC_ENGINE_SNAPSHOT_WARNING_CODES)[number];

export interface SyntheticEngineSnapshotWarning {
  code: SyntheticEngineSnapshotWarningCode;
  detail: string;
}

export interface SyntheticEngineLastBatchSummary {
  stopReason: SyntheticBatchStopReason;
  requested: number;
  dispatched: number;
  completed: number;
  conflicted: number;
  noWork: number;
  interrupted: number;
  startedAt: string;
  finishedAt: string;
}

export interface SyntheticEngineOperationalSnapshot {
  formatVersion: string;
  timestamp: string;
  metrics: SyntheticEngineMetrics;
  health: SyntheticEngineHealthStatus;
  readiness: SyntheticEngineReadinessStatus;
  lastBatch: SyntheticEngineLastBatchSummary | null;
  runsRecoverableCount: number;
  claimsExpiredCount: number;
  warnings: readonly SyntheticEngineSnapshotWarning[];
}

export interface BuildSyntheticEngineOperationalSnapshotInput {
  timestamp: string;
  metrics: SyntheticEngineMetrics;
  health: SyntheticEngineHealthStatus;
  readiness: SyntheticEngineReadinessStatus;
  lastBatch?: SyntheticEngineLastBatchSummary | null;
}

function buildWarnings(metrics: SyntheticEngineMetrics): SyntheticEngineSnapshotWarning[] {
  const warnings: SyntheticEngineSnapshotWarning[] = [];
  if (metrics.claimsExpired > 0) {
    warnings.push({ code: "CLAIMS_EXPIRED_PRESENT", detail: `${metrics.claimsExpired} claim(s) expirado(s) aguardando recuperação` });
  }
  if (metrics.runsRecoverable > 0) {
    warnings.push({ code: "RUNS_RECOVERABLE_PRESENT", detail: `${metrics.runsRecoverable} run(s) recuperável(is) pendente(s)` });
  }
  if (metrics.claimConflicts + metrics.versionConflicts > 0) {
    warnings.push({ code: "CONFLICTS_PRESENT", detail: `${metrics.claimConflicts + metrics.versionConflicts} conflito(s) de claim/versão neste lote` });
  }
  if (metrics.runsFailed + metrics.runsExpired > 0) {
    warnings.push({ code: "ISOLATED_FAILURES_PRESENT", detail: `${metrics.runsFailed + metrics.runsExpired} falha(s)/expiração(ões) isolada(s) neste lote` });
  }
  return warnings;
}

/** Monta o snapshot a partir de métricas/health/readiness já calculados. Pura, sem relógio próprio. */
export function buildSyntheticEngineOperationalSnapshot(input: BuildSyntheticEngineOperationalSnapshotInput): SyntheticEngineOperationalSnapshot {
  return {
    formatVersion: SYNTHETIC_ENGINE_SNAPSHOT_FORMAT_VERSION,
    timestamp: input.timestamp,
    metrics: { ...input.metrics },
    health: input.health,
    readiness: input.readiness,
    lastBatch: input.lastBatch ?? null,
    runsRecoverableCount: input.metrics.runsRecoverable,
    claimsExpiredCount: input.metrics.claimsExpired,
    warnings: buildWarnings(input.metrics),
  };
}

const SNAPSHOT_FIELDS = [
  "formatVersion",
  "timestamp",
  "metrics",
  "health",
  "readiness",
  "lastBatch",
  "runsRecoverableCount",
  "claimsExpiredCount",
  "warnings",
] as const;

const SNAPSHOT_FIELD_SET: ReadonlySet<string> = new Set(SNAPSHOT_FIELDS);

const LAST_BATCH_FIELDS = ["stopReason", "requested", "dispatched", "completed", "conflicted", "noWork", "interrupted", "startedAt", "finishedAt"] as const;
const LAST_BATCH_FIELD_SET: ReadonlySet<string> = new Set(LAST_BATCH_FIELDS);

export type SyntheticEngineSnapshotValidation = { ok: true; violations: readonly [] } | { ok: false; violations: readonly string[] };

/**
 * Valida a FORMA fechada de um snapshot candidato — nenhum campo fora da
 * lista, `lastBatch` (quando presente) também fechado, sem objeto de run
 * completo embutido (checagem simples: nenhum campo desconhecido sobra).
 */
export function validateSyntheticEngineOperationalSnapshot(candidate: unknown): SyntheticEngineSnapshotValidation {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return { ok: false, violations: ["snapshot precisa ser objeto"] };
  }
  const record = candidate as Record<string, unknown>;
  const violations: string[] = [];

  for (const key of Object.keys(record)) {
    if (!SNAPSHOT_FIELD_SET.has(key)) violations.push(`campo fora do snapshot fechado: ${key}`);
  }
  for (const field of SNAPSHOT_FIELDS) {
    if (!(field in record)) violations.push(`campo obrigatório ausente: ${field}`);
  }

  if (record.lastBatch !== null && record.lastBatch !== undefined) {
    if (typeof record.lastBatch !== "object" || Array.isArray(record.lastBatch)) {
      violations.push("lastBatch precisa ser objeto ou null");
    } else {
      const lastBatch = record.lastBatch as Record<string, unknown>;
      for (const key of Object.keys(lastBatch)) {
        if (!LAST_BATCH_FIELD_SET.has(key)) violations.push(`campo fora do lastBatch fechado: ${key}`);
      }
    }
  }

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, violations: [] };
}
