/**
 * Acionador administrativo manual (`manualSyntheticDispatchTrigger.ts`) —
 * integração com política, dispatcher, logger e registro. Não repete a
 * matriz comportamental do dispatcher (`syntheticBatchDispatcher.test.ts`)
 * nem da política (`manualSyntheticDispatchPolicy.test.ts`) — só o que é
 * NOVO aqui: orquestração, replay, logs administrativos, resultado redigido.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createSyntheticRun, type SyntheticAutomationRun, type SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { dispatchSyntheticBatch } from "../../../src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher";
import { InMemorySyntheticEngineLogger } from "../../../src/server/automation/synthetic/observability/inMemorySyntheticEngineLogger";
import { InMemoryManualDispatchRequestRegistry } from "../../../src/server/automation/synthetic/admin/inMemoryManualDispatchRequestRegistry";
import { triggerManualSyntheticDispatch, type ManualSyntheticDispatchInput } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchTrigger";
import { computeManualDispatchRequestFingerprint, type ManualDispatchRequestRegistry, type FinishManualDispatchRequestInput, type FinishManualDispatchRequestResult, type ReleaseManualDispatchRequestInput, type ReleaseManualDispatchRequestResult, type ReserveManualDispatchRequestInput, type ReserveManualDispatchRequestResult } from "../../../src/server/automation/synthetic/admin/manualDispatchRequestRegistry";
import { DEFAULT_MANUAL_DISPATCH_POLICY_CONFIG } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchPolicy";
import type { ManualSyntheticDispatchAdminContext } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchTypes";
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
    sessionHandle: `sh_admin_${runId}`,
    processId: `proc-admin-${runId}`,
    actorId: "actor-admin-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-14T10:10:00.000Z",
    issuedAt: "2026-08-14T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: `consent-sintetico-admin-${runId}`,
    handoffState: "CLAIMED",
    auditCorrelationId: `corr-admin-${runId}`,
    allowedSyntheticProcessCode: `PROT-FICT-ADMIN-${runId}`,
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
    plan: { planId: `plan-admin-${runId}`, version: "1.0.0", allowedSyntheticData: [], steps: ONE_STEP },
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

const AT = "2026-08-14T10:00:01.000Z";
const FAR_DEADLINE = "2026-08-14T20:00:00.000Z";
const TTL = 60_000;

function adminContext(overrides: Partial<ManualSyntheticDispatchAdminContext> = {}): ManualSyntheticDispatchAdminContext {
  return {
    role: "ADMIN",
    environment: "SYNTHETIC_LAB",
    explicitConfirmation: true,
    requestedBy: "admin-teste-trigger",
    ...overrides,
  };
}

function baseInput(store: InMemorySyntheticRunStore, overrides: Partial<ManualSyntheticDispatchInput> = {}): ManualSyntheticDispatchInput {
  return {
    requestId: "req-trigger-0001",
    batchId: "batch-trigger-0001",
    requestedBy: "admin-teste-trigger",
    reason: "verificação administrativa de rotina",
    requestedAt: AT,
    maxRuns: 2,
    maxConcurrency: 2,
    deadlineAt: FAR_DEADLINE,
    claimTtlMs: TTL,
    store,
    executor: new MapExecutor(),
    resolveSession: (runId: string) => Promise.resolve(session(runId)),
    now: makeClock(AT, 1_000),
    context: adminContext(),
    health: "HEALTHY",
    readiness: "READY",
    registry: new InMemoryManualDispatchRequestRegistry(),
    ...overrides,
  };
}

// ---------------------------------------------------------- 20. dispatcher 1x

test("dispatcher é chamado exatamente uma vez por solicitação válida", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const executor = new MapExecutor();

  const result = await triggerManualSyntheticDispatch(baseInput(store, { executor }));

  assert.equal(result.decision, "ALLOWED");
  assert.equal(executor.calls.length, 2, "uma chamada de executor por run, run despachado por uma única chamada ao dispatcher");
});

// -------------------------------------------------------------- 21. lote vazio

test("lote vazio: DISPATCH_EMPTY", async () => {
  const store = new InMemorySyntheticRunStore();
  const result = await triggerManualSyntheticDispatch(baseInput(store));

  assert.equal(result.outcome, "DISPATCH_EMPTY");
  assert.equal(result.batch?.stopReason, "NO_RUN_AVAILABLE");
});

// ------------------------------------------------------------ 22. lote parcial

test("lote parcial: DISPATCH_PARTIAL quando nem tudo conclui", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const executor = new MapExecutor({ "run-1": "TIMEOUT" });

  const result = await triggerManualSyntheticDispatch(baseInput(store, { executor }));

  assert.equal(result.outcome, "DISPATCH_PARTIAL");
  assert.ok(result.warnings.some((w) => w.code === "PARTIAL_BATCH"));
});

// ---------------------------------------------------------- 23. lote concluído

test("lote concluído: DISPATCH_COMPLETED quando tudo conclui com sucesso", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);

  const result = await triggerManualSyntheticDispatch(baseInput(store));

  assert.equal(result.outcome, "DISPATCH_COMPLETED");
  assert.equal(result.batch?.completed, 2);
});

// -------------------------------------------------------------- 24. cancelamento

test("cancelamento: DISPATCH_CANCELLED quando o sinal aborta o lote", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3"], AT);
  const signal = { aborted: false };
  const executor = new (class implements SyntheticStepExecutor {
    async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
      signal.aborted = true;
      return { outcome: "SUCCESS", stepId: input.stepId, detail: "ok", capturedProtocol: null };
    }
  })();

  const result = await triggerManualSyntheticDispatch(baseInput(store, { maxRuns: 3, maxConcurrency: 1, executor, signal }));

  assert.equal(result.outcome, "DISPATCH_CANCELLED");
});

// --------------------------------------------------------- 25. falha inesperada

/**
 * Relógio de controle que lança APENAS na `callIndexToThrow`-ésima chamada
 * (1-based) e funciona normalmente nas demais — simulando uma falha de
 * infraestrutura TRANSIENTE que se manifesta só DENTRO da chamada ao
 * `dispatchSyntheticBatch` (ex.: checagem de deadline), fora de qualquer
 * try/catch dele, sem impedir que o acionador finalize o resultado depois.
 */
