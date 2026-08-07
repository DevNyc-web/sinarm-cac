/**
 * Despachante sintético em lote (`syntheticBatchDispatcher.ts`) — usa
 * `InMemorySyntheticRunStore` e um executor fake por chamada. A paridade com
 * `PrismaSyntheticRunStore` está em `syntheticBatchDispatcherPrisma.test.ts`.
 *
 * Não repete a matriz completa do worker (`syntheticSingleStepWorker.test.ts`)
 * nem do store — só o que é NOVO aqui: seleção múltipla, concorrência
 * limitada, deadline, cancelamento e agregação.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createSyntheticRun, executeNextSyntheticStep, type SyntheticAutomationRun, type SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import {
  dispatchSyntheticBatch,
  SYNTHETIC_BATCH_MAX_RUNS_CAP,
} from "../../../src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher";
import type { SyntheticRunStore, SyntheticRunStoreViolation } from "../../../src/server/automation/synthetic/store/syntheticRunStore";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionOutcome,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../../../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const SOURCE_PATH = "src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher.ts";
function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function session(runId: string, overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: `sh_batch_${runId}`,
    processId: `proc-batch-${runId}`,
    actorId: "actor-batch-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-12T10:10:00.000Z",
    issuedAt: "2026-08-12T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: `consent-sintetico-batch-${runId}`,
    handoffState: "CLAIMED",
    auditCorrelationId: `corr-batch-${runId}`,
    allowedSyntheticProcessCode: `PROT-FICT-BATCH-${runId}`,
    ...overrides,
  };
}

const ONE_STEP: readonly SyntheticRunStep[] = [
  { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" },
];

function makeRun(runId: string, sessionOverrides: Partial<SyntheticSessionContract> = {}, steps: readonly SyntheticRunStep[] = ONE_STEP): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(runId, sessionOverrides),
    plan: { planId: `plan-batch-${runId}`, version: "1.0.0", allowedSyntheticData: [], steps },
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

/** Devolve `SUCCESS` sempre, salvo mapeamento explícito por runId. */
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

function defaultResolveSession(runId: string): Promise<unknown> {
  return Promise.resolve(session(runId));
}

function idempotencyKeyForBatch(batchId: string): (runId: string) => string {
  return (runId: string) => `${batchId}:${runId}`;
}

const AT = "2026-08-12T10:00:01.000Z";
const FAR_DEADLINE = "2026-08-12T20:00:00.000Z";
const TTL = 60_000;

function baseInput(store: SyntheticRunStore, overrides: Partial<Parameters<typeof dispatchSyntheticBatch>[0]> = {}) {
  return {
    store,
    executor: new MapExecutor(),
    maxRuns: 3,
    maxConcurrency: 2,
    at: AT,
    deadlineAt: FAR_DEADLINE,
    now: makeClock(AT, 1_000),
    claimTtlMs: TTL,
    resolveSession: defaultResolveSession,
    idempotencyKeyFor: idempotencyKeyForBatch("batch-teste"),
    workerIdPrefix: "worker-batch",
    ...overrides,
  };
}

// -------------------------------------------------------------- 1. lote vazio

test("lote vazio: NO_RUN_AVAILABLE, nada despachado", async () => {
  const store = new InMemorySyntheticRunStore();
  const result = await dispatchSyntheticBatch(baseInput(store));

  assert.equal(result.stopReason, "NO_RUN_AVAILABLE");
  assert.equal(result.dispatched, 0);
  assert.deepEqual(result.results, []);
});

// ----------------------------------------------------------- 2/3. um/múltiplos

test("um run: dispatched=1, completed=1", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1 }));

  assert.equal(result.dispatched, 1);
  assert.equal(result.completed, 1);
  assert.equal(result.stopReason, "LIMIT_REACHED");
});

test("múltiplos runs: todos processados dentro do limite", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3"], AT);

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 3, maxConcurrency: 2 }));

  assert.equal(result.dispatched, 3);
  assert.equal(result.completed, 3);
  assert.equal(result.stopReason, "LIMIT_REACHED");
});

// -------------------------------------------------------------- 4. maxRuns

test("maxRuns respeitado: só os primeiros N candidatos são despachados", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3", "run-4", "run-5"], AT);

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 2, maxConcurrency: 2 }));

  assert.equal(result.dispatched, 2);
  assert.equal(result.stopReason, "LIMIT_REACHED");

  const untouchedIds = ["run-3", "run-4", "run-5"].filter((id) => !result.results.some((r) => r.runId === id));
  assert.equal(untouchedIds.length, 3, "os candidatos não selecionados não foram tocados");
});

