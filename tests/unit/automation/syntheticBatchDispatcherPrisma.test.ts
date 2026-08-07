/**
 * Despachante em lote contra `PrismaSyntheticRunStore` (fake dedicado) —
 * prova que ele depende só da interface `SyntheticRunStore`, sem uma
 * implementação própria para Prisma. A matriz completa está em
 * `syntheticBatchDispatcher.test.ts`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSyntheticRun, type SyntheticAutomationRun, type SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { PrismaSyntheticRunStore } from "../../../src/server/automation/synthetic/store/prismaSyntheticRunStore";
import { installFakeSyntheticRunPrisma } from "./testSyntheticRunPrisma";
import { dispatchSyntheticBatch } from "../../../src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher";
import type { SyntheticRunStore } from "../../../src/server/automation/synthetic/store/syntheticRunStore";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../../../src/server/automation/synthetic/playwright/syntheticStepExecutor";

function session(runId: string): SyntheticSessionContract {
  return {
    sessionHandle: `sh_batch_prisma_${runId}`,
    processId: `proc-batch-prisma-${runId}`,
    actorId: "actor-batch-prisma-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-12T10:10:00.000Z",
    issuedAt: "2026-08-12T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: `consent-sintetico-batch-prisma-${runId}`,
    handoffState: "CLAIMED",
    auditCorrelationId: `corr-batch-prisma-${runId}`,
    allowedSyntheticProcessCode: `PROT-FICT-BATCHPRISMA-${runId}`,
  };
}

const ONE_STEP: readonly SyntheticRunStep[] = [
  { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" },
];

function makeRun(runId: string): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(runId),
    plan: { planId: `plan-batch-prisma-${runId}`, version: "1.0.0", allowedSyntheticData: [], steps: ONE_STEP },
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.run;
}

class AlwaysSucceedExecutor implements SyntheticStepExecutor {
  calls: SyntheticStepExecutionInput[] = [];
  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    this.calls.push(input);
    return { outcome: "SUCCESS", stepId: input.stepId, detail: "ok", capturedProtocol: null };
  }
}

const AT = "2026-08-12T10:00:01.000Z";
const FAR_DEADLINE = "2026-08-12T20:00:00.000Z";

test("PrismaSyntheticRunStore: lote de 2 runs é processado ponta a ponta", async () => {
  installFakeSyntheticRunPrisma();
  const store = new PrismaSyntheticRunStore();
  await store.create({ run: makeRun("run-batch-prisma-1"), idempotencyKey: "idem-batch-prisma-1", at: AT });
  await store.create({ run: makeRun("run-batch-prisma-2"), idempotencyKey: "idem-batch-prisma-2", at: AT });

  const executor = new AlwaysSucceedExecutor();
  const result = await dispatchSyntheticBatch({
    store,
    executor,
    maxRuns: 2,
    maxConcurrency: 2,
    at: AT,
    deadlineAt: FAR_DEADLINE,
    now: () => AT,
    claimTtlMs: 60_000,
    resolveSession: (runId) => Promise.resolve(session(runId)),
    idempotencyKeyFor: (runId) => `batch-prisma:${runId}`,
    workerIdPrefix: "worker-batch-prisma",
  });

  assert.equal(result.dispatched, 2);
  assert.equal(result.completed, 2);
  assert.equal(executor.calls.length, 2);
});

// ------------------------------------------------------- paridade

test("paridade comportamental: mesmo lote produz o mesmo resumo nos dois stores", async () => {
  const stores: Record<string, SyntheticRunStore> = {
    memoria: new InMemorySyntheticRunStore(),
    prisma: (() => {
      installFakeSyntheticRunPrisma();
      return new PrismaSyntheticRunStore();
    })(),
  };

  const summaries: Record<string, unknown> = {};
  for (const [name, store] of Object.entries(stores)) {
    const runIdA = `run-paridade-batch-${name}-a`;
    const runIdB = `run-paridade-batch-${name}-b`;
    await store.create({ run: makeRun(runIdA), idempotencyKey: `idem-${runIdA}`, at: AT });
    await store.create({ run: makeRun(runIdB), idempotencyKey: `idem-${runIdB}`, at: AT });

    const executor = new AlwaysSucceedExecutor();
    const result = await dispatchSyntheticBatch({
      store,
      executor,
      maxRuns: 2,
      maxConcurrency: 2,
      at: AT,
      deadlineAt: FAR_DEADLINE,
      now: () => AT,
      claimTtlMs: 60_000,
      resolveSession: (runId) => Promise.resolve(session(runId)),
      idempotencyKeyFor: (runId) => `batch-paridade:${runId}`,
      workerIdPrefix: "worker-paridade",
    });

    summaries[name] = {
      stopReason: result.stopReason,
      dispatched: result.dispatched,
      completed: result.completed,
      conflicted: result.conflicted,
      noWork: result.noWork,
      interrupted: result.interrupted,
      outcomes: result.results.map((r) => r.outcome).sort(),
      executorCalls: executor.calls.length,
    };
  }

  assert.deepEqual(summaries.memoria, summaries.prisma);
});
