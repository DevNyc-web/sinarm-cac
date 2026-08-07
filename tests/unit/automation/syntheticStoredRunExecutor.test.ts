/**
 * Serviço de aplicação `syntheticStoredRunExecutor.ts` — liga
 * store → claim → runner existente → save → conclui/libera claim. Usa um
 * `SyntheticStepExecutor` FAKE (sem navegador real); o caminho com Playwright
 * de verdade já está coberto em `localSyntheticRunner.test.ts` e nos specs
 * Playwright.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createSyntheticRun, type SyntheticAutomationRun, type SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { executeStoredSyntheticStep } from "../../../src/server/automation/synthetic/store/syntheticStoredRunExecutor";
import type {
  ClaimNextInput,
  ClaimResult,
  CreateStoredRunInput,
  CreateStoredRunResult,
  ListRecoverableInput,
  ReleaseClaimInput,
  ReleaseClaimResult,
  RenewClaimInput,
  SaveStoredRunInput,
  SaveStoredRunResult,
  StoredSyntheticRun,
  SyntheticRunStore,
} from "../../../src/server/automation/synthetic/store/syntheticRunStore";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionOutcome,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../../../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const SOURCE_PATH = "src/server/automation/synthetic/store/syntheticStoredRunExecutor.ts";
function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_exec_lab_0001",
    processId: "proc-exec-lab-0001",
    actorId: "actor-exec-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-09T23:59:59.000Z",
    issuedAt: "2026-08-09T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-exec-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-exec-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-EXEC-0001",
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
    plan: { planId: "plan-exec-0001", version: "1.0.0", allowedSyntheticData: [], steps },
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

/**
 * Wrapper que injeta uma escrita CONCORRENTE real entre a leitura do serviço
 * ("carregar registro") e o `save` dele — a 2a chamada a `getById` para o run
 * alvo devolve o snapshot ANTIGO (como o serviço veria de fato), mas primeiro
 * aplica um `save` de outro "escritor" no store de verdade, avançando a
 * versão por baixo. Assim o VERSION_CONFLICT é o resultado real do `save`
 * do serviço, não um valor fabricado à mão.
 */
class RaceInjectingStore implements SyntheticRunStore {
  private getByIdCallsForTarget = 0;
  constructor(
    private readonly inner: SyntheticRunStore,
    private readonly targetRunId: string,
    private readonly conflictingRun: SyntheticAutomationRun,
    private readonly conflictAt: string,
  ) {}

  async create(input: CreateStoredRunInput): Promise<CreateStoredRunResult> {
    return this.inner.create(input);
  }

  async getById(runId: string): Promise<StoredSyntheticRun | null> {
    const snapshot = await this.inner.getById(runId);
    if (runId === this.targetRunId && snapshot !== null) {
      this.getByIdCallsForTarget += 1;
      if (this.getByIdCallsForTarget === 2) {
        await this.inner.save({
          runId,
          expectedVersion: snapshot.version,
          run: this.conflictingRun,
          at: this.conflictAt,
          idempotencyKey: "escritor-concorrente",
        });
      }
    }
    return snapshot;
  }

  async save(input: SaveStoredRunInput): Promise<SaveStoredRunResult> {
    return this.inner.save(input);
  }
  async claimNext(input: ClaimNextInput): Promise<ClaimResult> {
    return this.inner.claimNext(input);
  }
  async renewClaim(input: RenewClaimInput): Promise<ClaimResult> {
    return this.inner.renewClaim(input);
  }
  async releaseClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult> {
    return this.inner.releaseClaim(input);
  }
  async completeClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult> {
    return this.inner.completeClaim(input);
  }
  async listRecoverable(input: ListRecoverableInput): Promise<readonly StoredSyntheticRun[]> {
    return this.inner.listRecoverable(input);
  }
}

const T0 = "2026-08-09T11:00:00.000Z";
const T1 = "2026-08-09T11:01:00.000Z";
const TTL = 60_000;