// -------------------------------------------------------- 5/7. concorrência real

test("concorrência real nunca ultrapassa maxConcurrency", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3", "run-4"], AT);

  // Executor com atraso REAL (microtask), para forçar sobreposição genuína entre workers.
  class SlowExecutor implements SyntheticStepExecutor {
    async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { outcome: "SUCCESS", stepId: input.stepId, detail: "lento", capturedProtocol: null };
    }
  }

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 4, maxConcurrency: 2, executor: new SlowExecutor() }));

  assert.equal(result.dispatched, 4);
  assert.ok(result.limits.peakConcurrency <= 2, `pico observado: ${result.limits.peakConcurrency}`);
  assert.equal(result.limits.peakConcurrency, 2, "com atraso real, o pico deveria de fato alcançar o limite");
});

// -------------------------------------------------------------- 6. teto interno

test("teto interno: maxRuns acima do teto é configuração inválida", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: SYNTHETIC_BATCH_MAX_RUNS_CAP + 1 }));

  assert.equal(result.stopReason, "INVALID_CONFIGURATION");
  assert.equal(result.dispatched, 0);
});

// --------------------------------------------------------- 8/9/10. identidade

test("workers têm IDs únicos; nenhum run repete; todos os resultados são coletados", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3"], AT);

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 3, maxConcurrency: 3 }));

  const workerIds = result.results.map((r) => r.workerId);
  const runIds = result.results.map((r) => r.runId);
  assert.equal(new Set(workerIds).size, workerIds.length, "workerIds únicos");
  assert.equal(new Set(runIds).size, runIds.length, "cada run aparece uma única vez");
  assert.equal(result.results.length, 3, "todos os resultados coletados");
});

// ------------------------------------------------------- 11/12. sessão isolada

test("ausência de sessão para UM item não derruba o lote", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);

  const result = await dispatchSyntheticBatch(
    baseInput(store, {
      maxRuns: 2,
      maxConcurrency: 2,
      resolveSession: (runId) => Promise.resolve(runId === "run-1" ? null : session(runId)),
    }),
  );

  assert.equal(result.dispatched, 2);
  const item1 = result.results.find((r) => r.runId === "run-1");
  const item2 = result.results.find((r) => r.runId === "run-2");
  assert.equal(item1?.outcome, "SESSION_REQUIRED");
  assert.equal(item2?.outcome, "RUN_COMPLETED");
});

test("sessão com correlação incompatível para UM item não derruba o lote", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);

  const result = await dispatchSyntheticBatch(
    baseInput(store, {
      maxRuns: 2,
      maxConcurrency: 2,
      resolveSession: (runId) => Promise.resolve(runId === "run-1" ? session(runId, { auditCorrelationId: "corr-errada" }) : session(runId)),
    }),
  );

  const item1 = result.results.find((r) => r.runId === "run-1");
  const item2 = result.results.find((r) => r.runId === "run-2");
  assert.equal(item1?.outcome, "SESSION_MISMATCH");
  assert.equal(item2?.outcome, "RUN_COMPLETED");
});

// -------------------------------------------------------- 13/14. captcha/timeout

test("captcha em um item não interrompe os outros", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const executor = new MapExecutor({ "run-1": "CAPTCHA_DETECTED" });

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 2, maxConcurrency: 2, executor }));

  const item1 = result.results.find((r) => r.runId === "run-1");
  const item2 = result.results.find((r) => r.runId === "run-2");
  assert.equal(item1?.outcome, "WAITING_HUMAN");
  assert.equal(item2?.outcome, "RUN_COMPLETED");
  assert.equal(result.dispatched, 2);
});

test("timeout em um item não interrompe os outros", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);
  const executor = new MapExecutor({ "run-1": "TIMEOUT" });

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 2, maxConcurrency: 2, executor }));

  const item1 = result.results.find((r) => r.runId === "run-1");
  const item2 = result.results.find((r) => r.runId === "run-2");
  assert.equal(item1?.outcome, "RUN_FAILED");
  assert.equal(item2?.outcome, "RUN_COMPLETED");
});

// ---------------------------------------------------- 15/16. conflito isolado

