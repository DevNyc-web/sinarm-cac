/**
 * Despachante SINTÉTICO EM LOTE, limitado e NÃO contínuo:
 *
 *   receber limite do lote → selecionar sessões disponíveis → chamar
 *   workers com concorrência limitada → coletar resultados → parar ao
 *   atingir o limite → devolver resumo → encerrar
 *
 * NÃO é daemon, scheduler nem serviço contínuo — uma chamada SEMPRE termina.
 * Sem `while (true)`: o único laço (`runOne`, abaixo) tem condição de
 * parada finita (`cursor < selected.length`), sobre uma lista que já nasceu
 * do tamanho certo.
 *
 * NÃO duplica lógica: a seleção é UMA chamada a `store.listRecoverable`; a
 * execução de CADA item é `runSyntheticWorkerOnce` (`syntheticSingleStepWorker.ts`),
 * mirado no run já escolhido via o `runId` opcional dele — nenhuma regra de
 * claim, versão, idempotência ou lifecycle é reimplementada aqui. Idempotência
 * do LOTE também não ganha tabela própria: é só a chave que o chamador
 * injeta via `idempotencyKeyFor(runId)`, repassada ao worker/store de sempre.
 *
 * A sessão viva NUNCA vem do store: `resolveSession(runId)` é sempre
 * injetada, e o resultado agregado nunca carrega `sessionHandle`.
 */
import { runSyntheticWorkerOnce, type SyntheticWorkerOutcome } from "../worker/syntheticSingleStepWorker";
import type { StoredSyntheticRun, SyntheticRunStore, SyntheticRunStoreViolation } from "../store/syntheticRunStore";
import type { SyntheticStepExecutor } from "../playwright/syntheticStepExecutor";

/** Teto interno — nenhum limite pode ser efetivamente ilimitado, mesmo se o chamador pedir mais. */
export const SYNTHETIC_BATCH_MAX_RUNS_CAP = 10;

export const SYNTHETIC_BATCH_STOP_REASONS = [
  "LIMIT_REACHED",
  "NO_RUN_AVAILABLE",
  "DEADLINE_REACHED",
  "CANCELLED",
  "COMPLETED_BATCH",
  "INVALID_CONFIGURATION",
] as const;
export type SyntheticBatchStopReason = (typeof SYNTHETIC_BATCH_STOP_REASONS)[number];

export interface DispatchSyntheticBatchInput {
  store: SyntheticRunStore;
  executor: SyntheticStepExecutor;
  /** Positivo, nunca acima de `SYNTHETIC_BATCH_MAX_RUNS_CAP`. */
  maxRuns: number;
  /** Positivo; normalizado para no máximo `maxRuns` se vier maior. */
  maxConcurrency: number;
  /** Relógio de DOMÍNIO — o mesmo instante sintético para todo item deste lote (como o resto da Fase 2 já faz). */
  at: string;
  /** Deadline de domínio, ISO — nunca ausente/infinita. */
  deadlineAt: string;
  /**
   * Relógio de CONTROLE do despachante — decide "já passou da deadline?" e
   * mede início/fim de cada item. NUNCA usado como timestamp de domínio (que
   * é sempre `at`, fixo para o lote inteiro). Em produção: `() => new Date().toISOString()`.
   */
  now: () => string;
  claimTtlMs: number;
  /** Sessão viva por run — o store nunca fornece isso. `null`/`undefined` vira `SESSION_REQUIRED` só para AQUELE item. */
  resolveSession: (runId: string) => Promise<unknown>;
  /**
   * Fábrica de chave de idempotência por run — estável e única por
   * `batchId + runId (+ etapa lógica, se o chamador quiser)`. Repetir o
   * lote com o MESMO `batchId` deve produzir as MESMAS chaves.
   */
  idempotencyKeyFor: (runId: string) => string;
  workerIdPrefix: string;
  /** Abstração equivalente a `AbortSignal` — nunca lida do processo global dentro do domínio. */
  signal?: { readonly aborted: boolean };
}