async function seeded(
  runId = "run-exec-0001",
  sessionOverrides: Partial<SyntheticSessionContract> = {},
  steps: readonly SyntheticRunStep[] = TWO_STEPS,
) {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun(runId, sessionOverrides, steps);
  await store.create({ run, idempotencyKey: `idem-${runId}`, at: T0 });
  return { store, run };
}

// --------------------------------------------------------- 23. uma etapa

test("executa uma etapa do run armazenado de ponta a ponta", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await executeStoredSyntheticStep({
    store,
    runId: "run-exec-0001",
    workerId: "worker-0001",
    session: session(),
    executor,
    at: T0,
    ttlMs: TTL,
    idempotencyKey: "step-1-attempt",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.runState, "RUNNING");
  assert.equal(result.run.completedSteps.length, 1);
  assert.equal(result.run.pendingSteps.length, 1);
  assert.equal(result.run.version, 2);
  assert.equal(result.run.claim, null, "claim concluído é liberado");
  assert.equal(executor.calls.length, 1);
});

// -------------------------------------------------------- 24/25. evidência/evento

test("evidência e evento são salvos exatamente uma vez por etapa", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await executeStoredSyntheticStep({
    store, runId: "run-exec-0001", workerId: "worker-0001", session: session(), executor, at: T0, ttlMs: TTL, idempotencyKey: "step-1-attempt",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.run.evidence.length, 1);
  // primeira etapa: step_started (transição) + step_completed
  assert.equal(result.run.events.length, 2);
});

// ---------------------------------------------------- 26. repetição não duplica