function throwingClockOnce(callIndexToThrow: number, startIso: string, stepMs: number): () => string {
  let count = 0;
  let current = Date.parse(startIso);
  return () => {
    count += 1;
    if (count === callIndexToThrow) throw new Error("relógio de controle indisponível — detalhe cru de infraestrutura");
    const value = new Date(current).toISOString();
    current += stepMs;
    return value;
  };
}

test("falha inesperada do dispatcher vira DISPATCH_FAILED redigido, sem stack trace", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);

  const result = await triggerManualSyntheticDispatch(baseInput(store, { now: throwingClockOnce(4, AT, 1_000) }));

  assert.equal(result.outcome, "DISPATCH_FAILED");
  assert.equal(result.decision, "ALLOWED");
  assert.ok(result.warnings.some((w) => w.code === "UNEXPECTED_DISPATCH_FAILURE"));
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("infraestrutura"), false);
  assert.equal(serialized.toLowerCase().includes("stack"), false);
});

// --------------------------------------------------------------- 26/27. replay

test("replay idempotente: mesmo requestId + mesmo payload devolve o resultado anterior sem rodar de novo", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();
  const registry = new InMemoryManualDispatchRequestRegistry();
  const input = baseInput(store, { maxRuns: 1, maxConcurrency: 1, executor, registry });

  const first = await triggerManualSyntheticDispatch(input);
  assert.equal(first.outcome, "DISPATCH_COMPLETED");
  assert.equal(executor.calls.length, 1);

  const second = await triggerManualSyntheticDispatch(input);

  assert.equal(second.outcome, "REQUEST_REPLAYED");
  assert.equal(second.batch?.completed, first.batch?.completed);
  assert.equal(executor.calls.length, 1, "replay não chamou o dispatcher/executor de novo");

  const stored = await store.getById("run-1");
  assert.equal(stored?.completedSteps.length, 1, "nenhuma etapa duplicada pelo replay");
});

// -------------------------------------------------- 28. payload incompatível

