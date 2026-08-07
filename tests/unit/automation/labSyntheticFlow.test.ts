/**
 * Fase 2 — fluxo do laboratorio de login e handoff sinteticos.
 *
 * Testes de COMPORTAMENTO do fluxo, nao reteste do lifecycle: o que importa
 * aqui e que a tela consuma os modulos reais, acumule eventos na ordem, mostre
 * violacao tipada sem mexer na sessao e nunca exponha o handle.
 * Dados 100% ficticios.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  LAB_FIRST_STEP,
  LAB_SYNTHETIC_NOTICE,
  applyLabAction,
  initialLabFlowState,
  labSessionView,
  type LabAction,
  type LabFlowState,
} from "../../../src/server/automation/synthetic/labSyntheticFlow";

const SOURCE_PATH = "src/server/automation/synthetic/labSyntheticFlow.ts";

/** Roda uma sequência de ações a partir do estado inicial. */
function run(...actions: readonly LabAction[]): LabFlowState {
  return actions.reduce(applyLabAction, initialLabFlowState());
}

const LOGIN: LabAction = { kind: "login" };
const HANDOFF: LabAction = { kind: "handoff" };
const CONFIRM: LabAction = { kind: "confirm-handoff" };

function eventNames(state: LabFlowState): string[] {
  return state.events.map((event) => event.event);
}

// ------------------------------------------------------------------- inicial

test("começa sem sessão, sem evento e sem violação", () => {
  const state = initialLabFlowState();

  assert.equal(state.session, null);
  assert.deepEqual(state.events, []);
  assert.deepEqual(state.violations, []);
  assert.equal(labSessionView(state), null);
});

test("o aviso sintético nomeia o ambiente e nega os portais oficiais", () => {
  assert.ok(LAB_SYNTHETIC_NOTICE.includes("sintético"));
  assert.ok(LAB_SYNTHETIC_NOTICE.includes("Gov.br"));
  assert.ok(LAB_SYNTHETIC_NOTICE.includes("SINARM"));
});

// -------------------------------------------------------- caminho principal

test("login sintético cria a sessão em CREATED e emite um evento", () => {
  const state = run(LOGIN);

  assert.deepEqual(eventNames(state), ["synthetic_session_created"]);
  assert.equal(labSessionView(state)?.state, "CREATED");
  assert.deepEqual(state.violations, []);
});

test("handoff move CREATED -> CLAIMED", () => {
  const state = run(LOGIN, HANDOFF);

  assert.equal(labSessionView(state)?.state, "CLAIMED");
  assert.deepEqual(eventNames(state), ["synthetic_session_created", "synthetic_session_claimed"]);
});

test("confirmar o handoff entra em IN_PROGRESS com a primeira etapa", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM);
  const ultimo = state.events.at(-1);

  assert.equal(labSessionView(state)?.state, "IN_PROGRESS");
  assert.equal(ultimo?.event, "synthetic_session_step_started");
  assert.equal(ultimo?.previousState, "CLAIMED");
  assert.equal(ultimo?.nextState, "IN_PROGRESS");
  assert.equal(ultimo?.step, LAB_FIRST_STEP);
});

test("a jornada completa produz os eventos na ordem certa", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM, { kind: "next-step" }, { kind: "complete" });

  assert.deepEqual(eventNames(state), [
    "synthetic_session_created",
    "synthetic_session_claimed",
    "synthetic_session_step_started",
    "synthetic_session_step_completed",
    "synthetic_session_completed",
  ]);
  assert.equal(labSessionView(state)?.state, "COMPLETED");
});

test("a primeira etapa não é emitida duas vezes", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM, { kind: "next-step" }, { kind: "next-step" });

  const iniciadas = state.events
    .filter((event) => event.event === "synthetic_session_step_started")
    .map((event) => event.step);

  assert.deepEqual(iniciadas, [LAB_FIRST_STEP], "só a entrada em execução inicia etapa");
  assert.equal(state.events.filter((e) => e.event === "synthetic_session_step_started").length, 1);
});

test("etapas seguintes usam nomes diferentes", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM, { kind: "next-step" }, { kind: "next-step" });
  const concluidas = state.events
    .filter((event) => event.event === "synthetic_session_step_completed")
    .map((event) => event.step);

  assert.equal(concluidas.length, 2);
  assert.notEqual(concluidas[0], concluidas[1]);
});

// -------------------------------------------------------------- bloqueio

test("handoff sem sessão é recusado com violação tipada", () => {
  const state = run(HANDOFF);

  assert.equal(state.session, null);
  assert.deepEqual(state.events, []);
  assert.equal(state.violations.length, 1);
  assert.equal(state.violations[0]?.code, "INVALID_STATE");
});

test("handoff fora de ordem não altera a sessão nem emite evento", () => {
  const antes = run(LOGIN, HANDOFF, CONFIRM);
  const depois = applyLabAction(antes, HANDOFF);

  assert.equal(labSessionView(depois)?.state, "IN_PROGRESS", "o estado não pode mudar");
  assert.deepEqual(eventNames(depois), eventNames(antes), "nenhum evento novo");
  assert.ok(depois.violations.length > 0, "a violação precisa aparecer");
  assert.equal(depois.violations[0]?.code, "FORBIDDEN_TRANSITION");
});

test("terminal recusa qualquer ação seguinte, com código próprio", () => {
  const concluida = run(LOGIN, HANDOFF, CONFIRM, { kind: "complete" });
  const depois = applyLabAction(concluida, { kind: "next-step" });

  assert.equal(labSessionView(depois)?.state, "COMPLETED");
  assert.deepEqual(eventNames(depois), eventNames(concluida));
  assert.ok(depois.violations.some((v) => v.code === "STEP_REQUIRES_IN_PROGRESS"));
});

