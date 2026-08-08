/**
 * Integração OPCIONAL do dispatcher com observabilidade (`logger` em
 * `dispatchSyntheticBatch`). Não repete a matriz comportamental completa de
 * `syntheticBatchDispatcher.test.ts` — só o que é NOVO: eventos emitidos,
 * dispatcher sem logger continua idêntico, falha do logger nunca duplica
 * execução.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createSyntheticRun, type SyntheticAutomationRun, type SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { dispatchSyntheticBatch } from "../../../src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher";
import { InMemorySyntheticEngineLogger } from "../../../src/server/automation/synthetic/observability/inMemorySyntheticEngineLogger";
import type { SyntheticEngineLogEvent, SyntheticEngineLogger } from "../../../src/server/automation/synthetic/observability/syntheticEngineLogger";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionOutcome,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../../../src/server/automation/synthetic/playwright/syntheticStepExecutor";

function session(runId: string, overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: `sh_obsdisp_${runId}`,
    processId: `proc-obsdisp-${runId}`,
    actorId: "actor-obsdisp-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-13T10:10:00.000Z",
    issuedAt: "2026-08-13T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: `consent-sintetico-obsdisp-${runId}`,
    handoffState: "CLAIMED",
    auditCorrelationId: `corr-obsdisp-${runId}`,
    allowedSyntheticProcessCode: `PROT-FICT-OBSDISP-${runId}`,
    ...overrides,
  };
}

const ONE_STEP: readonly SyntheticRunStep[] = [
  { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" },
];

function makeRun(runId: string): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(runId),
    plan: { planId: `plan-obsdisp-${runId}`, version: "1.0.0", allowedSyntheticData: [], steps: ONE_STEP },
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
  calls: SyntheticStepExecutionInput[] = [];
  private readonly byRunId: Map<string, SyntheticStepExecutionOutcome>;
  constructor(byRunId: Record<string, SyntheticStepExecutionOutcome> = {}) {
    this.byRunId = new Map(Object.entries(byRunId));
  }
  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    this.calls.push(input);
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

function baseInput(store: InMemorySyntheticRunStore, overrides: Partial<Parameters<typeof dispatchSyntheticBatch>[0]> = {}) {
  return {
    store,
    executor: new MapExecutor(),
    maxRuns: 2,
    maxConcurrency: 2,
    at: AT,
    deadlineAt: FAR_DEADLINE,
    now: makeClock(AT, 1_000),
    claimTtlMs: TTL,
    resolveSession: (runId: string) => Promise.resolve(session(runId)),
    idempotencyKeyFor: (runId: string) => `batch-obsdisp:${runId}`,
    workerIdPrefix: "worker-obsdisp",
    ...overrides,
  };
}

// -------------------------------------------------------------- 39. sem logger

test("dispatcher funciona sem logger — sem mudança de comportamento funcional", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);

  const result = await dispatchSyntheticBatch(baseInput(store));

  assert.equal(result.dispatched, 2);
  assert.equal(result.completed, 2);
  assert.equal(result.stopReason, "LIMIT_REACHED");
});

// -------------------------------------------------------------- 40. com logger

test("dispatcher funciona com logger, mesmo resultado funcional de sem logger", async () => {
  const storeA = new InMemorySyntheticRunStore();
  const storeB = new InMemorySyntheticRunStore();
  await seedRuns(storeA, ["run-1", "run-2"], AT);
  await seedRuns(storeB, ["run-1", "run-2"], AT);

  const withoutLogger = await dispatchSyntheticBatch(baseInput(storeA));
  const logger = new InMemorySyntheticEngineLogger();
  const withLogger = await dispatchSyntheticBatch(baseInput(storeB, { logger }));

  assert.equal(withLogger.dispatched, withoutLogger.dispatched);
  assert.equal(withLogger.completed, withoutLogger.completed);
  assert.equal(withLogger.stopReason, withoutLogger.stopReason);
  assert.ok(logger.snapshot().length > 0);
});

// -------------------------------------------------- 12/13. início/fim do lote

test("evento de início e fim do lote são emitidos", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const logger = new InMemorySyntheticEngineLogger();

  await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, logger }));

  const events = logger.snapshot();
  assert.equal(events[0]?.code, "BATCH_STARTED");
  assert.equal(events[events.length - 1]?.code, "BATCH_FINISHED");
});

// -------------------------------------------------------- 14. limite atingido

test("evento de limite atingido é emitido quando o lote esgota maxRuns", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const logger = new InMemorySyntheticEngineLogger();

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 2, logger }));

  assert.equal(result.stopReason, "LIMIT_REACHED");
  assert.ok(logger.snapshot().some((e) => e.code === "BATCH_LIMIT_REACHED"));
});

// -------------------------------------------------------------- 15. deadline

test("evento de deadline é emitido quando o lote para por prazo", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3"], AT);
  const logger = new InMemorySyntheticEngineLogger();
  const clock = makeClock(AT, 1_000);
  const deadlineAt = new Date(Date.parse(AT) + 2_500).toISOString();

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 3, maxConcurrency: 1, now: clock, deadlineAt, logger }));

  assert.equal(result.stopReason, "DEADLINE_REACHED");
  assert.ok(logger.snapshot().some((e) => e.code === "BATCH_DEADLINE_REACHED"));
});

// ---------------------------------------------------------- 16. cancelamento

test("evento de cancelamento é emitido quando o sinal aborta o lote", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3"], AT);
  const logger = new InMemorySyntheticEngineLogger();
  const signal = { aborted: false };
  const executor = new (class implements SyntheticStepExecutor {
    async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
      signal.aborted = true;
      return { outcome: "SUCCESS", stepId: input.stepId, detail: "ok", capturedProtocol: null };
    }
  })();

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 3, maxConcurrency: 1, executor, signal, logger }));

  assert.equal(result.stopReason, "CANCELLED");
  assert.ok(logger.snapshot().some((e) => e.code === "BATCH_CANCELLED"));
});

// ----------------------------------------------------------- 17. por worker

test("eventos WORKER_STARTED/WORKER_FINISHED são emitidos por item, com runId/workerId", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const logger = new InMemorySyntheticEngineLogger();

  await dispatchSyntheticBatch(baseInput(store, { maxRuns: 2, logger }));

  const events = logger.snapshot();
  const started = events.filter((e) => e.code === "WORKER_STARTED");
  const finished = events.filter((e) => e.code === "WORKER_FINISHED");
  assert.equal(started.length, 2);
  assert.equal(finished.length, 2);
  for (const event of [...started, ...finished]) {
    assert.ok(event.runId !== null);
    assert.ok(event.workerId !== null);
  }
});

// -------------------------------------------------------- 18. captcha/espera

test("evento RUN_WAITING_HUMAN é emitido para captcha, isolado do outro item", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const executor = new MapExecutor({ "run-1": "CAPTCHA_DETECTED" });
  const logger = new InMemorySyntheticEngineLogger();

  await dispatchSyntheticBatch(baseInput(store, { maxRuns: 2, executor, logger }));

  const events = logger.snapshot();
  const waiting = events.find((e) => e.code === "RUN_WAITING_HUMAN");
  assert.ok(waiting);
  assert.equal(waiting!.runId, "run-1");
  const completed = events.find((e) => e.code === "RUN_COMPLETED");
  assert.ok(completed);
  assert.equal(completed!.runId, "run-2");
});

test("eventos de conflito/sessão emitem o código certo", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const logger = new InMemorySyntheticEngineLogger();

  await dispatchSyntheticBatch(
    baseInput(store, {
      maxRuns: 2,
      logger,
      resolveSession: (runId) => Promise.resolve(runId === "run-1" ? null : session(runId, { auditCorrelationId: "corr-errada" })),
    }),
  );

  const events = logger.snapshot();
  assert.ok(events.some((e) => e.code === "SESSION_REQUIRED" && e.runId === "run-1"));
  assert.ok(events.some((e) => e.code === "SESSION_MISMATCH" && e.runId === "run-2"));
});

// ------------------------------------------------------- 21. sem sessionHandle

test("nenhum evento emitido carrega sessionHandle nem credencial", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const executor = new MapExecutor({ "run-1": "CAPTCHA_DETECTED" });
  const logger = new InMemorySyntheticEngineLogger();

  await dispatchSyntheticBatch(baseInput(store, { maxRuns: 2, executor, logger }));

  const serialized = JSON.stringify(logger.snapshot()).toLowerCase();
  for (const forbidden of ["sh_obsdisp", "sessionhandle", "senha", "password", "cookie", "000.000.000-00"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
});

// ------------------------------------------------------- 41. erro de logger

test("erro de logger não duplica execução nem causa retry de etapa", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();

  class FailingLogger implements SyntheticEngineLogger {
    emitCount = 0;
    emit(_event: SyntheticEngineLogEvent): void {
      this.emitCount += 1;
      throw new Error("logger externo indisponível");
    }
  }
  const failingLogger = new FailingLogger();

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, executor, logger: failingLogger }));

  assert.equal(result.completed, 1);
  assert.equal(result.stopReason, "LIMIT_REACHED");
  assert.equal(executor.calls.length, 1, "o executor não foi chamado de novo por causa do erro do logger");
  assert.ok(failingLogger.emitCount > 0, "o logger falho foi de fato chamado");

  const stored = await store.getById("run-1");
  assert.equal(stored?.completedSteps.length, 1, "uma única etapa concluída, sem duplicação");
});

test("erro assíncrono do logger (Promise rejeitada) também é engolido", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();

  class AsyncFailingLogger implements SyntheticEngineLogger {
    async emit(_event: SyntheticEngineLogEvent): Promise<void> {
      throw new Error("falha assíncrona");
    }
  }

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, executor, logger: new AsyncFailingLogger() }));

  assert.equal(result.completed, 1);
  assert.equal(executor.calls.length, 1);
});

// --------------------------------------------------- 42. idempotência do lote

test("repetição idempotente não duplica métricas funcionais nem eventos de execução", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();
  const logger = new InMemorySyntheticEngineLogger();
  const idempotencyKeyFor = (runId: string) => `batch-repetido-obsdisp:${runId}`;

  const first = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, executor, logger, idempotencyKeyFor }));
  assert.equal(first.completed, 1);
  assert.equal(executor.calls.length, 1);

  const second = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, executor, logger, idempotencyKeyFor }));

  assert.equal(second.stopReason, "NO_RUN_AVAILABLE");
  assert.equal(executor.calls.length, 1, "executor não foi chamado de novo");

  const runCompletedEvents = logger.snapshot().filter((e) => e.code === "RUN_COMPLETED");
  assert.equal(runCompletedEvents.length, 1, "um único RUN_COMPLETED, não duplicado pela repetição");
});

// -------------------------------------------------------------- estrutural

test("nenhuma rede, nenhum console.*, nenhum timer recorrente no dispatcher com observabilidade", () => {
  const code = readFileSync("src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher.ts", "utf8");
  for (const forbidden of ["fetch(", "console.log", "console.error", "console.warn", "setInterval(", "cron"]) {
    assert.equal(code.includes(forbidden), false, `não pode conter ${forbidden}`);
  }
});

test("Fase 9 continua intocada — o dispatcher não referencia phase9", () => {
  const code = readFileSync("src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher.ts", "utf8");
  assert.equal(code.includes("phase9"), false);
  assert.equal(code.includes("PHASE9_REAL_EXECUTION_ENABLED"), false);
});
