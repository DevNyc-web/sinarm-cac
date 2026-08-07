/**
 * Fase 2 — coordenador de execução sintética (`syntheticRunCoordinator.ts`).
 *
 * Não reteste a matriz do lifecycle (isso já está em
 * `syntheticSessionLifecycle.test.ts`); aqui o que importa é que o coordenador
 * ORQUESTRE a fila por cima dele: uma etapa por vez, evidência por etapa,
 * interrupção correta em captcha/falha/expiração, e nenhuma segunda máquina de
 * estados. Dados 100% fictícios.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import {
  cancelSyntheticRun,
  createSyntheticRun,
  executeNextSyntheticStep,
  interruptSyntheticRun,
  isSyntheticRunTerminalState,
  resumeSyntheticRun,
  syntheticRunView,
  validateSyntheticRunPlan,
  type SyntheticAutomationRun,
  type SyntheticRunPlan,
  type SyntheticRunStep,
} from "../../../src/server/automation/synthetic/syntheticRunCoordinator";

const SOURCE_PATH = "src/server/automation/synthetic/syntheticRunCoordinator.ts";

/** Código-fonte sem comentários — as provas estruturais não podem confundir texto explicativo com uso real. */
function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const EMITIDO = "2026-08-06T10:00:00.000Z";
const EXPIRA = "2026-08-06T10:10:00.000Z";
const T1 = "2026-08-06T10:01:00.000Z";
const T2 = "2026-08-06T10:02:00.000Z";
const T3 = "2026-08-06T10:03:00.000Z";
const T4 = "2026-08-06T10:04:00.000Z";
const DEPOIS_DO_PRAZO = "2026-08-06T10:30:00.000Z";

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_run_lab_0001",
    processId: "proc-run-lab-0001",
    actorId: "actor-run-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: EXPIRA,
    issuedAt: EMITIDO,
    environment: "synthetic",
    consentMarker: "consent-sintetico-run-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-run-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-RUN-0001",
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

function plan(steps: readonly SyntheticRunStep[], overrides: Partial<SyntheticRunPlan> = {}): SyntheticRunPlan {
  return {
    planId: "plan-teste-0001",
    version: "1.0.0",
    allowedSyntheticData: ["destino fictício"],
    steps,
    ...overrides,
  };
}

const FOUR_STEPS: readonly SyntheticRunStep[] = [
  step({ stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos" }),
  step({ stepId: "step-2", type: "OPEN_FORM", description: "abrir formulário fictício" }),
  step({ stepId: "step-3", type: "FILL_FORM", description: "preencher dados fictícios" }),
  step({ stepId: "step-4", type: "CONFIRM_RESULT", description: "confirmar resultado fictício" }),
];

function createRun(steps: readonly SyntheticRunStep[] = FOUR_STEPS, sessionOverrides: Partial<SyntheticSessionContract> = {}): SyntheticAutomationRun {
  const result = createSyntheticRun({ runId: "run-teste-0001", session: session(sessionOverrides), plan: plan(steps) });
  assert.equal(result.ok, true, "fixture de teste deveria criar o run");
  if (!result.ok) throw new Error("unreachable");
  return result.run;
}

// -------------------------------------------------------------- 1. criação

test("createSyntheticRun cria o run em QUEUED com a fila cheia", () => {
  const result = createSyntheticRun({ runId: "run-0001", session: session(), plan: plan(FOUR_STEPS) });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.state, "QUEUED");
  assert.equal(result.run.pendingSteps.length, 4);
  assert.equal(result.run.completedSteps.length, 0);
  assert.equal(result.run.humanFallbackRequired, false);
  assert.equal(result.run.result, null);
});

// -------------------------------------------------------- 2. fila ordenada

test("a fila mantém a ordem do plano", () => {
  const run = createRun();
  assert.deepEqual(
    run.pendingSteps.map((s) => s.stepId),
    ["step-1", "step-2", "step-3", "step-4"],
  );
  assert.equal(run.currentStep?.stepId, "step-1");
});

// ---------------------------------------------------- 3. execução de etapa

test("executeNextSyntheticStep executa a etapa da cabeça e avança a fila", () => {
  const run = createRun();
  const result = executeNextSyntheticStep({ run, at: T1, reason: "etapa 1" });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.state, "RUNNING");
  assert.equal(result.run.pendingSteps.length, 3);
  assert.equal(result.run.completedSteps.length, 1);
  assert.equal(result.run.completedSteps[0]?.step.stepId, "step-1");
  assert.equal(result.run.currentStep?.stepId, "step-2");
});