export interface SyntheticBatchItemResult {
  workerId: string;
  runId: string | null;
  outcome: SyntheticWorkerOutcome;
  violations: readonly SyntheticRunStoreViolation[];
  runState: StoredSyntheticRun["runState"] | null;
  startedAt: string;
  finishedAt: string;
}

export interface SyntheticBatchDispatchResult {
  requested: number;
  dispatched: number;
  completed: number;
  noWork: number;
  conflicted: number;
  interrupted: number;
  results: readonly SyntheticBatchItemResult[];
  startedAt: string;
  finishedAt: string;
  stopReason: SyntheticBatchStopReason;
  limits: {
    maxRuns: number;
    maxConcurrency: number;
    effectiveConcurrency: number;
    /** Pico REAL observado de workers simultâneos — prova de que o limite foi respeitado. */
    peakConcurrency: number;
  };
}

const COMPLETED_OUTCOMES = new Set<SyntheticWorkerOutcome>(["STEP_COMPLETED", "RUN_COMPLETED"]);
const CONFLICT_OUTCOMES = new Set<SyntheticWorkerOutcome>(["VERSION_CONFLICT", "CLAIM_CONFLICT"]);
const NO_WORK_OUTCOMES = new Set<SyntheticWorkerOutcome>(["NO_RUN_AVAILABLE"]);

function classify(outcome: SyntheticWorkerOutcome): "completed" | "conflicted" | "noWork" | "interrupted" {
  if (COMPLETED_OUTCOMES.has(outcome)) return "completed";
  if (CONFLICT_OUTCOMES.has(outcome)) return "conflicted";
  if (NO_WORK_OUTCOMES.has(outcome)) return "noWork";
  return "interrupted";
}

function invalidConfig(input: DispatchSyntheticBatchInput, at: string): SyntheticBatchDispatchResult {
  return {
    requested: Math.max(input.maxRuns, 0),
    dispatched: 0,
    completed: 0,
    noWork: 0,
    conflicted: 0,
    interrupted: 0,
    results: [],
    startedAt: at,
    finishedAt: at,
    stopReason: "INVALID_CONFIGURATION",
    limits: { maxRuns: input.maxRuns, maxConcurrency: input.maxConcurrency, effectiveConcurrency: 0, peakConcurrency: 0 },
  };
}

function isValidConfig(input: DispatchSyntheticBatchInput): boolean {
  if (!Number.isInteger(input.maxRuns) || input.maxRuns <= 0) return false;
  if (input.maxRuns > SYNTHETIC_BATCH_MAX_RUNS_CAP) return false;
  if (!Number.isInteger(input.maxConcurrency) || input.maxConcurrency <= 0) return false;
  if (!Number.isFinite(input.claimTtlMs) || input.claimTtlMs <= 0) return false;
  if (Date.parse(input.deadlineAt) <= Date.parse(input.at)) return false;
  return true;
}

/**
 * Roda `worker` sobre `items`, nunca com mais de `limit` chamadas
 * simultâneas. Sem dependência externa — laço com condição de parada finita
 * (`cursor < items.length`), não um loop sem fim.
 */
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function runOne(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]!, index);
    }
  }
  const poolSize = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: poolSize }, () => runOne()));
}

/**
 * Despacha um lote LIMITADO de workers de execução única. Uma chamada
 * SEMPRE termina: seleciona candidatos uma vez, distribui entre no máximo
 * `maxConcurrency` slots, e para de iniciar item novo ao atingir `maxRuns`,
 * a deadline, o cancelamento ou o fim dos candidatos.
 */
