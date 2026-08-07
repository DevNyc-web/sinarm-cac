/**
 * Runner local (`localSyntheticRunner.ts`) — comportamento de ORQUESTRAÇÃO,
 * sem navegador real: usa um `SyntheticStepExecutor` FAKE, roteirizado por
 * chamada. O comportamento do coordenador puro já está coberto em
 * `syntheticRunCoordinator.test.ts`; aqui o que importa é a TRADUÇÃO entre o
 * resultado do executor e a chamada ao coordenador, e que o executor nunca
 * seja chamado quando o run não pode prosseguir.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSyntheticRun,
  type SyntheticAutomationRun,
  type SyntheticRunPlan,
  type SyntheticRunStep,
} from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import { runNextSyntheticStepLocally } from "../../../src/server/automation/synthetic/playwright/localSyntheticRunner";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionResult,
  SyntheticStepExecutionOutcome,
  SyntheticStepExecutor,
} from "../../../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const T1 = "2026-08-07T10:01:00.000Z";
const T2 = "2026-08-07T10:02:00.000Z";
const T3 = "2026-08-07T10:03:00.000Z";
const T4 = "2026-08-07T10:04:00.000Z";

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_runner_lab_0001",
    processId: "proc-runner-lab-0001",
    actorId: "actor-runner-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-07T10:30:00.000Z",
    issuedAt: "2026-08-07T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-runner-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-runner-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-RUNNER-0001",
    ...overrides,
  };
}

function step(overrides: Partial<SyntheticRunStep> = {}): SyntheticRunStep {
  return {
    stepId: "step-1",
    type: "VALIDATE_INPUT",
    description: "validar dados sintéticos",
    expectedResult: "dados fictícios validados",
    ...overrides,
  };
}

const FOUR_STEPS: readonly SyntheticRunStep[] = [
  step({ stepId: "step-1", type: "VALIDATE_INPUT" }),
  step({ stepId: "step-2", type: "OPEN_FORM", description: "abrir formulário fictício" }),
  step({ stepId: "step-3", type: "FILL_FORM", description: "preencher dados fictícios" }),
  step({ stepId: "step-4", type: "CONFIRM_RESULT", description: "confirmar resultado fictício" }),
];

function plan(steps: readonly SyntheticRunStep[]): SyntheticRunPlan {
  return { planId: "plan-runner-0001", version: "1.0.0", allowedSyntheticData: [], steps };
}

function createRun(steps: readonly SyntheticRunStep[] = FOUR_STEPS): SyntheticAutomationRun {
  const result = createSyntheticRun({ runId: "run-runner-0001", session: session(), plan: plan(steps) });
  assert.equal(result.ok, true, "fixture de teste deveria criar o run");
  if (!result.ok) throw new Error("unreachable");
  return result.run;
}

/** Executor fake, roteirizado: devolve os outcomes na ordem das chamadas. */
class ScriptedExecutor implements SyntheticStepExecutor {
  calls: SyntheticStepExecutionInput[] = [];
  private readonly script: readonly SyntheticStepExecutionOutcome[];
  private index = 0;

  constructor(script: readonly SyntheticStepExecutionOutcome[]) {
    this.script = script;
  }

  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    this.calls.push(input);
    const outcome = this.script[this.index] ?? "SUCCESS";
    this.index += 1;
    return {
      outcome,
      stepId: input.stepId,
      detail: `outcome fake: ${outcome}`,
      capturedProtocol: outcome === "SUCCESS" && input.type === "CONFIRM_RESULT" ? input.allowedSyntheticProcessCode : null,
    };
  }
}

// -------------------------------------------------- 1/2/3/4. quatro etapas