test("claim conflitante em um item é isolado, sem derrubar o lote", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);

  // Corrida real: outro worker reserva run-1 ANTES da listRecoverable do
  // lote decidir os candidatos — mas depois que já escolhemos (a seleção é
  // única, no início), então o claim concorrente precisa ser injetado no
  // exato instante em que o worker do lote tenta reservar. Simulado com um
  // wrapper que rouba o claim de run-1 na PRIMEIRA chamada de claimNext.
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

  const result = await dispatchSyntheticBatch(baseInput(new ClaimStealer(store), { maxRuns: 2, maxConcurrency: 2 }));

  // O item já sabe o run-alvo (o despachante selecionou uma vez, no início);
  // o worker mira `run-1` direto, sem buscar de novo — o `claimNext` dele
  // encontra o claim roubado e devolve CLAIM_CONFLICT, isolado do item 2.
  const item1 = result.results.find((r) => r.runId === "run-1");
  const item2 = result.results.find((r) => r.runId === "run-2");
  assert.equal(item1?.outcome, "CLAIM_CONFLICT");
  assert.equal(item2?.outcome, "RUN_COMPLETED");
  assert.equal(result.conflicted, 1);
});

test("conflito de versão em um item é isolado, sem reexecutar", async () => {
  const store = new InMemorySyntheticRunStore();
  const runId = "run-conflito";
  await seedRuns(store, [runId, "run-2"], AT);
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

  const wrapped = new RaceInjectingStore(store);
  const executor = new MapExecutor();
  const result = await dispatchSyntheticBatch(baseInput(wrapped, { maxRuns: 2, maxConcurrency: 1, executor }));

  const conflictItem = result.results.find((r) => r.runId === runId);
  const otherItem = result.results.find((r) => r.runId === "run-2");
  assert.equal(conflictItem?.outcome, "VERSION_CONFLICT");
  assert.equal(otherItem?.outcome, "RUN_COMPLETED");
  assert.equal(executor.calls.filter((c) => c.runId === runId).length, 1, "a etapa rodou uma vez; o conflito só aparece no save");
});

// --------------------------------------------------- 17/18/19. deadline/cancel

test("deadline impede novos workers, mas o item já iniciado conclui com segurança", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3"], AT);

  // Passo grande o bastante para que, depois do 1º item (3 chamadas de
  // `now`), a deadline já tenha passado para o 2º item.
  const clock = makeClock(AT, 1_000);
  const deadlineAt = new Date(Date.parse(AT) + 2_500).toISOString();

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 3, maxConcurrency: 1, now: clock, deadlineAt }));

  assert.equal(result.stopReason, "DEADLINE_REACHED");
  assert.equal(result.dispatched, 1, "só o item já em andamento quando a deadline bateu foi concluído");
  assert.equal(result.results[0]?.outcome, "RUN_COMPLETED", "o item iniciado terminou normalmente, não foi abortado");
});

test("cancelamento (signal) impede novos workers, sem abortar o item em andamento", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3"], AT);

  const signal = { aborted: false };
  const executor = new (class implements SyntheticStepExecutor {
    async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
      // Cancela DEPOIS que o primeiro item já começou a rodar.
      signal.aborted = true;
      return { outcome: "SUCCESS", stepId: input.stepId, detail: "ok", capturedProtocol: null };
    }
  })();

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 3, maxConcurrency: 1, executor, signal }));

  assert.equal(result.stopReason, "CANCELLED");
  assert.equal(result.dispatched, 1);
  assert.equal(result.results[0]?.outcome, "RUN_COMPLETED", "o item em andamento concluiu normalmente");
});

// ------------------------------------------------------ 20. sem claim solto

test("nenhum claim fica ativo depois do lote, mesmo com deadline interrompendo", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2", "run-3"], AT);
  const deadlineAt = new Date(Date.parse(AT) + 2_500).toISOString();

  await dispatchSyntheticBatch(baseInput(store, { maxRuns: 3, maxConcurrency: 1, now: makeClock(AT, 1_000), deadlineAt }));

  for (const runId of ["run-1", "run-2", "run-3"]) {
    const stored = await store.getById(runId);
    assert.equal(stored?.claim, null, `${runId} não pode ter claim solto`);
  }
});

// -------------------------------------------------- 21/22/23. validação de config

test("maxRuns inválido (zero, negativo, não-inteiro) é configuração inválida", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);

  for (const maxRuns of [0, -1, 1.5]) {
    const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns }));
    assert.equal(result.stopReason, "INVALID_CONFIGURATION", `maxRuns=${maxRuns}`);
  }
});

test("maxConcurrency inválido (zero, negativo) é configuração inválida", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);

  for (const maxConcurrency of [0, -1]) {
    const result = await dispatchSyntheticBatch(baseInput(store, { maxConcurrency }));
    assert.equal(result.stopReason, "INVALID_CONFIGURATION", `maxConcurrency=${maxConcurrency}`);
  }
});

