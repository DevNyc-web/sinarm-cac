/**
 * Métricas OPERACIONAIS do motor sintético — números fechados, finitos e
 * não-negativos, sem label livre, sem PII, sem `sessionHandle`, sem sessão
 * viva. Só o que já foi produzido por outra camada (dispatcher, worker,
 * recovery, store) é agregado aqui — nenhum contador global mutável, nenhum
 * I/O, nenhuma consulta nova ao store.
 *
 * Reusa os tipos que já existem (`SyntheticBatchDispatchResult`,
 * `StoredSyntheticRun`) em vez de reimplementar classificação de outcome —
 * só TRADUZ o que o dispatcher/worker/store já decidiram para o vocabulário
 * de observabilidade.
 */
import type { SyntheticBatchDispatchResult } from "../dispatcher/syntheticBatchDispatcher";
import type { StoredSyntheticRun } from "../store/syntheticRunStore";
import type { SyntheticEngineLogEvent } from "./syntheticEngineLogger";

export interface SyntheticEngineMetrics {
  runsFound: number;
  runsDispatched: number;
  stepsExecuted: number;
  runsCompleted: number;
  runsFailed: number;
  runsExpired: number;
  runsCancelled: number;
  runsWaitingHuman: number;
  claimConflicts: number;
  versionConflicts: number;
  sessionsMissing: number;
  sessionsMismatched: number;
  noWorkItems: number;
  claimsExpired: number;
  runsRecoverable: number;
  evidenceProduced: number;
  eventsProduced: number;
  batchDurationMs: number;
  peakConcurrency: number;
}

const METRIC_FIELDS = [
  "runsFound",
  "runsDispatched",
  "stepsExecuted",
  "runsCompleted",
  "runsFailed",
  "runsExpired",
  "runsCancelled",
  "runsWaitingHuman",
  "claimConflicts",
  "versionConflicts",
  "sessionsMissing",
  "sessionsMismatched",
  "noWorkItems",
  "claimsExpired",
  "runsRecoverable",
  "evidenceProduced",
  "eventsProduced",
  "batchDurationMs",
  "peakConcurrency",
] as const satisfies readonly (keyof SyntheticEngineMetrics)[];

export function zeroSyntheticEngineMetrics(): SyntheticEngineMetrics {
  return {
    runsFound: 0,
    runsDispatched: 0,
    stepsExecuted: 0,
    runsCompleted: 0,
    runsFailed: 0,
    runsExpired: 0,
    runsCancelled: 0,
    runsWaitingHuman: 0,
    claimConflicts: 0,
    versionConflicts: 0,
    sessionsMissing: 0,
    sessionsMismatched: 0,
    noWorkItems: 0,
    claimsExpired: 0,
    runsRecoverable: 0,
    evidenceProduced: 0,
    eventsProduced: 0,
    batchDurationMs: 0,
    peakConcurrency: 0,
  };
}

/** `true` só quando TODOS os campos são número finito e não-negativo. */
export function isValidSyntheticEngineMetrics(value: SyntheticEngineMetrics): boolean {
  return METRIC_FIELDS.every((field) => Number.isFinite(value[field]) && value[field] >= 0);
}

const STEP_EXECUTED_OUTCOMES = new Set([
  "STEP_COMPLETED",
  "RUN_COMPLETED",
  "WAITING_HUMAN",
  "RUN_FAILED",
  "RUN_EXPIRED",
  "RUN_CANCELLED",
]);

/** Conta itens de um lote por outcome — a mesma tradução que o dispatcher já faz, sem reimplementar a classificação dele. */
function countByOutcome(batch: SyntheticBatchDispatchResult): Pick<
  SyntheticEngineMetrics,
  | "stepsExecuted"
  | "runsCompleted"
  | "runsFailed"
  | "runsExpired"
  | "runsCancelled"
  | "runsWaitingHuman"
  | "claimConflicts"
  | "versionConflicts"
  | "sessionsMissing"
  | "sessionsMismatched"
  | "noWorkItems"