test("a primeira etapa também move a sessão de CLAIMED para IN_PROGRESS", () => {
  const run = createRun();
  const result = executeNextSyntheticStep({ run, at: T1 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.session.handoffState, "IN_PROGRESS");
});

// -------------------------------------------------------- 4. imutabilidade

test("executeNextSyntheticStep não muta o run recebido", () => {
  const run = createRun();
  const snapshot = JSON.parse(JSON.stringify(run));

  const result = executeNextSyntheticStep({ run, at: T1 });

  assert.deepEqual(JSON.parse(JSON.stringify(run)), snapshot);
  assert.equal(result.ok, true);
  if (result.ok) assert.notEqual(result.run, run);
});

test("cancelSyntheticRun em run recusado (terminal) devolve a MESMA referência", () => {
  const run = createRun();
  const cancelled = cancelSyntheticRun({ run, at: T1 });
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) return;

  const secondAttempt = cancelSyntheticRun({ run: cancelled.run, at: T2 });
  assert.equal(secondAttempt.ok, false);
  if (secondAttempt.ok) return;
  assert.equal(secondAttempt.run, cancelled.run, "run rejeitado precisa voltar intacto");
});

// ----------------------------------------------------------- 5. evidência

test("cada etapa bem-sucedida cria evidência sem sessionHandle", () => {
  const run = createRun();
  const result = executeNextSyntheticStep({ run, at: T1 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.evidence.length, 1);
  const evidence = result.run.evidence[0];
  assert.equal(evidence?.type, "STEP_COMPLETED");
  assert.equal(evidence?.stepId, "step-1");
  assert.equal(evidence?.runId, run.runId);
  assert.equal(evidence?.timestamp, T1);

  const serialized = JSON.stringify(result.run.evidence);
  assert.equal(serialized.includes("sh_run_lab"), false, "evidência não pode carregar o sessionHandle");
});

// ------------------------------------------------- 6. sessão pelo lifecycle

test("a sessão devolvida é a mesma que o lifecycle produziria (evento emitido)", () => {
  const run = createRun();
  const result = executeNextSyntheticStep({ run, at: T1 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.events.length, 2, "primeira etapa: step_started (transição) + step_completed");
  assert.deepEqual(
    result.run.events.map((e) => e.event),
    ["synthetic_session_step_started", "synthetic_session_step_completed"],
  );
});

// ------------------------------------------------------- 7/8. fila avança

test("etapa concluída sai da fila pendente e entra em concluídas", () => {
  const run = createRun();
  const result = executeNextSyntheticStep({ run, at: T1 });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.run.pendingSteps.some((s) => s.stepId === "step-1"), false);
  assert.equal(result.run.completedSteps.some((c) => c.step.stepId === "step-1"), true);
});

// --------------------------------------------- 9/10. nunca duas vezes/pular

test("a API só executa a cabeça da fila: repetir a chamada avança, nunca repete ou pula", () => {
  let run = createRun();

  const seen: string[] = [];
  for (const at of [T1, T2, T3, T4]) {
    const result = executeNextSyntheticStep({ run, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    seen.push(result.run.completedSteps[result.run.completedSteps.length - 1]!.step.stepId);
    run = result.run;
  }

  assert.deepEqual(seen, ["step-1", "step-2", "step-3", "step-4"]);
  assert.equal(new Set(seen).size, 4, "nenhuma etapa repetida");
});

// -------------------------------------------------------- 11. conclusão

test("run conclui após a última etapa, com protocolo sintético", () => {
  let run = createRun();
  for (const at of [T1, T2, T3, T4]) {
    const result = executeNextSyntheticStep({ run, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    run = result.run;
  }

  assert.equal(run.state, "COMPLETED");
  assert.equal(run.session.handoffState, "COMPLETED");
  assert.equal(run.result?.outcome, "SUCCESS");
  assert.equal(run.result?.syntheticProtocol, "PROT-FICT-RUN-0001");
  assert.equal(run.pendingSteps.length, 0);
  assert.equal(run.currentStep, null);
});

// -------------------------------------------------- 12. terminal não continua

test("run terminal recusa nova etapa", () => {
  const run = createRun([step()]);
  const completed = executeNextSyntheticStep({ run, at: T1 });
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.run.state, "COMPLETED");

  const again = executeNextSyntheticStep({ run: completed.run, at: T2 });
  assert.equal(again.ok, false);
  if (again.ok) return;
  assert.deepEqual(
    again.violations.map((v) => v.code),
    ["RUN_TERMINAL_NO_CONTINUE"],
  );
});

// -------------------------------------------------------------- 13/14. falha

test("falha sintética interrompe o run e nunca produz protocolo", () => {
  const run = createRun([step({ syntheticFailure: "TIMEOUT" }), step({ stepId: "step-2" })]);
  const result = executeNextSyntheticStep({ run, at: T1 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.state, "FAILED");
  assert.equal(result.run.session.handoffState, "FAILED");
  assert.equal(result.run.result?.outcome, "FAILURE");
  assert.equal(result.run.result?.syntheticProtocol, null);
  assert.equal(result.run.pendingSteps.length, 2, "a fila para no lugar: a segunda etapa não roda");
});

// ---------------------------------------------------------- 15/16/17 captcha

test("captcha leva o run a WAITING_HUMAN e exige fallback humano", () => {
  const run = createRun();
  const result = interruptSyntheticRun({ run, at: T1, cause: { kind: "CAPTCHA" } });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.state, "WAITING_HUMAN");
  assert.equal(result.run.humanFallbackRequired, true);
  assert.equal(result.run.session.handoffState, "BLOCKED");
  assert.equal(result.run.pendingSteps.length, run.pendingSteps.length, "a etapa bloqueada não é consumida");
});

test("captcha não tem bypass: resumeSyntheticRun sempre recusa", () => {
  const run = createRun();
  const blocked = interruptSyntheticRun({ run, at: T1, cause: { kind: "CAPTCHA" } });
  assert.equal(blocked.ok, true);
  if (!blocked.ok) return;

  const resumed = resumeSyntheticRun({ run: blocked.run, at: T2 });
  assert.equal(resumed.ok, false);
  if (resumed.ok) return;
  assert.deepEqual(
    resumed.violations.map((v) => v.code),
    ["CAPTCHA_NO_RESUME"],
  );
  assert.equal(resumed.run, blocked.run, "recusa não altera o run");
});

test("run bloqueado por captcha recusa nova etapa", () => {
  const run = createRun();
  const blocked = interruptSyntheticRun({ run, at: T1, cause: { kind: "CAPTCHA" } });
  assert.equal(blocked.ok, true);
  if (!blocked.ok) return;

  const next = executeNextSyntheticStep({ run: blocked.run, at: T2 });
  assert.equal(next.ok, false);
  if (next.ok) return;
  assert.deepEqual(
    next.violations.map((v) => v.code),
    ["HUMAN_FALLBACK_PENDING"],
  );
});

// -------------------------------------------------------------- 18. timeout

test("timeout interrompe o run via interruptSyntheticRun", () => {
  const run = createRun();
  const result = interruptSyntheticRun({ run, at: T1, cause: { kind: "FAILURE", failure: "TIMEOUT" } });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.state, "FAILED");
  assert.equal(result.run.result?.syntheticProtocol, null);
  assert.equal(result.run.evidence.at(-1)?.type, "STEP_FAILED");
});

// ------------------------------------------------------- 19/20. expiração

test("expiração encerra sessão e run em EXPIRED, sem renovar o handle", () => {
  const run = createRun([step({ syntheticFailure: "HANDLE_EXPIRED" })]);
  const expiresBefore = run.session.expiresAt;

  const result = executeNextSyntheticStep({ run, at: T1 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.state, "EXPIRED");
  assert.equal(result.run.session.handoffState, "EXPIRED");
  assert.equal(result.run.result?.outcome, "EXPIRED");
  assert.equal(result.run.result?.syntheticProtocol, null);
  assert.equal(result.run.session.expiresAt, expiresBefore, "expirar não renova o handle");
  assert.equal(result.run.pendingSteps.length, run.pendingSteps.length, "a fila não continua");
});

test("prazo vencido no relógio injetado também expira sem marcação explícita", () => {
  const run = createRun();
  const result = executeNextSyntheticStep({ run, at: DEPOIS_DO_PRAZO });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.state, "EXPIRED");
  assert.equal(result.run.session.handoffState, "EXPIRED");
});

// --------------------------------------------------------- 21. cancelamento

test("cancelSyntheticRun encerra o run em CANCELLED", () => {
  const run = createRun();
  const result = cancelSyntheticRun({ run, at: T1 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.state, "CANCELLED");
  assert.equal(result.run.session.handoffState, "CANCELLED");
  assert.equal(result.run.result?.outcome, "CANCELLED");
  assert.equal(result.run.result?.syntheticProtocol, null);
});

// --------------------------------------------------- 22. timestamps injetados

test("o timestamp de cada evidência é o `at` injetado, nunca o relógio real", () => {
  const run = createRun();
  const result = executeNextSyntheticStep({ run, at: T3 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.run.evidence[0]?.timestamp, T3);
  assert.equal(result.run.events.every((e) => e.timestamp === T3), true);
});

// ------------------------------------------------ 23/24. sem handle/credencial

test("evidência e eventos nunca carregam sessionHandle nem credencial", () => {
  let run = createRun();
  for (const at of [T1, T2]) {
    const result = executeNextSyntheticStep({ run, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    run = result.run;
  }
  const blob = JSON.stringify({ evidence: run.evidence, events: run.events });
  for (const proibido of ["sh_run_lab", "senha", "password", "token", "cookie", "cpf"]) {
    assert.equal(blob.toLowerCase().includes(proibido), false, `vazou "${proibido}"`);
  }
});

// -------------------------------------------------------------- 25. sem rede

test("o módulo não referencia rede, storage nem persistência (prova estrutural)", () => {
  const code = sourceCode();
  for (const forbidden of [
    "fetch(",
    "http://",
    "https://",
    "localStorage",
    "sessionStorage",
    "@prisma/client",
    "Date.now(",
    "Math.random(",
    "setTimeout(",
    "phase9",
  ]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

// -------------------------------------------------------- 26. plano inválido

test("plano sem etapas é rejeitado", () => {
  const validation = validateSyntheticRunPlan(plan([]));
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.deepEqual(
    validation.violations.map((v) => v.code),
    ["EMPTY_PLAN"],
  );
});

test("plano com campo desconhecido é rejeitado", () => {
  const validation = validateSyntheticRunPlan({ ...plan(FOUR_STEPS), extra: "não deveria existir" });
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.ok(validation.violations.some((v) => v.code === "UNKNOWN_FIELD"));
});

test("stepId duplicado é rejeitado", () => {
  const validation = validateSyntheticRunPlan(plan([step({ stepId: "dup" }), step({ stepId: "dup" })]));
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.ok(validation.violations.some((v) => v.code === "DUPLICATE_STEP_ID"));
});

// ------------------------------------------------------- 27. etapa desconhecida

test("tipo de etapa fora da lista fechada é rejeitado", () => {
  const validation = validateSyntheticRunPlan(plan([{ ...step(), type: "NAVEGAR_PARA_GOVBR" as never }]));
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.ok(validation.violations.some((v) => v.code === "UNKNOWN_STEP_TYPE"));
});

test("URL externa na descrição da etapa é rejeitada", () => {
  const validation = validateSyntheticRunPlan(
    plan([step({ description: "abrir https://servicos.pf.gov.br/sinarm" })]),
  );
  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.ok(validation.violations.some((v) => v.code === "FORBIDDEN_HOST" || v.code === "EXTERNAL_URL"));
});

test("sessão inválida (production) é rejeitada na criação", () => {
  const result = createSyntheticRun({
    runId: "run-invalido",
    session: session({ environment: "production" as never }),
    plan: plan(FOUR_STEPS),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.violations.some((v) => v.code === "INVALID_ENVIRONMENT"));
});

// -------------------------------------------------------- 29. run terminal fica

test("iniciar outro run não altera o run terminal anterior", () => {
  const run = createRun();
  const cancelled = cancelSyntheticRun({ run, at: T1 });
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) return;
  const snapshot = JSON.parse(JSON.stringify(cancelled.run));

  // "nova sessão/novo run" é simplesmente chamar createSyntheticRun de novo.
  const other = createSyntheticRun({ runId: "run-0002", session: session(), plan: plan(FOUR_STEPS) });
  assert.equal(other.ok, true);

  assert.deepEqual(JSON.parse(JSON.stringify(cancelled.run)), snapshot);
});

// ----------------------------------------------- 30. nenhuma segunda máquina

test("o coordenador delega toda transição de sessão ao lifecycle existente", () => {
  const code = sourceCode();

  assert.ok(code.includes("applySyntheticTransition("));
  assert.ok(code.includes("recordSyntheticStep("));

  // Nenhuma tabela de transição própria — se alguém escrever
  // `CREATED: [...]`/`BLOCKED: [...]` aqui, é uma segunda máquina de estados.
  for (const forbidden of ["CREATED:", "BLOCKED:", "SYNTHETIC_TRANSITIONS"]) {
    assert.equal(code.includes(forbidden), false, `segunda máquina de estados: ${forbidden}`);
  }
});

// ------------------------------------------------------------------- view

test("syntheticRunView não expõe a sessão (sem sessionHandle)", () => {
  const run = createRun();
  const view = syntheticRunView(run);

  assert.equal(Object.prototype.hasOwnProperty.call(view, "session"), false);
  assert.equal(JSON.stringify(view).includes("sh_run_lab"), false);
  assert.equal(view.state, "QUEUED");
  assert.equal(view.pendingStepIds.length, 4);
  assert.equal(view.completedStepIds.length, 0);
  assert.equal(view.terminal, false);
});

test("isSyntheticRunTerminalState reconhece os 4 estados terminais do run", () => {
  for (const state of ["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"]) {
    assert.equal(isSyntheticRunTerminalState(state), true);
  }
  for (const state of ["QUEUED", "RUNNING", "WAITING_HUMAN"]) {
    assert.equal(isSyntheticRunTerminalState(state), false);
  }
});
