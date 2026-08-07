/**
 * Worker sintético de execução única (`syntheticSingleStepWorker.ts`) — usa
 * `InMemorySyntheticRunStore` e um `SyntheticStepExecutor` FAKE, com contador
 * de chamadas. A paridade com `PrismaSyntheticRunStore` está em
 * `syntheticSingleStepWorkerPrisma.test.ts`.
 *
 * Não repete a matriz completa de `syntheticStoredRunExecutor.test.ts` nem
 * de `syntheticRunCoordinator.test.ts` — só o que é NOVO aqui: escolha do
 * run elegível, tradução de resultado e o "no máximo um run/uma etapa".
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createSyntheticRun, type SyntheticAutomationRun, type SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { runSyntheticWorkerOnce } from "../../../src/server/automation/synthetic/worker/syntheticSingleStepWorker";
import type { SyntheticRunStore, SyntheticRunStoreViolation } from "../../../src/server/automation/synthetic/store/syntheticRunStore";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionOutcome,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../../../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const SOURCE_PATH = "src/server/automation/synthetic/worker/syntheticSingleStepWorker.ts";
function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_worker_lab_0001",
    processId: "proc-worker-lab-0001",
    actorId: "actor-worker-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-11T10:10:00.000Z",
    issuedAt: "2026-08-11T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-worker-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-worker-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-WORKER-0001",
    ...overrides,
  };
}

const TWO_STEPS: readonly SyntheticRunStep[] = [
  { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" },
  { stepId: "step-2", type: "OPEN_FORM", description: "abrir formulário fictício", expectedResult: "ok" },
];

function makeRun(runId: string, sessionOverrides: Partial<SyntheticSessionContract> = {}, steps: readonly SyntheticRunStep[] = TWO_STEPS): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(sessionOverrides),
    plan: { planId: "plan-worker-0001", version: "1.0.0", allowedSyntheticData: [], steps },
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

/** Mesma técnica de `syntheticStoredRunExecutor.test.ts`: injeta uma escrita concorrente real entre leitura e save do worker. */
class RaceInjectingStore implements SyntheticRunStore {
  private getByIdCallsForTarget = 0;
  constructor(
    private readonly inner: SyntheticRunStore,
    private readonly targetRunId: string,
    private readonly conflictingRun: SyntheticAutomationRun,
    private readonly conflictAt: string,
  ) {}
  create = (input: Parameters<SyntheticRunStore["create"]>[0]) => this.inner.create(input);
  async getById(runId: string) {
    const snapshot = await this.inner.getById(runId);
    if (runId === this.targetRunId && snapshot !== null) {
      this.getByIdCallsForTarget += 1;
      if (this.getByIdCallsForTarget === 2) {
        await this.inner.save({ runId, expectedVersion: snapshot.version, run: this.conflictingRun, at: this.conflictAt, idempotencyKey: "escritor-concorrente" });
      }
    }
    return snapshot;
  }
  save = (input: Parameters<SyntheticRunStore["save"]>[0]) => this.inner.save(input);
  claimNext = (input: Parameters<SyntheticRunStore["claimNext"]>[0]) => this.inner.claimNext(input);
  renewClaim = (input: Parameters<SyntheticRunStore["renewClaim"]>[0]) => this.inner.renewClaim(input);
  releaseClaim = (input: Parameters<SyntheticRunStore["releaseClaim"]>[0]) => this.inner.releaseClaim(input);
  completeClaim = (input: Parameters<SyntheticRunStore["completeClaim"]>[0]) => this.inner.completeClaim(input);
  listRecoverable = (input: Parameters<SyntheticRunStore["listRecoverable"]>[0]) => this.inner.listRecoverable(input);
}

const T0 = "2026-08-11T10:00:01.000Z";
const T1 = "2026-08-11T10:00:02.000Z";
const TTL = 60_000;

async function seeded(runId = "run-worker-0001", sessionOverrides: Partial<SyntheticSessionContract> = {}, steps: readonly SyntheticRunStep[] = TWO_STEPS) {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun(runId, sessionOverrides, steps);
  await store.create({ run, idempotencyKey: `idem-${runId}`, at: T0 });
  return { store, run };
}

// -------------------------------------------------------------- 1. sem run

test("nenhum run disponível: NO_RUN_AVAILABLE, executor nunca chamado", async () => {
  const store = new InMemorySyntheticRunStore();
  const executor = new ScriptedExecutor();

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "NO_RUN_AVAILABLE");
  assert.equal(result.runId, null);
  assert.equal(executor.calls.length, 0);
});