export async function dispatchSyntheticBatch(input: DispatchSyntheticBatchInput): Promise<SyntheticBatchDispatchResult> {
  const { store, executor, at, deadlineAt, now, claimTtlMs, resolveSession, idempotencyKeyFor, workerIdPrefix, signal } = input;

  if (!isValidConfig(input)) return invalidConfig(input, at);

  const maxRuns = input.maxRuns;
  const effectiveConcurrency = Math.min(input.maxConcurrency, maxRuns);

  let candidates: readonly StoredSyntheticRun[];
  try {
    candidates = await store.listRecoverable({ at });
  } catch {
    // Store indisponível/quebrado: configuração de infraestrutura, não item isolado.
    return invalidConfig(input, at);
  }

  if (candidates.length === 0) {
    return {
      requested: maxRuns,
      dispatched: 0,
      completed: 0,
      noWork: 0,
      conflicted: 0,
      interrupted: 0,
      results: [],
      startedAt: at,
      finishedAt: now(),
      stopReason: "NO_RUN_AVAILABLE",
      limits: { maxRuns, maxConcurrency: input.maxConcurrency, effectiveConcurrency, peakConcurrency: 0 },
    };
  }

  // Seleção ÚNICA, no início — cada run selecionado é distinto e nunca reaparece neste lote.
  const selected = candidates.slice(0, maxRuns).map((c) => c.runId);

  const results: SyntheticBatchItemResult[] = new Array(selected.length);
  let stoppedByDeadline = false;
  let stoppedByCancel = false;
  let activeCount = 0;
  let peakConcurrency = 0;

  await runWithConcurrency(selected, effectiveConcurrency, async (runId, index) => {
    if (signal?.aborted === true) {
      stoppedByCancel = true;
      return;
    }
    if (Date.parse(now()) >= Date.parse(deadlineAt)) {
      stoppedByDeadline = true;
      return;
    }

    activeCount += 1;
    peakConcurrency = Math.max(peakConcurrency, activeCount);
    const startedAt = now();
    const workerId = `${workerIdPrefix}-${index}`;

    try {
      const session = await resolveSession(runId);
      const workerResult = await runSyntheticWorkerOnce({
        store,
        executor,
        workerId,
        session,
        at,
        claimTtlMs,
        idempotencyKey: idempotencyKeyFor(runId),
        runId,
      });
      results[index] = {
        // O runId do DESPACHANTE, não `workerResult.runId`: o worker devolve
        // `null` em desfechos como SESSION_REQUIRED, mas o item já tinha um
        // alvo conhecido — o relatório do lote não pode perder essa ligação.
        workerId,
        runId,
        outcome: workerResult.outcome,
        violations: workerResult.violations,
        runState: workerResult.run?.runState ?? null,
        startedAt,
        finishedAt: now(),
      };
    } catch {
      // Erro inesperado de infraestrutura NUM item isolado: não derruba o
      // lote inteiro, vira resultado redigido, sem stack trace.
      results[index] = {
        workerId,
        runId,
        outcome: "EXECUTION_REJECTED",
        violations: [{ code: "INVALID_STORED_RUN", field: null, detail: "erro inesperado ao processar este item" }],
        runState: null,
        startedAt,
        finishedAt: now(),
      };
    } finally {
      activeCount -= 1;
    }
  });

  const dispatchedResults = results.filter((r): r is SyntheticBatchItemResult => r !== undefined);

  let completed = 0;
  let conflicted = 0;
  let noWork = 0;
  let interrupted = 0;
  for (const item of dispatchedResults) {
    const bucket = classify(item.outcome);
    if (bucket === "completed") completed += 1;
    else if (bucket === "conflicted") conflicted += 1;
    else if (bucket === "noWork") noWork += 1;
    else interrupted += 1;
  }

  const stopReason: SyntheticBatchStopReason = stoppedByCancel
    ? "CANCELLED"
    : stoppedByDeadline
      ? "DEADLINE_REACHED"
      : dispatchedResults.length === maxRuns
        ? "LIMIT_REACHED"
        : "COMPLETED_BATCH";

  return {
    requested: maxRuns,
    dispatched: dispatchedResults.length,
    completed,
    noWork,
    conflicted,
    interrupted,
    results: dispatchedResults,
    startedAt: at,
    finishedAt: now(),
    stopReason,
    limits: { maxRuns, maxConcurrency: input.maxConcurrency, effectiveConcurrency, peakConcurrency },
  };
}