test("mesmo requestId com payload incompatível: REQUEST_DENIED (DENIED_DUPLICATE_REQUEST), sem chamar o dispatcher", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const executor = new MapExecutor();
  const registry = new InMemoryManualDispatchRequestRegistry();

  const first = await triggerManualSyntheticDispatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1, executor, registry, requestId: "req-conflito" }));
  assert.equal(first.outcome, "DISPATCH_COMPLETED");
  assert.equal(executor.calls.length, 1);

  const second = await triggerManualSyntheticDispatch(
    baseInput(store, { maxRuns: 2, maxConcurrency: 2, executor, registry, requestId: "req-conflito", batchId: "outro-batch" }),
  );

  assert.equal(second.outcome, "REQUEST_DENIED");
  assert.equal(second.decision, "DENIED_DUPLICATE_REQUEST");
  assert.equal(executor.calls.length, 1, "conflito de payload não chamou o dispatcher de novo");
});

// -------------------------------------------------------------- 29. logs admin

test("logs administrativos são emitidos na ordem: REQUESTED, ALLOWED, STARTED, FINISHED", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const logger = new InMemorySyntheticEngineLogger();

  await triggerManualSyntheticDispatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1, logger }));

  const codes = logger.snapshot().map((e) => e.code);
  assert.equal(codes[0], "MANUAL_DISPATCH_REQUESTED");
  assert.ok(codes.includes("MANUAL_DISPATCH_ALLOWED"));
  assert.ok(codes.includes("MANUAL_DISPATCH_STARTED"));
  assert.equal(codes[codes.length - 1], "MANUAL_DISPATCH_FINISHED");
});

// ------------------------------------------------------------ 30. recusa gera log

test("recusa gera log MANUAL_DISPATCH_DENIED redigido, sem chamar o dispatcher", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();
  const logger = new InMemorySyntheticEngineLogger();

  const result = await triggerManualSyntheticDispatch(
    baseInput(store, { executor, logger, context: adminContext({ explicitConfirmation: false }) }),
  );

  assert.equal(result.outcome, "REQUEST_DENIED");
  assert.equal(result.decision, "DENIED_CONFIRMATION");
  assert.equal(executor.calls.length, 0, "dispatcher nunca chamado numa recusa");
  const denied = logger.snapshot().find((e) => e.code === "MANUAL_DISPATCH_DENIED");
  assert.ok(denied);
  assert.equal(denied!.outcome, "DENIED_CONFIRMATION");
});

// ---------------------------------------------------- 31. falha do logger

test("erro de logger não duplica execução nem causa retry", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();

  class FailingLogger implements SyntheticEngineLogger {
    emitCount = 0;
    emit(_event: SyntheticEngineLogEvent): void {
      this.emitCount += 1;
      throw new Error("logger indisponível");
    }
  }
  const failingLogger = new FailingLogger();

  const result = await triggerManualSyntheticDispatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1, executor, logger: failingLogger }));

  assert.equal(result.outcome, "DISPATCH_COMPLETED");
  assert.equal(executor.calls.length, 1);
  assert.ok(failingLogger.emitCount > 0);
});

// ------------------------------------------ 28. falha ao persistir depois do dispatcher

test("falha ao persistir o resultado depois do dispatcher não reexecuta o lote (RESULT_PERSISTENCE_FAILED)", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();
  const inner = new InMemoryManualDispatchRequestRegistry();

  class FinishFailingRegistry implements ManualDispatchRequestRegistry {
    finishCalls = 0;
    reserve(i: ReserveManualDispatchRequestInput): Promise<ReserveManualDispatchRequestResult> {
      return inner.reserve(i);
    }
    find(requestId: string) {
      return inner.find(requestId);
    }
    async finish(_i: FinishManualDispatchRequestInput): Promise<FinishManualDispatchRequestResult> {
      this.finishCalls += 1;
      throw new Error("banco indisponível no momento de salvar");
    }
    release(i: ReleaseManualDispatchRequestInput): Promise<ReleaseManualDispatchRequestResult> {
      return inner.release(i);
    }
    listRecoverable(at: string) {
      return inner.listRecoverable(at);
    }
    count() {
      return inner.count();
    }
  }
  const registry = new FinishFailingRegistry();

  const result = await triggerManualSyntheticDispatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1, executor, registry }));

  assert.equal(result.outcome, "RESULT_PERSISTENCE_FAILED");
  assert.equal(executor.calls.length, 1, "o dispatcher rodou uma vez — a falha é só na gravação, não reexecuta");
  assert.ok(result.warnings.some((w) => w.code === "RESULT_PERSISTENCE_FAILED"));
  assert.equal(registry.finishCalls, 1, "finish() não foi tentado de novo (sem retry automático)");
});