test("uma ação bem-sucedida limpa as violações anteriores", () => {
  const comViolacao = run(LOGIN, CONFIRM);
  assert.ok(comViolacao.violations.length > 0);

  const depois = applyLabAction(comViolacao, HANDOFF);
  assert.deepEqual(depois.violations, []);
});

// -------------------------------------------------------------- expiração

test("expirar o handle leva a EXPIRED, sem renovação silenciosa", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM, { kind: "expire" });

  assert.equal(labSessionView(state)?.state, "EXPIRED");
  assert.equal(state.events.at(-1)?.event, "synthetic_session_expired");
  assert.deepEqual(labSessionView(state)?.allowedTransitions, [], "terminal não oferece saída");
});

test("depois de expirar, retomar a execução é recusado", () => {
  const expirada = run(LOGIN, HANDOFF, CONFIRM, { kind: "expire" });
  const depois = applyLabAction(expirada, CONFIRM);

  assert.equal(labSessionView(depois)?.state, "EXPIRED");
  assert.ok(depois.violations.some((v) => v.code === "TERMINAL_NO_REOPEN"));
});

// --------------------------------------------------------- falha sintética

test("falha sintética leva a FAILED e nunca produz protocolo", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM, { kind: "fail", failure: "TIMEOUT" });

  assert.equal(labSessionView(state)?.state, "FAILED");
  assert.equal(state.events.at(-1)?.event, "synthetic_session_failed");
  assert.equal(
    JSON.stringify(state.events).includes("PROT-FICT"),
    false,
    "falha não pode carregar protocolo",
  );
});

test("HANDLE_EXPIRED termina em EXPIRED, não em FAILED — prazo não é defeito", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM, { kind: "fail", failure: "HANDLE_EXPIRED" });

  assert.equal(labSessionView(state)?.state, "EXPIRED");
  assert.equal(state.events.at(-1)?.event, "synthetic_session_expired");
});

// ------------------------------------------------------------------- reset

test("reiniciar volta ao estado inicial", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM, { kind: "reset" });

  assert.deepEqual(state, initialLabFlowState());
  assert.equal(labSessionView(state), null);
});

test("reiniciar funciona também depois de uma violação", () => {
  const state = run(HANDOFF, { kind: "reset" });
  assert.deepEqual(state, initialLabFlowState());
});

// ------------------------------------------------------- determinismo e handle

test("a mesma sequência produz sempre os mesmos eventos e instantes", () => {
  assert.deepEqual(run(LOGIN, HANDOFF, CONFIRM), run(LOGIN, HANDOFF, CONFIRM));
});

test("o instante do evento vem do relógio sintético, nunca do relógio real", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM);
  const instantes = state.events.map((event) => event.timestamp);

  assert.deepEqual(instantes, [
    "2026-08-06T10:00:00.000Z",
    "2026-08-06T10:01:00.000Z",
    "2026-08-06T10:02:00.000Z",
  ]);
});

test("a view não expõe o sessionHandle", () => {
  const state = run(LOGIN, HANDOFF);
  const view = labSessionView(state);

  const serializado = JSON.stringify(view);
  assert.equal(serializado.includes("sh_lab"), false);
  assert.equal(serializado.includes("sessionHandle"), false);
  assert.ok(serializado.includes("corr-lab-0001"), "a correlação é o que identifica");
});

test("nenhum evento acumulado carrega o sessionHandle", () => {
  const state = run(LOGIN, HANDOFF, CONFIRM, { kind: "next-step" });

  assert.equal(JSON.stringify(state.events).includes("sh_lab"), false);
});

test("as ações permitidas vêm do contrato, não de lista paralela", () => {
  assert.deepEqual(labSessionView(run(LOGIN))?.allowedTransitions, [
    "CLAIMED",
    "EXPIRED",
    "CANCELLED",
  ]);
  assert.deepEqual(labSessionView(run(LOGIN, HANDOFF))?.allowedTransitions, [
    "IN_PROGRESS",
    "EXPIRED",
    "CANCELLED",
  ]);
});

// ------------------------------------------------------- provas estruturais

function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("o fluxo não toca rede, Prisma, Fase 9 nem persistência", () => {
  const code = sourceCode();

  for (const forbidden of [
    "fetch(",
    "phase9",
    "safety",
    "networkGuard",
    "@prisma/client",
    "node:fs",
    "playwright",
    "process.env",
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "gov.br",
    "servicos.pf",
  ]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

test("o fluxo não lê o relógio real nem sorteia", () => {
  const code = sourceCode();

  assert.equal(code.includes("Date.now()"), false);
  assert.equal(code.includes("Math.random()"), false);
  assert.equal(code.includes("new Date()"), false);
});

test("o fluxo não declara campo de credencial", () => {
  const code = sourceCode().toLowerCase();

  for (const forbidden of ["password", "senha:", "otp", "cookie", "storagestate", "cpf"]) {
    assert.equal(code.includes(forbidden), false, `não pode declarar ${forbidden}`);
  }
});

test("o fluxo não redefine transições — delega ao lifecycle", () => {
  const code = sourceCode();

  assert.equal(code.includes("SYNTHETIC_TRANSITIONS"), false, "não lê a tabela direto");
  assert.ok(code.includes("applySyntheticTransition"), "aplica pelo lifecycle");
  assert.ok(code.includes("getAllowedSyntheticTransitions"), "consulta pelo sessionState");
});