test("repetir a mesma idempotencyKey não duplica evento, evidência, etapa nem chama o executor de novo", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const first = await executeStoredSyntheticStep({
    store, runId: "run-exec-0001", workerId: "worker-0001", session: session(), executor, at: T0, ttlMs: TTL, idempotencyKey: "step-1-attempt",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const second = await executeStoredSyntheticStep({
    store, runId: "run-exec-0001", workerId: "worker-0001", session: session(), executor, at: T1, ttlMs: TTL, idempotencyKey: "step-1-attempt",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;

  assert.deepEqual(second.run, first.run, "resultado idêntico, sem reaplicar");
  assert.equal(executor.calls.length, 1, "o executor não é chamado de novo na repetição");
});

test("repetir a chave após a ÚLTIMA etapa (run já COMPLETED) ainda devolve o resultado, sem RUN_TERMINAL", async () => {
  const { store } = await seeded("run-exec-single", {}, [TWO_STEPS[0]!]);
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const first = await executeStoredSyntheticStep({
    store, runId: "run-exec-single", workerId: "worker-0001", session: session(), executor, at: T0, ttlMs: TTL, idempotencyKey: "single-attempt",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.run.runState, "COMPLETED");

  const second = await executeStoredSyntheticStep({
    store, runId: "run-exec-single", workerId: "worker-0001", session: session(), executor, at: T1, ttlMs: TTL, idempotencyKey: "single-attempt",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.run.runState, "COMPLETED");
  assert.equal(executor.calls.length, 1, "repetição pós-conclusão não chama o executor");
});

// -------------------------------------------------- 27. conflito de versão

test("conflito de versão não reexecuta a etapa: libera o claim e devolve o conflito", async () => {
  const { store: innerStore, run } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  // Outro "escritor" grava entre a leitura e o save do serviço — a mesma
  // instância de run, só para reafirmar o estado QUEUED com uma versão nova.
  const store = new RaceInjectingStore(innerStore, "run-exec-0001", run, T1);

  const result = await executeStoredSyntheticStep({
    store, runId: "run-exec-0001", workerId: "worker-0001", session: session(), executor, at: T0, ttlMs: TTL, idempotencyKey: "step-1-attempt",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["VERSION_CONFLICT"]);
  assert.equal(executor.calls.length, 1, "a etapa RODOU uma vez (o conflito só aparece no save)");

  const stored = await innerStore.getById("run-exec-0001");
  assert.equal(stored?.claim, null, "claim foi liberado após o conflito");
  assert.equal(stored?.completedSteps.length, 0, "a execução conflitante NÃO foi persistida");
  assert.equal(stored?.version, 2, "só a escrita do outro escritor foi aplicada");
});

// --------------------------------------------------- 28/29/30. executor não chamado

test("executor não é chamado quando não há claim válido disponível (já reservado por outro worker)", async () => {
  const { store } = await seeded();
  await store.claimNext({ runId: "run-exec-0001", workerId: "worker-outro", at: T0, ttlMs: TTL });

  const executor = new ScriptedExecutor(["SUCCESS"]);
  const result = await executeStoredSyntheticStep({
    store, runId: "run-exec-0001", workerId: "worker-0001", session: session(), executor, at: "2026-08-09T11:00:10.000Z", ttlMs: TTL, idempotencyKey: "step-1-attempt",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["CLAIM_ALREADY_ACTIVE"]);
  assert.equal(executor.calls.length, 0);
});

test("executor não é chamado para run terminal", async () => {
  const { store } = await seeded("run-exec-terminal", {}, [TWO_STEPS[0]!]);
  const firstExecutor = new ScriptedExecutor(["SUCCESS"]);
  const first = await executeStoredSyntheticStep({
    store, runId: "run-exec-terminal", workerId: "worker-0001", session: session(), executor: firstExecutor, at: T0, ttlMs: TTL, idempotencyKey: "attempt-1",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.run.runState, "COMPLETED");

  const secondExecutor = new ScriptedExecutor(["SUCCESS"]);
  const second = await executeStoredSyntheticStep({
    store, runId: "run-exec-terminal", workerId: "worker-0001", session: session(), executor: secondExecutor, at: T1, ttlMs: TTL, idempotencyKey: "attempt-2-chave-diferente",
  });

  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.deepEqual(second.violations.map((v) => v.code), ["RUN_TERMINAL"]);
  assert.equal(secondExecutor.calls.length, 0, "run terminal nunca chega a chamar o executor");
});

test("executor não é chamado para WAITING_HUMAN", async () => {
  const { store } = await seeded("run-exec-captcha");
  const captchaExecutor = new ScriptedExecutor(["CAPTCHA_DETECTED"]);
  const first = await executeStoredSyntheticStep({
    store, runId: "run-exec-captcha", workerId: "worker-0001", session: session(), executor: captchaExecutor, at: T0, ttlMs: TTL, idempotencyKey: "attempt-1",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.run.runState, "WAITING_HUMAN");

  const secondExecutor = new ScriptedExecutor(["SUCCESS"]);
  const second = await executeStoredSyntheticStep({
    store, runId: "run-exec-captcha", workerId: "worker-0001", session: session(), executor: secondExecutor, at: T1, ttlMs: TTL, idempotencyKey: "attempt-2",
  });

  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.deepEqual(second.violations.map((v) => v.code), ["RUN_WAITING_HUMAN"]);
  assert.equal(secondExecutor.calls.length, 0);
});

// -------------------------------------------------------------- 31/32. protocolo

test("protocolo nunca duplica: repetir a última etapa devolve o MESMO protocolo, não um novo", async () => {
  const { store } = await seeded("run-exec-protocolo", {}, [TWO_STEPS[0]!]);
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const first = await executeStoredSyntheticStep({
    store, runId: "run-exec-protocolo", workerId: "worker-0001", session: session(), executor, at: T0, ttlMs: TTL, idempotencyKey: "attempt-1",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const protocol1 = first.run.result?.syntheticProtocol;
  assert.ok(protocol1?.startsWith("PROT-FICT-"));

  const second = await executeStoredSyntheticStep({
    store, runId: "run-exec-protocolo", workerId: "worker-0001", session: session(), executor, at: T1, ttlMs: TTL, idempotencyKey: "attempt-1",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.run.result?.syntheticProtocol, protocol1);
});

test("falha nunca produz protocolo através do serviço armazenado", async () => {
  const { store } = await seeded("run-exec-falha");
  const executor = new ScriptedExecutor(["TIMEOUT"]);

  const result = await executeStoredSyntheticStep({
    store, runId: "run-exec-falha", workerId: "worker-0001", session: session(), executor, at: T0, ttlMs: TTL, idempotencyKey: "attempt-1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.runState, "FAILED");
  assert.equal(result.run.result?.syntheticProtocol, null);
});

// -------------------------------------------------------------- outras regras

test("sessão com auditCorrelationId diferente do registro é recusada (SESSION_MISMATCH)", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await executeStoredSyntheticStep({
    store,
    runId: "run-exec-0001",
    workerId: "worker-0001",
    session: session({ auditCorrelationId: "corr-outra-sessao" }),
    executor,
    at: T0,
    ttlMs: TTL,
    idempotencyKey: "step-1-attempt",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["SESSION_MISMATCH"]);
  assert.equal(executor.calls.length, 0);
});

test("idempotencyKey vazia é recusada sem tocar o store", async () => {
  const { store } = await seeded();
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const result = await executeStoredSyntheticStep({
    store, runId: "run-exec-0001", workerId: "worker-0001", session: session(), executor, at: T0, ttlMs: TTL, idempotencyKey: "  ",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["EMPTY_VALUE"]);
  assert.equal(executor.calls.length, 0);
});

// ---------------------------------------------------------------- estrutural

test("o serviço não importa o pacote Playwright nem duplica a máquina de estados", () => {
  const code = sourceCode();
  // Importar o RUNNER (que mora em `playwright/`, por caminho de arquivo) é
  // esperado; importar o PACOTE `@playwright/test` ou tipos de navegador não.
  for (const forbidden of ["@playwright/test", "chromium", "phase9", "@prisma/client", "SYNTHETIC_TRANSITIONS", "applySyntheticTransition(", "Date.now("]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
  assert.ok(code.includes("runNextSyntheticStepLocally("));
});

// -------------------------------------------------- fluxo completo (laboratório)

test("fluxo completo: cria, salva, reserva, executa, salva, recupera, continua e conclui", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun("run-exec-fluxo");
  const created = await store.create({ run, idempotencyKey: "idem-fluxo", at: T0 });
  assert.equal(created.ok, true);

  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS"]);

  const step1 = await executeStoredSyntheticStep({
    store, runId: "run-exec-fluxo", workerId: "worker-lab", session: session(), executor, at: T0, ttlMs: TTL, idempotencyKey: "fluxo-etapa-1",
  });
  assert.equal(step1.ok, true);
  if (!step1.ok) return;
  assert.equal(step1.run.runState, "RUNNING");

  // Simula abandono: reserva expira sem liberação explícita, mas o run
  // continua elegível (recuperação não executa nada sozinha).
  const afterStep1 = await store.getById("run-exec-fluxo");
  assert.equal(afterStep1?.claim, null, "claim já foi concluído pelo próprio serviço");

  const recoverable = await store.listRecoverable({ at: T1 });
  assert.ok(recoverable.some((r) => r.runId === "run-exec-fluxo"));

  const step2 = await executeStoredSyntheticStep({
    store, runId: "run-exec-fluxo", workerId: "worker-lab", session: session(), executor, at: T1, ttlMs: TTL, idempotencyKey: "fluxo-etapa-2",
  });
  assert.equal(step2.ok, true);
  if (!step2.ok) return;

  assert.equal(step2.run.runState, "COMPLETED");
  assert.equal(step2.run.pendingSteps.length, 0);
  assert.ok(step2.run.result?.syntheticProtocol?.startsWith("PROT-FICT-"));

  const finalListing = await store.listRecoverable({ at: "2026-08-09T12:00:00.000Z" });
  assert.equal(finalListing.some((r) => r.runId === "run-exec-fluxo"), false, "run concluído não aparece mais como recuperável");
});
