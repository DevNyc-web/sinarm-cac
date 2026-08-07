/**
 * Harness de alto nível (`syntheticPlaywrightRunHarness.ts`) — plano completo,
 * relatório final e validação, com um `SyntheticStepExecutor` FAKE (sem
 * navegador real). O caminho feliz com Playwright de verdade está no spec
 * `tests/e2e/lab-guia-trafego-playwright-harness.spec.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import type { SyntheticRunPlan, SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import {
  runSyntheticPlaywrightPlan,
  validateSyntheticPlaywrightRunReport,
  type SyntheticPlaywrightRunReport,
} from "../../../src/server/automation/synthetic/playwright/syntheticPlaywrightRunHarness";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionOutcome,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../../../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const SOURCE_PATH = "src/server/automation/synthetic/playwright/syntheticPlaywrightRunHarness.ts";

function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_harness_lab_0001",
    processId: "proc-harness-lab-0001",
    actorId: "actor-harness-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-08T23:59:59.000Z",
    issuedAt: "2026-08-08T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-harness-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-harness-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-HARNESS-0001",
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

function plan(steps: readonly SyntheticRunStep[] = FOUR_STEPS): SyntheticRunPlan {
  return { planId: "plan-harness-0001", version: "1.0.0", allowedSyntheticData: [], steps };
}

function clock(count: number, base = 0): string[] {
  return Array.from({ length: count }, (_, i) => new Date(Date.parse("2026-08-08T11:00:00.000Z") + (base + i) * 1000).toISOString());
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
    return { outcome, stepId: input.stepId, detail: `fake:${outcome}`, capturedProtocol: null };
  }
}

// ---------------------------------------------------------------- sucesso

test("sucesso completo: 4 etapas, run COMPLETED, protocolo PROT-FICT-*, sem fallback", async () => {
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0001",
    session: session(),
    plan: plan(),
    executor,
    clock: clock(5),
  });

  assert.equal(report.outcome, "COMPLETED");
  assert.equal(report.runState, "COMPLETED");
  assert.equal(report.sessionState, "COMPLETED");
  assert.equal(report.totalSteps, 4);
  assert.equal(report.executedSteps.length, 4);
  assert.equal(report.remainingSteps.length, 0);
  assert.ok(report.syntheticProtocol?.startsWith("PROT-FICT-"));
  assert.equal(report.humanFallbackRequired, false);
  assert.equal(executor.calls.length, 4);
  assert.equal(validateSyntheticPlaywrightRunReport(report).ok, true);
});

// ------------------------------------------------------------- captcha

test("captcha sintético: interrompe imediatamente em WAITING_HUMAN, fallback obrigatório", async () => {
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "CAPTCHA_DETECTED"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0002",
    session: session({ sessionHandle: "sh_harness_0002", auditCorrelationId: "corr-harness-0002" }),
    plan: plan(),
    executor,
    clock: clock(5, 10),
  });

  assert.equal(report.outcome, "WAITING_HUMAN");
  assert.equal(report.humanFallbackRequired, true);
  assert.equal(report.executedSteps.length, 2);
  assert.equal(report.remainingSteps.length, 2, "etapas restantes preservadas");
  assert.equal(report.syntheticProtocol, null);
  assert.equal(executor.calls.length, 3, "nenhuma execução posterior à captcha");
  assert.equal(validateSyntheticPlaywrightRunReport(report).ok, true);
});

// ------------------------------------------------------------------- timeout

test("timeout: interrompe com estado coerente, sem avançar além da etapa travada, sem protocolo", async () => {
  const executor = new ScriptedExecutor(["SUCCESS", "TIMEOUT"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0003",
    session: session({ sessionHandle: "sh_harness_0003", auditCorrelationId: "corr-harness-0003" }),
    plan: plan(),
    executor,
    clock: clock(5, 20),
  });

  assert.equal(report.outcome, "FAILED");
  assert.equal(report.executedSteps.length, 1);
  assert.equal(report.remainingSteps.length, 3);
  assert.equal(report.remainingSteps[0]?.status, "INTERRUPTED");
  assert.equal(report.syntheticProtocol, null);
  assert.equal(executor.calls.length, 2, "sem retry automático");
});

// -------------------------------------------------------- navegação bloqueada

test("navegação bloqueada: interrompe, resultado tipado, sem etapa nova, sem protocolo", async () => {
  const executor = new ScriptedExecutor(["LOCAL_NAVIGATION_BLOCKED"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0004",
    session: session({ sessionHandle: "sh_harness_0004", auditCorrelationId: "corr-harness-0004" }),
    plan: plan(),
    executor,
    clock: clock(5, 30),
  });

  assert.equal(report.outcome, "FAILED");
  assert.equal(report.executedSteps.length, 0);
  assert.equal(report.syntheticProtocol, null);
  assert.equal(executor.calls.length, 1);

  const serialized = JSON.stringify(report);
  assert.equal(/https?:\/\/(?!localhost|127\.0\.0\.1)/i.test(serialized), false, "sem URL externa no relatório");
});

// ------------------------------------------------------------------ expiração

test("expiração: sessão e run terminam em EXPIRED, sem continuação nem renovação de handle", async () => {
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);
  const expiringSession = session({
    sessionHandle: "sh_harness_0005",
    auditCorrelationId: "corr-harness-0005",
    issuedAt: "2026-08-08T10:00:00.000Z",
    expiresAt: "2026-08-08T10:00:02.000Z",
  });
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0005",
    session: expiringSession,
    plan: plan(),
    executor,
    // O 3º timestamp já passa do expiresAt injetado acima.
    clock: ["2026-08-08T10:00:00.500Z", "2026-08-08T10:00:01.000Z", "2026-08-08T10:00:05.000Z"],
  });

  assert.equal(report.outcome, "EXPIRED");
  assert.equal(report.sessionState, "EXPIRED");
  assert.equal(report.runState, "EXPIRED");
  assert.equal(report.syntheticProtocol, null);
  assert.equal(report.remainingSteps.length > 0, true, "a fila não continua");
});

// -------------------------------------------------------------- limite de segurança

test("limite de segurança: executor sempre SUCCESS mas teto explícito para antes do fim", async () => {
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0006",
    session: session({ sessionHandle: "sh_harness_0006", auditCorrelationId: "corr-harness-0006" }),
    plan: plan(),
    executor,
    clock: clock(5, 40),
    maxSteps: 2,
  });

  assert.equal(report.outcome, "SAFETY_LIMIT_REACHED");
  assert.equal(report.executedSteps.length, 2, "parou no teto, não no fim do plano");
  assert.equal(report.syntheticProtocol, null);
  assert.equal(executor.calls.length, 2);
});

test("teto de segurança nunca ultrapassa o número de etapas do plano, mesmo se pedido maior", async () => {
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0007",
    session: session({ sessionHandle: "sh_harness_0007", auditCorrelationId: "corr-harness-0007" }),
    plan: plan(),
    executor,
    clock: clock(10, 50),
    maxSteps: 999,
  });

  assert.equal(executor.calls.length, 4, "nunca chama mais vezes que o plano tem etapas");
  assert.equal(report.outcome, "COMPLETED");
});

// ------------------------------------------------------------ estado inicial

test("estado inicial inválido: sessão malformada devolve INVALID_INITIAL_STATE com violações", async () => {
  const executor = new ScriptedExecutor(["SUCCESS"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0008",
    session: session({ environment: "production" as never }),
    plan: plan(),
    executor,
    clock: clock(5, 60),
  });

  assert.equal(report.outcome, "INVALID_INITIAL_STATE");
  assert.equal(report.sessionState, null);
  assert.equal(report.runState, null);
  assert.ok(report.violations.some((v) => v.code === "INVALID_ENVIRONMENT"));
  assert.equal(executor.calls.length, 0, "não toca o executor com entrada inválida");
});

test("estado inicial inválido: plano com etapa desconhecida devolve INVALID_INITIAL_STATE", async () => {
  const executor = new ScriptedExecutor(["SUCCESS"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0009",
    session: session({ sessionHandle: "sh_harness_0009", auditCorrelationId: "corr-harness-0009" }),
    plan: plan([{ ...step(), type: "NAVEGAR_GOVBR" as never }]),
    executor,
    clock: clock(5, 70),
  });

  assert.equal(report.outcome, "INVALID_INITIAL_STATE");
  assert.equal(executor.calls.length, 0);
});

test("relógio vazio é recusado como estado inicial inválido", async () => {
  const executor = new ScriptedExecutor(["SUCCESS"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0010",
    session: session({ sessionHandle: "sh_harness_0010", auditCorrelationId: "corr-harness-0010" }),
    plan: plan(),
    executor,
    clock: [],
  });

  assert.equal(report.outcome, "INVALID_INITIAL_STATE");
  assert.equal(executor.calls.length, 0);
});

// --------------------------------------------------------------- relatório

test("o relatório final não carrega sessionHandle, credencial, CPF ou objeto arbitrário", async () => {
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0011",
    session: session({ sessionHandle: "sh_harness_secreto_0011", auditCorrelationId: "corr-harness-0011" }),
    plan: plan(),
    executor,
    clock: clock(5, 80),
  });

  const serialized = JSON.stringify(report).toLowerCase();
  for (const forbidden of ["sh_harness_secreto", "senha", "password", "cookie", "token", "000.000.000-00", "screenshot", "stack"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
});

test("validateSyntheticPlaywrightRunReport aceita um relatório de sucesso real", async () => {
  const executor = new ScriptedExecutor(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"]);
  const report = await runSyntheticPlaywrightPlan({
    runId: "run-harness-0012",
    session: session({ sessionHandle: "sh_harness_0012", auditCorrelationId: "corr-harness-0012" }),
    plan: plan(),
    executor,
    clock: clock(5, 90),
  });

  const validation = validateSyntheticPlaywrightRunReport(report);
  assert.equal(validation.ok, true);
});

test("validateSyntheticPlaywrightRunReport recusa campo desconhecido", () => {
  const validation = validateSyntheticPlaywrightRunReport({ notAField: true });
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.ok(validation.violations.some((v) => v.code === "UNKNOWN_FIELD"));
  assert.ok(validation.violations.some((v) => v.code === "MISSING_FIELD"));
});

function validReportFixture(overrides: Partial<SyntheticPlaywrightRunReport> = {}): SyntheticPlaywrightRunReport {
  return {
    runId: "run-x",
    planId: "plan-x",
    processId: "proc-x",
    sessionState: "COMPLETED",
    runState: "COMPLETED",
    startedAt: "2026-08-08T10:00:00.000Z",
    finishedAt: "2026-08-08T10:00:04.000Z",
    totalSteps: 1,
    executedSteps: [{ stepId: "step-1", type: "VALIDATE_INPUT", status: "COMPLETED" }],
    remainingSteps: [],
    events: [],
    evidence: [],
    syntheticProtocol: "PROT-FICT-0001",
    humanFallbackRequired: false,
    outcome: "COMPLETED",
    violations: [],
    synthetic: true,
    local: true,
    ...overrides,
  };
}

test("validateSyntheticPlaywrightRunReport recusa protocolo fora do padrão sintético", () => {
  const validation = validateSyntheticPlaywrightRunReport(validReportFixture({ syntheticProtocol: "PROT-REAL-0001" }));
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.ok(validation.violations.some((v) => v.code === "INVALID_PROTOCOL"));
});

test("validateSyntheticPlaywrightRunReport recusa protocolo fora de COMPLETED", () => {
  const validation = validateSyntheticPlaywrightRunReport(
    validReportFixture({ outcome: "FAILED", syntheticProtocol: "PROT-FICT-0001" }),
  );
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.ok(validation.violations.some((v) => v.code === "PROTOCOL_WITHOUT_SUCCESS"));
});

test("validateSyntheticPlaywrightRunReport recusa WAITING_HUMAN sem fallback", () => {
  const validation = validateSyntheticPlaywrightRunReport(
    validReportFixture({ outcome: "WAITING_HUMAN", syntheticProtocol: null, humanFallbackRequired: false }),
  );
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.ok(validation.violations.some((v) => v.code === "WAITING_HUMAN_WITHOUT_FALLBACK"));
});

test("validateSyntheticPlaywrightRunReport recusa COMPLETED com etapas restantes", () => {
  const validation = validateSyntheticPlaywrightRunReport(
    validReportFixture({ remainingSteps: [{ stepId: "step-2", type: "OPEN_FORM", status: "NOT_EXECUTED" }] }),
  );
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.ok(validation.violations.some((v) => v.code === "SUCCESS_WITHOUT_ALL_STEPS"));
});

test("validateSyntheticPlaywrightRunReport recusa host oficial em texto do relatório", () => {
  const validation = validateSyntheticPlaywrightRunReport(validReportFixture({ planId: "plan-sinarm-gov.br" }));
  assert.equal(validation.ok, false);
});

// --------------------------------------------------------------- estrutural

test("o harness nunca usa Date.now nem timers, e não importa a Fase 9", () => {
  const code = sourceCode();
  for (const forbidden of ["Date.now(", "setTimeout(", "setInterval(", "phase9", "@prisma/client", "localStorage"]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

test("o harness não duplica a máquina de estados nem a tabela de transições", () => {
  const code = sourceCode();
  assert.ok(code.includes("createSyntheticRun("));
  assert.ok(code.includes("runNextSyntheticStepLocally("));
  for (const forbidden of ["SYNTHETIC_TRANSITIONS", "applySyntheticTransition(", "canTransition("]) {
    assert.equal(code.includes(forbidden), false, `segunda máquina de estados: ${forbidden}`);
  }
});
