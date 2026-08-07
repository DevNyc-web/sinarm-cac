/**
 * Worker sintético de execução única contra `PrismaSyntheticRunStore`
 * (fake dedicado) — prova que o worker depende só da interface
 * `SyntheticRunStore`, sem UM worker por adaptador. A matriz completa de
 * comportamento está em `syntheticSingleStepWorker.test.ts`; aqui só a
 * paridade e algumas provas-chave repetidas contra o Prisma.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSyntheticRun, type SyntheticAutomationRun, type SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { PrismaSyntheticRunStore } from "../../../src/server/automation/synthetic/store/prismaSyntheticRunStore";
import { installFakeSyntheticRunPrisma } from "./testSyntheticRunPrisma";
import { runSyntheticWorkerOnce } from "../../../src/server/automation/synthetic/worker/syntheticSingleStepWorker";
import type { SyntheticRunStore } from "../../../src/server/automation/synthetic/store/syntheticRunStore";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionOutcome,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../../../src/server/automation/synthetic/playwright/syntheticStepExecutor";

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_worker_prisma_0001",
    processId: "proc-worker-prisma-0001",
    actorId: "actor-worker-prisma-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-11T10:10:00.000Z",
    issuedAt: "2026-08-11T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-worker-prisma-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-worker-prisma-0001",
    allowedSyntheticProcessCode: "PROT-FICT-WORKERPRISMA-0001",
    ...overrides,
  };
}

const ONE_STEP: readonly SyntheticRunStep[] = [
  { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" },
];

function makeRun(runId: string, sessionOverrides: Partial<SyntheticSessionContract> = {}): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(sessionOverrides),
    plan: { planId: "plan-worker-prisma-0001", version: "1.0.0", allowedSyntheticData: [], steps: ONE_STEP },
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.run;
}

class ScriptedExecutor implements SyntheticStepExecutor {
  calls: SyntheticStepExecutionInput[] = [];
  private readonly script: readonly SyntheticStepExecutionOutcome[];
  private index = 0;
  constructor(script: readonly SyntheticStepExecutionOutcome[] = []) {
    this.script = script;
  }
  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    this.calls.push(input);
    const outcome = this.script[this.index] ?? "SUCCESS";
    this.index += 1;
    return { outcome, stepId: input.stepId, detail: `fake:${outcome}`, capturedProtocol: null };
  }
}

const T0 = "2026-08-11T10:00:01.000Z";
const TTL = 60_000;

test("PrismaSyntheticRunStore: run sintético é processado ponta a ponta pelo worker", async () => {
  installFakeSyntheticRunPrisma();
  const store = new PrismaSyntheticRunStore();
  const run = makeRun("run-worker-prisma-0001");
  await store.create({ run, idempotencyKey: "idem-worker-prisma-0001", at: T0 });

  const executor = new ScriptedExecutor(["SUCCESS"]);
  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "RUN_COMPLETED");
  assert.equal(executor.calls.length, 1);
  assert.ok(result.run?.result?.syntheticProtocol?.startsWith("PROT-FICT-"));
});

test("PrismaSyntheticRunStore: sem run elegível devolve NO_RUN_AVAILABLE sem chamar o executor", async () => {
  installFakeSyntheticRunPrisma();
  const store = new PrismaSyntheticRunStore();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "NO_RUN_AVAILABLE");
  assert.equal(executor.calls.length, 0);
});

test("PrismaSyntheticRunStore: repetir a mesma idempotencyKey não duplica nem chama o executor de novo", async () => {
  installFakeSyntheticRunPrisma();
  const store = new PrismaSyntheticRunStore();
  const run = makeRun("run-worker-prisma-idem");
  await store.create({ run, idempotencyKey: "idem-worker-prisma-idem", at: T0 });

  const executor = new ScriptedExecutor(["SUCCESS"]);
  const first = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "unica-chave" });
  assert.equal(first.outcome, "RUN_COMPLETED");

  const second = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "unica-chave" });
  assert.equal(executor.calls.length, 1, "run já terminal: nem tenta de novo");
  assert.equal(second.outcome, "NO_RUN_AVAILABLE");
});

// ------------------------------------------------------- 26. paridade

test("paridade comportamental: a mesma sequência produz o mesmo resultado nos dois stores", async () => {
  const stores: Record<string, SyntheticRunStore> = {
    memoria: new InMemorySyntheticRunStore(),
    prisma: (() => {
      installFakeSyntheticRunPrisma();
      return new PrismaSyntheticRunStore();
    })(),
  };

  const outcomes: Record<string, unknown> = {};
  for (const [name, store] of Object.entries(stores)) {
    const run = makeRun(`run-paridade-worker-${name}`);
    await store.create({ run, idempotencyKey: `idem-paridade-worker-${name}`, at: T0 });

    const executor = new ScriptedExecutor(["SUCCESS"]);
    const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

    outcomes[name] = {
      outcome: result.outcome,
      runState: result.run?.runState,
      version: result.run?.version,
      claim: result.run?.claim,
      protocolPrefix: result.run?.result?.syntheticProtocol?.slice(0, 10),
      executorCalls: executor.calls.length,
    };
  }

  assert.deepEqual(outcomes.memoria, outcomes.prisma);
});