// --------------------------------------------------- 2/3/4/5. um run, uma etapa

test("exatamente um run e uma etapa processados; executor chamado uma vez; o segundo run elegível fica intacto", async () => {
  const store = new InMemorySyntheticRunStore();
  const runA = makeRun("run-worker-a");
  const runB = makeRun("run-worker-b");
  await store.create({ run: runA, idempotencyKey: "idem-a", at: T0 });
  await store.create({ run: runB, idempotencyKey: "idem-b", at: T0 });

  const executor = new ScriptedExecutor(["SUCCESS"]);
  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "STEP_COMPLETED");
  assert.equal(executor.calls.length, 1, "executor chamado uma única vez");
  assert.equal(result.run?.completedSteps.length, 1, "exatamente uma etapa executada");

  const untouched = await store.getById(runB.runId) ?? (await store.getById(runA.runId));
  const otherRunId = result.runId === runA.runId ? runB.runId : runA.runId;
  const other = await store.getById(otherRunId);
  assert.equal(other?.version, 1, "o outro run elegível não foi tocado nesta chamada");
  void untouched;
});

// ------------------------------------------------------------ 6/7. claim

test("claim é obtido e depois liberado/concluído (fica null no final)", async () => {
  const { store, run } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "STEP_COMPLETED");
  assert.equal(result.run?.claim, null);
  assert.equal(result.run?.attempts, 1, "prova indireta de que um ciclo claim->executar->salvar aconteceu");
  void run;
});

// --------------------------------------------------------------- 8. owner errado

test("run já reservado por outro worker: nem aparece como candidato (NO_RUN_AVAILABLE), executor não chamado", async () => {
  // `listRecoverable` já exclui um run com claim ainda válido — o worker
  // nunca chega a TENTAR reservá-lo. CLAIM_CONFLICT é para a corrida real
  // (ver teste seguinte), não para este caso, que a busca já resolve sozinha.
  const { store, run } = await seeded();
  await store.claimNext({ runId: run.runId, workerId: "worker-outro", at: T0, ttlMs: TTL });

  const executor = new ScriptedExecutor(["SUCCESS"]);
  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: "2026-08-11T10:00:05.000Z", claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "NO_RUN_AVAILABLE");
  assert.equal(executor.calls.length, 0);
});

test("corrida real entre dois workers no mesmo run: exatamente um processa, o outro recebe CLAIM_CONFLICT", async () => {
  const { store } = await seeded("run-worker-corrida");
  const executorA = new ScriptedExecutor(["SUCCESS"]);
  const executorB = new ScriptedExecutor(["SUCCESS"]);

  const [resultA, resultB] = await Promise.all([
    runSyntheticWorkerOnce({ store, executor: executorA, workerId: "worker-a", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-a" }),
    runSyntheticWorkerOnce({ store, executor: executorB, workerId: "worker-b", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-b" }),
  ]);

  const outcomes = [resultA.outcome, resultB.outcome].sort();
  assert.deepEqual(outcomes, ["CLAIM_CONFLICT", "STEP_COMPLETED"]);
  assert.equal(executorA.calls.length + executorB.calls.length, 1, "só o vencedor chega a chamar o executor");
});

// -------------------------------------------------------------- 9. claim expirado

test("claim expirado de outro worker é substituído — o worker processa normalmente", async () => {
  const { store, run } = await seeded();
  await store.claimNext({ runId: run.runId, workerId: "worker-antigo", at: T0, ttlMs: 1_000 });

  const executor = new ScriptedExecutor(["SUCCESS"]);
  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-novo", session: session(), at: "2026-08-11T10:00:03.000Z", claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "STEP_COMPLETED");
  assert.equal(executor.calls.length, 1);
});

// ----------------------------------------------------- 10/11/12. sessão viva

test("sessão ausente: SESSION_REQUIRED, nada é tocado", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: undefined, at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "SESSION_REQUIRED");
  assert.equal(result.run, null);
  assert.equal(executor.calls.length, 0);

  const stored = await store.getById("run-worker-0001");
  assert.equal(stored?.claim, null, "nenhum claim foi tentado");
});

test("correlação incompatível: SESSION_MISMATCH, executor não chamado", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await runSyntheticWorkerOnce({
    store, executor, workerId: "worker-1", session: session({ auditCorrelationId: "corr-outra-sessao" }), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1",
  });

  assert.equal(result.outcome, "SESSION_MISMATCH");
  assert.equal(executor.calls.length, 0);
});

test("sessão/handle expirado no relógio injetado: RUN_EXPIRED, sem renovar", async () => {
  const { store, run } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);
  const expiresBefore = run.session.expiresAt;

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: expiresBefore, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "RUN_EXPIRED");
  assert.equal(result.run?.sessionState, "EXPIRED");
  assert.equal(result.run?.result?.syntheticProtocol, null);
});