> {
  let stepsExecuted = 0;
  let runsCompleted = 0;
  let runsFailed = 0;
  let runsExpired = 0;
  let runsCancelled = 0;
  let runsWaitingHuman = 0;
  let claimConflicts = 0;
  let versionConflicts = 0;
  let sessionsMissing = 0;
  let sessionsMismatched = 0;
  let noWorkItems = 0;

  for (const item of batch.results) {
    if (STEP_EXECUTED_OUTCOMES.has(item.outcome)) stepsExecuted += 1;
    switch (item.outcome) {
      case "RUN_COMPLETED":
        runsCompleted += 1;
        break;
      case "RUN_FAILED":
        runsFailed += 1;
        break;
      case "RUN_EXPIRED":
        runsExpired += 1;
        break;
      case "RUN_CANCELLED":
        runsCancelled += 1;
        break;
      case "WAITING_HUMAN":
        runsWaitingHuman += 1;
        break;
      case "CLAIM_CONFLICT":
        claimConflicts += 1;
        break;
      case "VERSION_CONFLICT":
        versionConflicts += 1;
        break;
      case "SESSION_REQUIRED":
        sessionsMissing += 1;
        break;
      case "SESSION_MISMATCH":
        sessionsMismatched += 1;
        break;
      case "NO_RUN_AVAILABLE":
        noWorkItems += 1;
        break;
      default:
        break;
    }
  }

  return {
    stepsExecuted,
    runsCompleted,
    runsFailed,
    runsExpired,
    runsCancelled,
    runsWaitingHuman,
    claimConflicts,
    versionConflicts,
    sessionsMissing,
    sessionsMismatched,
    noWorkItems,
  };
}

/** `runsRecoverable`/`claimsExpired` a partir do que `store.listRecoverable` já devolveu — nenhuma consulta nova. */
function countFromRecoverable(records: readonly StoredSyntheticRun[]): Pick<SyntheticEngineMetrics, "runsRecoverable" | "claimsExpired"> {
  let claimsExpired = 0;
  for (const record of records) {
    // `listRecoverable` só devolve RECOVERABLE; um claim não-nulo aqui só
    // pode significar que ele já expirou (ver `classifySyntheticRunRecovery`).
    if (record.claim !== null) claimsExpired += 1;
  }
  return { runsRecoverable: records.length, claimsExpired };
}

/**
 * Soma os deltas de evidência/evento carregados pelos eventos de log —
 * nenhuma leitura nova do run. Conta só `WORKER_FINISHED`: é o único código
 * emitido exatamente UMA vez por item processado; o evento de outcome
 * (`RUN_COMPLETED`, `RUN_FAILED`...) carrega o MESMO delta e somar os dois
 * dobraria a contagem.
 */
function sumProducedFromEvents(events: readonly SyntheticEngineLogEvent[]): Pick<SyntheticEngineMetrics, "evidenceProduced" | "eventsProduced"> {
  let evidenceProduced = 0;
  let eventsProduced = 0;
  for (const event of events) {
    if (event.code !== "WORKER_FINISHED") continue;
    evidenceProduced += event.evidenceDelta;
    eventsProduced += event.eventsDelta;
  }
  return { evidenceProduced, eventsProduced };
}

export interface BuildSyntheticEngineMetricsInput {
  batch?: SyntheticBatchDispatchResult;
  /** Total de candidatos elegíveis ENCONTRADOS antes da seleção (`store.listRecoverable`, sem o corte de `maxRuns`). Sem isso, cai no total despachado. */
  runsFound?: number;
  /** Mesma lista devolvida por `store.listRecoverable` — usada só para `runsRecoverable`/`claimsExpired`, nunca reconsultada aqui. */
  recoverable?: readonly StoredSyntheticRun[];
  /** Eventos já emitidos (ex.: do `InMemorySyntheticEngineLogger`) — única fonte de `evidenceProduced`/`eventsProduced`. */
  logEvents?: readonly SyntheticEngineLogEvent[];
}

/**
 * Agrega métricas a partir do que o dispatcher/worker/recovery/store JÁ
 * produziram. Pura: mesma entrada, mesma saída, sem relógio próprio, sem
 * I/O.
 */
export function buildSyntheticEngineMetrics(input: BuildSyntheticEngineMetricsInput): SyntheticEngineMetrics {
  const metrics = zeroSyntheticEngineMetrics();

  if (input.batch !== undefined) {
    const batch = input.batch;
    Object.assign(metrics, countByOutcome(batch));
    metrics.runsDispatched = batch.dispatched;
    metrics.peakConcurrency = batch.limits.peakConcurrency;
    metrics.batchDurationMs = Math.max(0, Date.parse(batch.finishedAt) - Date.parse(batch.startedAt));
    metrics.runsFound = input.runsFound ?? batch.dispatched;
  } else if (input.runsFound !== undefined) {
    metrics.runsFound = input.runsFound;
  }

  if (input.recoverable !== undefined) {
    Object.assign(metrics, countFromRecoverable(input.recoverable));
  }

  if (input.logEvents !== undefined) {
    Object.assign(metrics, sumProducedFromEvents(input.logEvents));
  }

  return metrics;
}