// ------------------------------------------- 29/30. request interrompido / recovery

test("pedido PENDING com lease vencida gera DENIED_RECOVERY_REQUIRED e NÃO executa o dispatcher sozinho", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();
  const registry = new InMemoryManualDispatchRequestRegistry();

  const requestId = "req-interrompido";
  const requestedBy = "admin-teste-trigger";
  const reason = "verificação administrativa de rotina";
  const fingerprint = computeManualDispatchRequestFingerprint({
    requestId,
    batchId: "batch-trigger-0001",
    role: "ADMIN",
    environment: "SYNTHETIC_LAB",
    explicitConfirmation: true,
    requestedBy,
    reason,
    requestedAt: AT,
    maxRuns: 1,
    maxConcurrency: 1,
    deadlineAt: FAR_DEADLINE,
    policyConfig: DEFAULT_MANUAL_DISPATCH_POLICY_CONFIG,
  });
  // Simula um processo anterior que reservou e nunca voltou: lease com TTL
  // curtíssimo, já vencida no instante em que o novo pedido chega.
  await registry.reserve({ requestId, batchId: "batch-trigger-0001", fingerprint, requestedBy, environment: "SYNTHETIC_LAB", reason, requestedAt: AT, claimedBy: "worker-interrompido", at: AT, leaseTtlMs: 1 });

  // `requestedAt` (domínio/fingerprint) fica IGUAL ao do pedido original —
  // é `now()` (controle) que precisa estar bem depois da lease de 1ms para
  // que `reserve()` a veja como vencida.
  const muchLater = new Date(Date.parse(AT) + 10_000).toISOString();
  const result = await triggerManualSyntheticDispatch(baseInput(store, { requestId, maxRuns: 1, maxConcurrency: 1, executor, registry, now: makeClock(muchLater, 1_000) }));

  assert.equal(result.outcome, "REQUEST_DENIED");
  assert.equal(result.decision, "DENIED_RECOVERY_REQUIRED");
  assert.equal(executor.calls.length, 0, "recuperação NUNCA executa automaticamente");

  const recoverable = await registry.listRecoverable(muchLater);
  assert.ok(recoverable.some((e) => e.requestId === requestId), "o pedido continua classificável como recuperável");
});

// --------------------------------------------------- 7/8. outro processo em execução

test("segunda chamada enquanto a primeira ainda está reservada: REQUEST_DENIED (DENIED_ALREADY_RUNNING)", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const registry = new InMemoryManualDispatchRequestRegistry();
  const requestId = "req-em-execucao";

  const fingerprint = computeManualDispatchRequestFingerprint({
    requestId,
    batchId: "batch-trigger-0001",
    role: "ADMIN",
    environment: "SYNTHETIC_LAB",
    explicitConfirmation: true,
    requestedBy: "admin-teste-trigger",
    reason: "verificação administrativa de rotina",
    requestedAt: AT,
    maxRuns: 1,
    maxConcurrency: 1,
    deadlineAt: FAR_DEADLINE,
    policyConfig: DEFAULT_MANUAL_DISPATCH_POLICY_CONFIG,
  });
  // Reserva ainda VÁLIDA de "outro processo" — simulado reservando por fora, sem concluir.
  await registry.reserve({ requestId, batchId: "batch-trigger-0001", fingerprint, requestedBy: "admin-teste-trigger", environment: "SYNTHETIC_LAB", reason: "verificação administrativa de rotina", requestedAt: AT, claimedBy: "outro-processo", at: AT, leaseTtlMs: TTL });

  const executor = new MapExecutor();
  const result = await triggerManualSyntheticDispatch(baseInput(store, { requestId, maxRuns: 1, maxConcurrency: 1, executor, registry }));

  assert.equal(result.outcome, "REQUEST_DENIED");
  assert.equal(result.decision, "DENIED_ALREADY_RUNNING");
  assert.equal(executor.calls.length, 0);
});

