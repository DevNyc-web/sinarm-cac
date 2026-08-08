/**
 * Métricas do motor sintético (`syntheticEngineMetrics.ts`) — agregação
 * pura a partir de resultados já produzidos pelo dispatcher/worker/recovery.
 * Não repete a matriz de outcomes do dispatcher/worker, só confere a
 * TRADUÇÃO para métrica.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSyntheticRun, executeNextSyntheticStep, type SyntheticAutomationRun, type SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { dispatchSyntheticBatch, type SyntheticBatchDispatchResult } from "../../../src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher";
import { InMemorySyntheticEngineLogger } from "../../../src/server/automation/synthetic/observability/inMemorySyntheticEngineLogger";
import { buildSyntheticEngineMetrics, isValidSyntheticEngineMetrics, zeroSyntheticEngineMetrics } from "../../../src/server/automation/synthetic/observability/syntheticEngineMetrics";
import type { SyntheticRunStore } from "../../../src/server/automation/synthetic/store/syntheticRunStore";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionOutcome,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../../../src/server/automation/synthetic/playwright/syntheticStepExecutor";

function session(runId: string, overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: `sh_metrics_${runId}`,
    processId: `proc-metrics-${runId}`,
    actorId: "actor-metrics-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-13T10:10:00.000Z",
    issuedAt: "2026-08-13T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: `consent-sintetico-metrics-${runId}`,
    handoffState: "CLAIMED",
    auditCorrelationId: `corr-metrics-${runId}`,
    allowedSyntheticProcessCode: `PROT-FICT-METRICS-${runId}`,
    ...overrides,
  };
}

const ONE_STEP: readonly SyntheticRunStep[] = [
  { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" },
];

function makeRun(runId: string, sessionOverrides: Partial<SyntheticSessionContract> = {}): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(runId, sessionOverrides),
    plan: { planId: `plan-metrics-${runId}`, version: "1.0.0", allowedSyntheticData: [], steps: ONE_STEP },
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.run;
}

async function seedRuns(store: InMemorySyntheticRunStore, runIds: readonly string[], at: string): Promise<void> {
  for (const runId of runIds) {
    await store.create({ run: makeRun(runId), idempotencyKey: `idem-${runId}`, at });
  }
}

class MapExecutor implements SyntheticStepExecutor {
  private readonly byRunId: Map<string, SyntheticStepExecutionOutcome>;
  constructor(byRunId: Record<string, SyntheticStepExecutionOutcome> = {}) {
    this.byRunId = new Map(Object.entries(byRunId));
  }
  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    const outcome = this.byRunId.get(input.runId) ?? "SUCCESS";
    return { outcome, stepId: input.stepId, detail: `fake:${outcome}`, capturedProtocol: null };
  }
}

function makeClock(startIso: string, stepMs: number): () => string {
  let current = Date.parse(startIso);
  return () => {
    const value = new Date(current).toISOString();
    current += stepMs;
    return value;
  };
}

const AT = "2026-08-13T10:00:01.000Z";
const FAR_DEADLINE = "2026-08-13T20:00:00.000Z";
const TTL = 60_000;

async function runBatch(
  store: SyntheticRunStore,
  overrides: Partial<Parameters<typeof dispatchSyntheticBatch>[0]> = {},
): Promise<{ batch: SyntheticBatchDispatchResult; logger: InMemorySyntheticEngineLogger }> {
  const logger = new InMemorySyntheticEngineLogger();
  const batch = await dispatchSyntheticBatch({
    store,
    executor: new MapExecutor(),
    maxRuns: 3,
    maxConcurrency: 2,
    at: AT,
    deadlineAt: FAR_DEADLINE,
    now: makeClock(AT, 1_000),
    claimTtlMs: TTL,
    resolveSession: (runId) => Promise.resolve(session(runId)),
    idempotencyKeyFor: (runId) => `batch-metrics:${runId}`,
    workerIdPrefix: "worker-metrics",
    logger,
    ...overrides,
  });
  return { batch, logger };
}

// -------------------------------------------------------------- 1. lote vazio

test("métricas de lote vazio: tudo zerado, formato válido", async () => {
  const store = new InMemorySyntheticRunStore();
  const { batch, logger } = await runBatch(store);

  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.runsDispatched, 0);
  assert.equal(metrics.stepsExecuted, 0);
  assert.equal(metrics.runsCompleted, 0);
  assert.ok(isValidSyntheticEngineMetrics(metrics));
});

test("sem entrada nenhuma, todas as métricas ficam em zero", () => {
  const metrics = buildSyntheticEngineMetrics({});
  assert.deepEqual(metrics, zeroSyntheticEngineMetrics());
  assert.ok(isValidSyntheticEngineMetrics(metrics));
});

// -------------------------------------------------------------- 2. sucesso

test("métricas de sucesso: runsCompleted e stepsExecuted contam o run concluído", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const { batch, logger } = await runBatch(store, { maxRuns: 1, maxConcurrency: 1 });

  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.runsCompleted, 1);
  assert.equal(metrics.stepsExecuted, 1);
  assert.equal(metrics.runsDispatched, 1);
});

// -------------------------------------------------------------- 3. falha

test("métricas de falha: runsFailed conta TIMEOUT", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor({ "run-1": "TIMEOUT" });
  const { batch, logger } = await runBatch(store, { maxRuns: 1, maxConcurrency: 1, executor });

  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.runsFailed, 1);
  assert.equal(metrics.runsCompleted, 0);
});

// -------------------------------------------------------- 4. WAITING_HUMAN

test("métricas de WAITING_HUMAN: runsWaitingHuman conta captcha", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor({ "run-1": "CAPTCHA_DETECTED" });
  const { batch, logger } = await runBatch(store, { maxRuns: 1, maxConcurrency: 1, executor });

  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.runsWaitingHuman, 1);
});

// ------------------------------------------------------- 5. conflito de claim

test("conflito de claim: claimConflicts conta CLAIM_CONFLICT", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);

  class ClaimStealer implements SyntheticRunStore {
    private stolen = false;
    constructor(private readonly inner: SyntheticRunStore) {}
    create = (i: Parameters<SyntheticRunStore["create"]>[0]) => this.inner.create(i);
    getById = (runId: string) => this.inner.getById(runId);
    save = (i: Parameters<SyntheticRunStore["save"]>[0]) => this.inner.save(i);
    async claimNext(i: Parameters<SyntheticRunStore["claimNext"]>[0]) {
      if (i.runId === "run-1" && !this.stolen) {
        this.stolen = true;
        await this.inner.claimNext({ runId: "run-1", workerId: "outro-worker-externo", at: i.at, ttlMs: 999_000 });
      }
      return this.inner.claimNext(i);
    }
    renewClaim = (i: Parameters<SyntheticRunStore["renewClaim"]>[0]) => this.inner.renewClaim(i);
    releaseClaim = (i: Parameters<SyntheticRunStore["releaseClaim"]>[0]) => this.inner.releaseClaim(i);
    completeClaim = (i: Parameters<SyntheticRunStore["completeClaim"]>[0]) => this.inner.completeClaim(i);
    listRecoverable = (i: Parameters<SyntheticRunStore["listRecoverable"]>[0]) => this.inner.listRecoverable(i);
  }

  const { batch, logger } = await runBatch(new ClaimStealer(store), { maxRuns: 1, maxConcurrency: 1 });
  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.claimConflicts, 1);
});

// ----------------------------------------------------- 6. conflito de versão

test("conflito de versão: versionConflicts conta VERSION_CONFLICT", async () => {
  const store = new InMemorySyntheticRunStore();
  const runId = "run-1";
  await seedRuns(store, [runId], AT);
  const conflictingRun = makeRun(runId);

  class RaceInjectingStore implements SyntheticRunStore {
    private getByIdCalls = 0;
    constructor(private readonly inner: SyntheticRunStore) {}
    create = (i: Parameters<SyntheticRunStore["create"]>[0]) => this.inner.create(i);
    async getById(id: string) {
      const snapshot = await this.inner.getById(id);
      if (id === runId && snapshot !== null) {
        this.getByIdCalls += 1;
        if (this.getByIdCalls === 2) {
          await this.inner.save({ runId: id, expectedVersion: snapshot.version, run: conflictingRun, at: AT, idempotencyKey: "escritor-concorrente" });
        }
      }
      return snapshot;
    }
    save = (i: Parameters<SyntheticRunStore["save"]>[0]) => this.inner.save(i);
    claimNext = (i: Parameters<SyntheticRunStore["claimNext"]>[0]) => this.inner.claimNext(i);
    renewClaim = (i: Parameters<SyntheticRunStore["renewClaim"]>[0]) => this.inner.renewClaim(i);
    releaseClaim = (i: Parameters<SyntheticRunStore["releaseClaim"]>[0]) => this.inner.releaseClaim(i);
    completeClaim = (i: Parameters<SyntheticRunStore["completeClaim"]>[0]) => this.inner.completeClaim(i);
    listRecoverable = (i: Parameters<SyntheticRunStore["listRecoverable"]>[0]) => this.inner.listRecoverable(i);
  }

  const { batch, logger } = await runBatch(new RaceInjectingStore(store), { maxRuns: 1, maxConcurrency: 1 });
  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.versionConflicts, 1);
});

// ------------------------------------------------------------ 7. sessão ausente

test("sessão ausente: sessionsMissing conta SESSION_REQUIRED", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const { batch, logger } = await runBatch(store, {
    maxRuns: 1,
    maxConcurrency: 1,
    resolveSession: () => Promise.resolve(null),
  });

  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.sessionsMissing, 1);
});

// -------------------------------------------------------- 8. sessão incompatível

test("sessão incompatível: sessionsMismatched conta SESSION_MISMATCH", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const { batch, logger } = await runBatch(store, {
    maxRuns: 1,
    maxConcurrency: 1,
    resolveSession: (runId) => Promise.resolve(session(runId, { auditCorrelationId: "corr-errada" })),
  });

  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.sessionsMismatched, 1);
});

// -------------------------------------------------------------- 9. duração

test("duração do lote: batchDurationMs é finishedAt - startedAt", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const { batch, logger } = await runBatch(store, { maxRuns: 2, maxConcurrency: 1 });

  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.batchDurationMs, Date.parse(batch.finishedAt) - Date.parse(batch.startedAt));
  assert.ok(metrics.batchDurationMs >= 0);
});

// --------------------------------------------------------- 10. pico de concorrência

test("pico de concorrência: peakConcurrency reflete o pico observado pelo dispatcher", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3", "run-4"], AT);

  class SlowExecutor implements SyntheticStepExecutor {
    async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { outcome: "SUCCESS", stepId: input.stepId, detail: "lento", capturedProtocol: null };
    }
  }

  const { batch, logger } = await runBatch(store, { maxRuns: 4, maxConcurrency: 2, executor: new SlowExecutor() });
  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  assert.equal(metrics.peakConcurrency, batch.limits.peakConcurrency);
  assert.equal(metrics.peakConcurrency, 2);
});

// --------------------------------------------------- 11. eventos e evidências

test("eventos e evidências contabilizados: WORKER_FINISHED não é contado em dobro pelo evento de outcome", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const { batch, logger } = await runBatch(store, { maxRuns: 1, maxConcurrency: 1 });

  const events = logger.snapshot();
  const workerFinished = events.find((e) => e.code === "WORKER_FINISHED");
  assert.ok(workerFinished);
  assert.equal(workerFinished!.evidenceDelta, 2, "1 etapa final: STEP_COMPLETED + RUN_COMPLETED");

  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: events });
  assert.equal(metrics.evidenceProduced, workerFinished!.evidenceDelta, "não duplicado pelo evento RUN_COMPLETED equivalente");
  assert.ok(metrics.eventsProduced > 0);
});

// -------------------------------------------------------------- recovery

test("recoverable: runsRecoverable e claimsExpired vêm do que listRecoverable já devolveu", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  // run-1 recebe um claim que já expirou no instante `AT`.
  await store.claimNext({ runId: "run-1", workerId: "worker-x", at: "2026-08-13T09:00:00.000Z", ttlMs: 1_000 });

  const recoverable = await store.listRecoverable({ at: AT });
  const metrics = buildSyntheticEngineMetrics({ recoverable });

  assert.equal(metrics.runsRecoverable, 2);
  assert.equal(metrics.claimsExpired, 1);
});

test("sem trabalho encontrado não é tratado como falha: métricas zeradas continuam válidas", () => {
  const metrics = buildSyntheticEngineMetrics({ recoverable: [] });
  assert.equal(metrics.runsRecoverable, 0);
  assert.equal(metrics.claimsExpired, 0);
  assert.ok(isValidSyntheticEngineMetrics(metrics));
});

// -------------------------------------------------------------- segurança

test("métricas nunca carregam sessionHandle nem credencial", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const { batch, logger } = await runBatch(store, { maxRuns: 1, maxConcurrency: 1 });
  const metrics = buildSyntheticEngineMetrics({ batch, logEvents: logger.snapshot() });

  const serialized = JSON.stringify(metrics).toLowerCase();
  for (const forbidden of ["sh_metrics", "sessionhandle", "senha", "password", "cookie", "token"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
});