// -------------------------------------------------------- 13/14. versão

test("conflito de versão: VERSION_CONFLICT, sem reexecutar (executor chamado só uma vez, nada persistido)", async () => {
  const { store: inner, run } = await seeded();
  const store = new RaceInjectingStore(inner, run.runId, run, T1);
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "VERSION_CONFLICT");
  assert.equal(executor.calls.length, 1, "a etapa RODOU (o conflito só aparece no save)");

  const stored = await inner.getById(run.runId);
  assert.equal(stored?.completedSteps.length, 0, "nada da execução conflitante foi persistido");
  assert.equal(stored?.claim, null, "claim foi liberado após o conflito");
});

// --------------------------------------------------- 15/16/17/18. idempotência

test("mesma idempotencyKey não duplica evento/evidência/protocolo nem chama o executor de novo", async () => {
  // Plano de 2 etapas: depois da 1ª, o run continua RUNNING (elegível de
  // novo) — é o que permite provar que uma SEGUNDA chamada com a MESMA
  // chave encontra o MESMO run e ainda assim não reexecuta nada.
  const { store } = await seeded("run-worker-idem", {}, TWO_STEPS);
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS"]);

  const first = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "unica-chave" });
  assert.equal(first.outcome, "STEP_COMPLETED");
  assert.equal(executor.calls.length, 1);
  assert.equal(first.run?.completedSteps.length, 1);
  assert.equal(first.run?.evidence.length, 1);

  const second = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T1, claimTtlMs: TTL, idempotencyKey: "unica-chave" });

  assert.equal(executor.calls.length, 1, "o executor NUNCA é chamado de novo para a mesma chave");
  assert.equal(second.outcome, "STEP_COMPLETED", "replay: mesmo resultado, sem reexecutar");
  assert.equal(second.run?.completedSteps.length, 1, "etapa não duplica");
  assert.equal(second.run?.events.length, first.run?.events.length, "eventos não duplicam");
  assert.equal(second.run?.evidence.length, first.run?.evidence.length, "evidência não duplica");
  assert.deepEqual(second.run, first.run, "replay devolve exatamente o mesmo registro");
});

test("protocolo não duplica: chave repetida na etapa que conclui o run devolve o MESMO protocolo", async () => {
  const { store } = await seeded("run-worker-idem2", {}, [TWO_STEPS[0]!]);
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const first = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "chave-unica" });
  assert.equal(first.outcome, "RUN_COMPLETED");
  const protocol = first.run?.result?.syntheticProtocol;
  assert.ok(protocol?.startsWith("PROT-FICT-"));

  // Run já terminal: nem chega a ser escolhido de novo (`listRecoverable` já
  // o filtra) — o protocolo não tem como duplicar porque nada roda de novo.
  const second = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T1, claimTtlMs: TTL, idempotencyKey: "chave-unica" });
  assert.equal(executor.calls.length, 1, "sem nova chamada ao executor");
  assert.equal(second.outcome, "NO_RUN_AVAILABLE", "run terminal não é elegível de novo");
});

// --------------------------------------------------- 19/20. terminal/waiting

test("run já terminal não é escolhido: NO_RUN_AVAILABLE, executor não chamado", async () => {
  const { store, run } = await seeded("run-worker-terminal", {}, [TWO_STEPS[0]!]);
  const setupExecutor = new ScriptedExecutor(["SUCCESS"]);
  const setup = await runSyntheticWorkerOnce({ store, executor: setupExecutor, workerId: "worker-setup", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "setup" });
  assert.equal(setup.outcome, "RUN_COMPLETED");

  const executor = new ScriptedExecutor(["SUCCESS"]);
  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T1, claimTtlMs: TTL, idempotencyKey: "attempt-2" });

  assert.equal(result.outcome, "NO_RUN_AVAILABLE");
  assert.equal(executor.calls.length, 0);
  void run;
});

test("run em WAITING_HUMAN não é escolhido: NO_RUN_AVAILABLE, executor não chamado", async () => {
  const { store } = await seeded("run-worker-waiting");
  const captchaExecutor = new ScriptedExecutor(["CAPTCHA_DETECTED"]);
  const first = await runSyntheticWorkerOnce({ store, executor: captchaExecutor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });
  assert.equal(first.outcome, "WAITING_HUMAN");

  const executor = new ScriptedExecutor(["SUCCESS"]);
  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T1, claimTtlMs: TTL, idempotencyKey: "attempt-2" });

  assert.equal(result.outcome, "NO_RUN_AVAILABLE", "nenhuma etapa seguinte após captcha");
  assert.equal(executor.calls.length, 0);
});