// ------------------------------------------------------ 11. replay não duplica logs

test("replay não duplica os eventos de log do primeiro processamento", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();
  const logger = new InMemorySyntheticEngineLogger();
  const registry = new InMemoryManualDispatchRequestRegistry();

  const input = baseInput(store, { maxRuns: 1, maxConcurrency: 1, executor, logger, registry });
  await triggerManualSyntheticDispatch(input);
  const countAfterFirst = logger.snapshot().length;

  await triggerManualSyntheticDispatch(input);
  const eventsAfterSecond = logger.snapshot();

  assert.equal(eventsAfterSecond.length, countAfterFirst + 2, "só REQUESTED + REPLAYED novos — nada do primeiro processamento se repete");
  assert.equal(eventsAfterSecond[eventsAfterSecond.length - 1]?.code, "MANUAL_DISPATCH_REPLAYED");
  assert.equal(eventsAfterSecond.filter((e) => e.code === "MANUAL_DISPATCH_STARTED").length, 1, "MANUAL_DISPATCH_STARTED não se repete no replay");
});

// ---------------------------------------------------------------- 32/33/34/35. segurança do resultado

test("resultado nunca carrega sessionHandle, credencial, stack trace nem objeto de run completo", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);

  const result = await triggerManualSyntheticDispatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1 }));

  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["sh_admin", "sessionhandle", "senha", "password", "cookie", "token", "stack", "000.000.000-00", "\"plan\"", "pendingsteps", "\"evidence\""]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
});

// -------------------------------------------------------------- estrutural

const TRIGGER_SOURCE_FILES = [
  "src/server/automation/synthetic/admin/manualSyntheticDispatchTrigger.ts",
  "src/server/automation/synthetic/admin/manualSyntheticDispatchPolicy.ts",
  "src/server/automation/synthetic/admin/inMemoryManualDispatchRequestRegistry.ts",
  "src/server/automation/synthetic/admin/manualDispatchRequestRegistry.ts",
  "src/server/automation/synthetic/admin/manualSyntheticDispatchTypes.ts",
];

test("nenhum polling, cron, timer recorrente, rede ou console.* nos módulos administrativos", () => {
  for (const file of TRIGGER_SOURCE_FILES) {
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of ["while (true)", "while(true)", "setInterval(", "cron", "fetch(", "console.log", "console.error", "console.warn", "@prisma/client", "chromium", "@playwright/test"]) {
      assert.equal(code.toLowerCase().includes(forbidden.toLowerCase()), false, `${file} não pode conter ${forbidden}`);
    }
  }
});

test("nenhuma variável de módulo mutável nos módulos administrativos", () => {
  for (const file of TRIGGER_SOURCE_FILES) {
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.equal(/^let \w/m.test(code), false, `${file} não pode ter \`let\` de módulo`);
  }
});

// --------------------------------------------------- 43. dispatcher sem acionador

test("dispatchSyntheticBatch continua funcionando normalmente sem o acionador administrativo", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);

  const result = await dispatchSyntheticBatch({
    store,
    executor: new MapExecutor(),
    maxRuns: 1,
    maxConcurrency: 1,
    at: AT,
    deadlineAt: FAR_DEADLINE,
    now: makeClock(AT, 1_000),
    claimTtlMs: TTL,
    resolveSession: (runId) => Promise.resolve(session(runId)),
    idempotencyKeyFor: (runId) => `direct:${runId}`,
    workerIdPrefix: "worker-direct",
  });

  assert.equal(result.completed, 1);
});

// ------------------------------------------------------------------- 44. Fase 9

test("Fase 9 continua intocada — nenhum módulo administrativo referencia phase9", () => {
  for (const file of TRIGGER_SOURCE_FILES) {
    const code = readFileSync(file, "utf8");
    assert.equal(code.includes("phase9"), false, `${file} não pode referenciar phase9`);
    assert.equal(code.includes("PHASE9_REAL_EXECUTION_ENABLED"), false, `${file} não pode referenciar PHASE9_REAL_EXECUTION_ENABLED`);
  }
});