test("maxConcurrency maior que maxRuns é normalizado, não rejeitado", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1", "run-2"], AT);

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 2, maxConcurrency: 10 }));

  assert.notEqual(result.stopReason, "INVALID_CONFIGURATION");
  assert.equal(result.limits.effectiveConcurrency, 2);
});

// ----------------------------------------------- 24/25/26/27/28. idempotência do lote

test("mesmo batchId não duplica evento/evidência/protocolo nem rechama o executor", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);
  const executor = new MapExecutor();
  const idempotencyKeyFor = idempotencyKeyForBatch("batch-repetido");

  const first = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1, executor, idempotencyKeyFor }));
  assert.equal(first.completed, 1);
  assert.equal(executor.calls.length, 1);

  const second = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1, executor, idempotencyKeyFor }));

  // Run já concluído: nem aparece mais como candidato — prova, pelo mesmo
  // ângulo do worker, que nada é reexecutado.
  assert.equal(second.stopReason, "NO_RUN_AVAILABLE");
  assert.equal(executor.calls.length, 1, "executor não foi chamado de novo");

  const stored = await store.getById("run-1");
  assert.equal(stored?.completedSteps.length, 1, "uma única etapa concluída");
  // Plano de 1 etapa: a MESMA execução já produz 2 evidências de propósito
  // (STEP_COMPLETED + RUN_COMPLETED, a última etapa fecha o run) — o que a
  // repetição da chave não pode fazer é DOBRAR esse número.
  assert.equal(stored?.evidence.length, 2, "STEP_COMPLETED + RUN_COMPLETED, não duplicados pela repetição");
  assert.ok(stored?.result?.syntheticProtocol?.startsWith("PROT-FICT-"));
});

// --------------------------------------------------------- 29/30. terminal/waiting

test("run terminal e run WAITING_HUMAN não são selecionados para o lote", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-terminal", "run-waiting", "run-elegivel"], AT);

  // leva run-terminal a COMPLETED
  const terminalRun = (await store.getById("run-terminal"))!;
  const fresh = makeRun("run-terminal");
  const step1 = executeNextSyntheticStep({ run: fresh, at: AT });
  assert.equal(step1.ok, true);
  if (!step1.ok) return;
  await store.save({ runId: "run-terminal", expectedVersion: terminalRun.version, run: step1.run, at: AT });

  // leva run-waiting a WAITING_HUMAN (único candidato elegível nesse ponto:
  // run-terminal já saiu, run-elegivel ainda nem foi criado na ordem de inserção)
  const captchaExecutor = new MapExecutor({ "run-waiting": "CAPTCHA_DETECTED" });
  const setup = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1, executor: captchaExecutor }));
  assert.equal(setup.results[0]?.runId, "run-waiting");
  assert.equal(setup.results[0]?.outcome, "WAITING_HUMAN");

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 3, maxConcurrency: 3 }));

  assert.equal(result.results.some((r) => r.runId === "run-terminal"), false);
  assert.equal(result.results.some((r) => r.runId === "run-waiting"), false);
  assert.equal(result.results.some((r) => r.runId === "run-elegivel"), true);
});

// ------------------------------------------------------- 31/32. sem segredo

test("o relatório do lote nunca carrega sessionHandle nem credencial", async () => {
  const store = new InMemorySyntheticRunStore();
  await seedRuns(store, ["run-1"], AT);

  const result = await dispatchSyntheticBatch(baseInput(store, { maxRuns: 1, maxConcurrency: 1 }));

  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["sh_batch_run-1", "sessionhandle", "senha", "password", "cookie", "token", "000.000.000-00"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
});

// -------------------------------------------------------------- estrutural

test("nenhum polling, nenhum timer recorrente, nenhum while(true), nenhum lock global", () => {
  const code = sourceCode();
  for (const forbidden of ["while (true)", "while(true)", "setInterval(", "cron", "Date.now(", "@prisma/client", "chromium", "@playwright/test", "phase9"]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
  assert.equal(/^let \w/m.test(code), false, "sem variável de módulo mutável (lock global)");
});

test("o despachante não duplica lógica do worker, do coordenador ou do lifecycle", () => {
  const code = sourceCode();
  assert.ok(code.includes("runSyntheticWorkerOnce("));
  assert.ok(code.includes("listRecoverable("));
  for (const forbidden of ["SYNTHETIC_TRANSITIONS", "applySyntheticTransition(", "executeStoredSyntheticStep(", "canTransition("]) {
    assert.equal(code.includes(forbidden), false, `duplicação de lógica: ${forbidden}`);
  }
});