test("as quatro etapas executam em ordem e o coordenador avança após cada sucesso", async () => {
  const run = createRun();
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);

  let current = run;
  const seenStepIds: string[] = [];
  for (const at of [T1, T2, T3, T4]) {
    const result = await runNextSyntheticStepLocally({ run: current, executor, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    current = result.run;
    seenStepIds.push(current.completedSteps[current.completedSteps.length - 1]!.step.stepId);
  }

  assert.deepEqual(seenStepIds, ["step-1", "step-2", "step-3", "step-4"]);
  assert.equal(
    executor.calls.map((c) => c.stepId).join(","),
    "step-1,step-2,step-3,step-4",
  );
});

test("a fila termina corretamente e o run conclui com protocolo sintético", async () => {
  const run = createRun();
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);

  let current = run;
  for (const at of [T1, T2, T3, T4]) {
    const result = await runNextSyntheticStepLocally({ run: current, executor, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    current = result.run;
  }

  assert.equal(current.state, "COMPLETED");
  assert.equal(current.pendingSteps.length, 0);
  assert.equal(current.result?.outcome, "SUCCESS");
  assert.equal(current.result?.syntheticProtocol, "PROT-FICT-RUNNER-0001");
});

test("protocolo fictício só é aceito na conclusão do último passo — falha intermediária não gera protocolo", async () => {
  const run = createRun();
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "TIMEOUT", "SUCCESS"]);

  let current = run;
  for (const at of [T1, T2, T3]) {
    const result = await runNextSyntheticStepLocally({ run: current, executor, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    current = result.run;
  }

  assert.equal(current.state, "FAILED");
  assert.equal(current.result?.syntheticProtocol, null);
  assert.equal(current.result?.outcome, "FAILURE");
});

// -------------------------------------------------------------- 12/13. captcha

test("CAPTCHA_DETECTED do executor leva o run a WAITING_HUMAN, sem tentativa de bypass", async () => {
  const run = createRun();
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "CAPTCHA_DETECTED"]);

  let current = run;
  for (const at of [T1, T2, T3, T4]) {
    const result = await runNextSyntheticStepLocally({ run: current, executor, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    current = result.run;
  }

  assert.equal(current.state, "WAITING_HUMAN");
  assert.equal(current.humanFallbackRequired, true);

  // Nenhuma tentativa automática de resolver: uma nova chamada não executa o executor de novo.
  const callsBefore = executor.calls.length;
  const again = await runNextSyntheticStepLocally({ run: current, executor, at: T4 });
  assert.equal(again.ok, false);
  assert.equal(executor.calls.length, callsBefore, "run bloqueado não pode chamar o executor de novo");
});

// -------------------------------------------------------------- 14/15. timeout

test("TIMEOUT do executor interrompe o run tipado, sem avançar a fila", async () => {
  const run = createRun();
  const executor = new ScriptedExecutor(["TIMEOUT"]);

  const result = await runNextSyntheticStepLocally({ run, executor, at: T1 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.state, "FAILED");
  assert.equal(result.run.pendingSteps.length, run.pendingSteps.length, "timeout não avança a fila");
  assert.equal(result.run.result?.syntheticProtocol, null);
});

// -------------------------------------------------------- 21/22. sem pular/repetir

test("a API não permite escolher etapa: sempre a cabeça da fila, nunca pula nem repete", async () => {
  const run = createRun();
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);

  let current = run;
  for (const at of [T1, T2, T3, T4]) {
    const result = await runNextSyntheticStepLocally({ run: current, executor, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    current = result.run;
  }

  const orderedByExecutor = executor.calls.map((c) => c.stepId);
  assert.deepEqual(orderedByExecutor, ["step-1", "step-2", "step-3", "step-4"]);
  assert.equal(new Set(orderedByExecutor).size, 4);
});

// -------------------------------------------------------- 23. terminal não executa

test("run terminal recusa continuar SEM chamar o executor (não abre navegador à toa)", async () => {
  const run = createRun([step()]);
  const executor = new ScriptedExecutor(["SUCCESS"]);

  const completed = await runNextSyntheticStepLocally({ run, executor, at: T1 });
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.run.state, "COMPLETED");

  const callsBefore = executor.calls.length;
  const again = await runNextSyntheticStepLocally({ run: completed.run, executor, at: T2 });
  assert.equal(again.ok, false);
  if (again.ok) return;
  assert.deepEqual(again.violations.map((v) => v.code), ["RUN_TERMINAL_NO_CONTINUE"]);
  assert.equal(executor.calls.length, callsBefore, "run terminal não pode chamar o executor Playwright");
});

// -------------------------------------------------------------- 24. sem protocolo em falha

test("falha do executor nunca produz protocolo sintético", async () => {
  for (const outcome of ["TIMEOUT", "PAGE_MISMATCH", "STEP_UNAVAILABLE", "LOCAL_NAVIGATION_BLOCKED"] as const) {
    const run = createRun();
    const executor = new ScriptedExecutor([outcome]);
    const result = await runNextSyntheticStepLocally({ run, executor, at: T1 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.run.result?.syntheticProtocol, null, `outcome ${outcome} não pode gerar protocolo`);
  }
});

// ------------------------------------------------------------ mapeamento

test("cada desfecho do executor mapeia para uma falha sintética já existente do domínio", async () => {
  const expectations: Record<string, string> = {
    TIMEOUT: "TIMEOUT",
    PAGE_MISMATCH: "INVALID_EVIDENCE",
    STEP_UNAVAILABLE: "STEP_UNAVAILABLE",
    LOCAL_NAVIGATION_BLOCKED: "EXTERNAL_URL",
  };

  for (const [outcome, expectedFailureMention] of Object.entries(expectations)) {
    const run = createRun();
    const executor = new ScriptedExecutor([outcome as SyntheticStepExecutionOutcome]);
    const result = await runNextSyntheticStepLocally({ run, executor, at: T1 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const lastEvidence = result.run.evidence[result.run.evidence.length - 1];
    assert.ok(
      lastEvidence?.outcome.includes(expectedFailureMention),
      `esperava menção a ${expectedFailureMention} na evidência de ${outcome}, veio "${lastEvidence?.outcome}"`,
    );
  }
});