// -------------------------------------------------------- 21. captcha encerra

test("captcha: WAITING_HUMAN, sem bypass, sem etapa seguinte", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["CAPTCHA_DETECTED"]);

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "WAITING_HUMAN");
  assert.equal(result.run?.humanFallbackRequired, true);
  assert.equal(executor.calls.length, 1);

  const serialized = JSON.stringify(result);
  assert.equal(serialized.toLowerCase().includes("resolver"), false);
  assert.equal(serialized.toLowerCase().includes("bypass"), false);
});

// -------------------------------------------------------- 22/24. timeout

test("timeout: RUN_FAILED, sem retry automático, sem protocolo", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["TIMEOUT"]);

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "RUN_FAILED");
  assert.equal(result.run?.result?.syntheticProtocol, null);
  assert.equal(executor.calls.length, 1);
});

// ------------------------------------------------------------- 23. expiração

test("expiração: RUN_EXPIRED, run encerra, sessão não renova", async () => {
  const { store, run } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: run.session.expiresAt, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "RUN_EXPIRED");
  assert.equal(result.run?.result?.syntheticProtocol, null);
});

// ------------------------------------------------------------- 25. versão sobe

test("execução bem-sucedida atualiza a versão do run", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await runSyntheticWorkerOnce({ store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1" });

  assert.equal(result.outcome, "STEP_COMPLETED");
  assert.equal(result.run?.version, 2);
});

// -------------------------------------------------------- 31/32. sem segredo

test("o resultado do worker nunca carrega sessionHandle nem credencial", async () => {
  const { store } = await seeded("run-worker-secreto", { sessionHandle: "sh_worker_secreto_0001" });
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await runSyntheticWorkerOnce({
    store, executor, workerId: "worker-1", session: session({ sessionHandle: "sh_worker_secreto_0001" }), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1",
  });

  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["sh_worker_secreto", "senha", "password", "cookie", "token", "000.000.000-00"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
});

// ---------------------------------------------------- runId opcional (lote)

test("runId opcional mira um run específico, pulando a busca própria (usado pelo despachante em lote)", async () => {
  const store = new InMemorySyntheticRunStore();
  const runA = makeRun("run-worker-target-a");
  const runB = makeRun("run-worker-target-b");
  await store.create({ run: runA, idempotencyKey: "idem-target-a", at: T0 });
  await store.create({ run: runB, idempotencyKey: "idem-target-b", at: T0 });

  const executor = new ScriptedExecutor(["SUCCESS"]);
  const result = await runSyntheticWorkerOnce({
    store, executor, workerId: "worker-1", session: session(), at: T0, claimTtlMs: TTL, idempotencyKey: "attempt-1", runId: runB.runId,
  });

  assert.equal(result.runId, runB.runId, "processou o run indicado, não o primeiro elegível");
  assert.equal(executor.calls.length, 1);

  const other = await store.getById(runA.runId);
  assert.equal(other?.version, 1, "o run NÃO indicado ficou intacto");
});

// -------------------------------------------------------------- estrutural

test("nenhuma variável global mutável, nenhum timer, nenhum polling, nenhuma rede fora do executor", () => {
  const code = sourceCode();
  for (const forbidden of [
    "while (true)",
    "while(true)",
    "setInterval(",
    "setTimeout(",
    "cron",
    "Date.now(",
    "fetch(",
    "http://",
    "https://",
    "@prisma/client",
    "chromium",
    "@playwright/test",
    "phase9",
  ]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
  // Nenhuma variável de módulo mutável: só `export`/`function`/`const` de tipo/constante fechada no topo.
  assert.equal(/^let \w/m.test(code), false, "sem variável de módulo mutável");
});

test("o worker não duplica lógica do coordenador, do runner ou do lifecycle", () => {
  const code = sourceCode();
  assert.ok(code.includes("executeStoredSyntheticStep("));
  assert.ok(code.includes("listRecoverable("));
  for (const forbidden of ["SYNTHETIC_TRANSITIONS", "applySyntheticTransition(", "runNextSyntheticStepLocally(", "canTransition("]) {
    assert.equal(code.includes(forbidden), false, `duplicação de lógica: ${forbidden}`);
  }
});
