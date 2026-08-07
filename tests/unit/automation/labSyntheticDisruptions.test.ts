/**
 * Fase 2 — interrupcoes sinteticas do laboratorio: timeout, captcha, expiracao
 * de handle e nova sessao apos o termino.
 *
 * Testes de COMPORTAMENTO. O que importa: timeout e falha do dominio e nunca
 * vira sucesso; captcha BLOQUEIA e nao tem bypass; expiracao termina em
 * `EXPIRED` sem renovar; e sessao terminal so continua virando OUTRA sessao,
 * com identificadores novos. Dados 100% ficticios.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  applyLabAction,
  initialLabFlowState,
  labSessionView,
  type LabAction,
  type LabFlowState,
} from "../../../src/server/automation/synthetic/labSyntheticFlow";

const SOURCE_PATH = "src/server/automation/synthetic/labSyntheticFlow.ts";

const LOGIN: LabAction = { kind: "login" };
const HANDOFF: LabAction = { kind: "handoff" };
const CONFIRM: LabAction = { kind: "confirm-handoff" };
const TIMEOUT: LabAction = { kind: "timeout" };
const CAPTCHA: LabAction = { kind: "captcha" };
const EXPIRE: LabAction = { kind: "expire" };
const CANCEL: LabAction = { kind: "cancel" };
const NEW_SESSION: LabAction = { kind: "new-session" };
const COMPLETE: LabAction = { kind: "complete" };
const NEXT_STEP: LabAction = { kind: "next-step" };

function eventNames(state: LabFlowState): string[] {
  return state.events.map((event) => event.event);
}

/** Sessão em execução — ponto de partida de toda interrupção. */
function executando(): LabFlowState {
  return [LOGIN, HANDOFF, CONFIRM].reduce(applyLabAction, initialLabFlowState());
}

function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// ------------------------------------------------------------------ timeout

test("timeout em estado permitido leva a FAILED", () => {
  const state = applyLabAction(executando(), TIMEOUT);

  assert.equal(labSessionView(state)?.state, "FAILED");
  assert.equal(state.events.at(-1)?.event, "synthetic_session_failed");
  assert.deepEqual(state.violations, []);
});

test("timeout não gera protocolo", () => {
  const state = applyLabAction(executando(), TIMEOUT);

  assert.equal(JSON.stringify(state.events).includes("PROT-FICT"), false);
});

test("timeout não termina em sucesso", () => {
  const state = applyLabAction(executando(), TIMEOUT);

  assert.notEqual(labSessionView(state)?.state, "COMPLETED");
  assert.equal(
    state.events.some((event) => event.event === "synthetic_session_completed"),
    false,
  );
});

test("timeout usa a falha TIMEOUT do domínio e o motivo aparece no evento", () => {
  const state = applyLabAction(executando(), TIMEOUT);

  assert.ok(state.events.at(-1)?.reason.includes("TIMEOUT"));
});

test("timeout não renova a sessão silenciosamente", () => {
  const antes = executando();
  const depois = applyLabAction(antes, TIMEOUT);

  assert.equal(labSessionView(depois)?.expiresAt, labSessionView(antes)?.expiresAt);
  assert.equal(labSessionView(depois)?.terminal, true);
});

// ------------------------------------------------------------------ captcha

test("captcha interrompe o avanço e leva a BLOCKED", () => {
  const state = applyLabAction(executando(), CAPTCHA);

  assert.equal(labSessionView(state)?.state, "BLOCKED");
  assert.equal(state.events.at(-1)?.event, "synthetic_session_blocked_by_captcha");
  assert.equal(state.events.at(-1)?.previousState, "IN_PROGRESS");
});

test("captcha nunca produz conclusão — BLOCKED não avança", () => {
  const bloqueada = applyLabAction(executando(), CAPTCHA);

  for (const acao of [CONFIRM, COMPLETE, NEXT_STEP]) {
    const depois = applyLabAction(bloqueada, acao);

    assert.equal(labSessionView(depois)?.state, "BLOCKED", `${acao.kind} não pode avançar`);
    assert.deepEqual(eventNames(depois), eventNames(bloqueada), "nenhum evento novo");
    assert.ok(depois.violations.length > 0, "a recusa precisa ser tipada");
  }
});

test("BLOCKED -> COMPLETED é recusado com código próprio", () => {
  const bloqueada = applyLabAction(executando(), CAPTCHA);
  const depois = applyLabAction(bloqueada, COMPLETE);

  assert.ok(depois.violations.some((v) => v.code === "BLOCKED_NO_FORWARD"));
});

test("captcha expõe o fallback humano sem sugerir resolver o desafio", () => {
  const view = labSessionView(applyLabAction(executando(), CAPTCHA));

  assert.equal(view?.blocked, true);
  assert.ok(view?.humanFallbackNotice);
  assert.ok(view.humanFallbackNotice.includes("não resolve nem contorna"));
});

test("captcha não produz protocolo", () => {
  const state = applyLabAction(executando(), CAPTCHA);

  assert.equal(JSON.stringify(state.events).includes("PROT-FICT-"), false);
});

test("não existe ação de bypass de captcha no fluxo", () => {
  const code = sourceCode().toLowerCase();

  for (const proibido of ["bypass", "solvecaptcha", "skipcaptcha", "unblock", "2captcha"]) {
    assert.equal(code.includes(proibido), false, `o fluxo não pode conter ${proibido}`);
  }
});

test("as saídas de BLOCKED são só laterais e para trás", () => {
  const bloqueada = applyLabAction(executando(), CAPTCHA);

  assert.deepEqual(labSessionView(bloqueada)?.allowedTransitions, [
    "CANCELLED",
    "FAILED",
    "EXPIRED",
  ]);
  assert.equal(labSessionView(applyLabAction(bloqueada, CANCEL))?.state, "CANCELLED");
  assert.equal(labSessionView(applyLabAction(bloqueada, TIMEOUT))?.state, "FAILED");
  assert.equal(labSessionView(applyLabAction(bloqueada, EXPIRE))?.state, "EXPIRED");
});

// ---------------------------------------------------------------- expiração

test("expirar o handle termina em EXPIRED, não em falha genérica", () => {
  const state = applyLabAction(executando(), EXPIRE);

  assert.equal(labSessionView(state)?.state, "EXPIRED");
  assert.equal(state.events.at(-1)?.event, "synthetic_session_expired");
});

test("sessão expirada não continua", () => {
  const expirada = applyLabAction(executando(), EXPIRE);

  for (const acao of [NEXT_STEP, COMPLETE]) {
    const depois = applyLabAction(expirada, acao);

    assert.equal(labSessionView(depois)?.state, "EXPIRED");
    assert.deepEqual(eventNames(depois), eventNames(expirada));
  }
});

test("sessão expirada não reabre nem ganha prazo novo", () => {
  const expirada = applyLabAction(executando(), EXPIRE);
  const depois = applyLabAction(expirada, CONFIRM);

  assert.ok(depois.violations.some((v) => v.code === "TERMINAL_NO_REOPEN"));
  assert.equal(labSessionView(depois)?.expiresAt, labSessionView(expirada)?.expiresAt);
});

test("a interface indica que o terminal exige nova sessão", () => {
  assert.equal(labSessionView(applyLabAction(executando(), EXPIRE))?.terminal, true);
  assert.deepEqual(labSessionView(applyLabAction(executando(), EXPIRE))?.allowedTransitions, []);
});

// -------------------------------------------------------------- nova sessão

test("nova sessão só é permitida depois de um estado terminal", () => {
  const emExecucao = executando();
  const recusada = applyLabAction(emExecucao, NEW_SESSION);

  assert.equal(labSessionView(recusada)?.state, "IN_PROGRESS");
  assert.deepEqual(eventNames(recusada), eventNames(emExecucao));
  assert.equal(recusada.violations[0]?.code, "INVALID_STATE");
});

test("nova sessão tem identificadores sintéticos novos", () => {
  const expirada = applyLabAction(executando(), EXPIRE);
  const nova = applyLabAction(expirada, NEW_SESSION);

  const antes = labSessionView(expirada);
  const depois = labSessionView(nova);

  assert.equal(depois?.state, "CREATED");
  assert.equal(depois?.sessionNumber, 2);
  assert.notEqual(depois?.correlationId, antes?.correlationId);
  assert.notEqual(depois?.processId, antes?.processId);
  assert.notEqual(depois?.processCode, antes?.processCode);
  assert.notEqual(depois?.issuedAt, antes?.issuedAt);
});

test("nova sessão não reutiliza o handle antigo", () => {
  const expirada = applyLabAction(executando(), EXPIRE);
  const nova = applyLabAction(expirada, NEW_SESSION);

  assert.notEqual(nova.session?.sessionHandle, expirada.session?.sessionHandle);
  assert.equal(nova.session?.handoffState, "CREATED");
});

test("nova sessão preserva o histórico visual em memória", () => {
  const expirada = applyLabAction(executando(), EXPIRE);
  const nova = applyLabAction(expirada, NEW_SESSION);

  assert.equal(nova.events.length, expirada.events.length + 1);
  assert.deepEqual(eventNames(nova).slice(0, expirada.events.length), eventNames(expirada));
  assert.equal(nova.events.at(-1)?.event, "synthetic_session_created");
});

test("a sessão terminal permanece imutável", () => {
  const expirada = applyLabAction(executando(), EXPIRE);
  const copia = structuredClone(expirada.session);

  applyLabAction(expirada, NEW_SESSION);
  applyLabAction(expirada, CONFIRM);

  assert.deepEqual(expirada.session, copia);
});

test("nova sessão funciona a partir de qualquer terminal", () => {
  for (const acao of [EXPIRE, TIMEOUT, CANCEL]) {
    const terminal = applyLabAction(executando(), acao);
    assert.equal(labSessionView(terminal)?.terminal, true, `${acao.kind} deveria ser terminal`);

    const nova = applyLabAction(terminal, NEW_SESSION);
    assert.equal(labSessionView(nova)?.state, "CREATED", `falhou a partir de ${acao.kind}`);
  }
});

test("a nova sessão roda a jornada inteira do zero", () => {
  const nova = [EXPIRE, NEW_SESSION, HANDOFF, CONFIRM].reduce(applyLabAction, executando());

  assert.equal(labSessionView(nova)?.state, "IN_PROGRESS");
  assert.equal(
    nova.events.filter((event) => event.event === "synthetic_session_created").length,
    2,
    "uma criação por sessão",
  );
});

test("login não recria sessão quando já existe uma", () => {
  const state = applyLabAction(applyLabAction(initialLabFlowState(), LOGIN), LOGIN);

  assert.equal(state.violations[0]?.code, "INVALID_STATE");
  assert.equal(state.events.length, 1);
});

// ----------------------------------------------------------- garantias gerais

test("o histórico visual nunca expõe o sessionHandle, nem com várias sessões", () => {
  const nova = [EXPIRE, NEW_SESSION].reduce(applyLabAction, executando());

  assert.equal(JSON.stringify(nova.events).includes("sh_lab"), false);
  assert.equal(JSON.stringify(labSessionView(nova)).includes("sh_lab"), false);
});

test("reset continua limpando tudo, inclusive a contagem de sessões", () => {
  const nova = [EXPIRE, NEW_SESSION].reduce(applyLabAction, executando());

  assert.deepEqual(applyLabAction(nova, { kind: "reset" }), initialLabFlowState());
});

test("ações inválidas devolvem violação tipada sem tocar a sessão", () => {
  const bloqueada = applyLabAction(executando(), CAPTCHA);
  const depois = applyLabAction(bloqueada, CONFIRM);

  assert.ok(depois.violations.length > 0);
  assert.ok(depois.violations.every((v) => typeof v.code === "string" && v.code.length > 0));
  assert.deepEqual(depois.session, bloqueada.session);
});

test("as interrupções continuam determinísticas", () => {
  assert.deepEqual(applyLabAction(executando(), CAPTCHA), applyLabAction(executando(), CAPTCHA));
  assert.deepEqual(applyLabAction(executando(), EXPIRE), applyLabAction(executando(), EXPIRE));
  assert.deepEqual(applyLabAction(executando(), TIMEOUT), applyLabAction(executando(), TIMEOUT));
});

test("nenhuma segunda tabela de transições foi criada", () => {
  const code = sourceCode();

  assert.equal(code.includes("SYNTHETIC_TRANSITIONS"), false, "não lê a tabela direto");
  assert.ok(code.includes("getAllowedSyntheticTransitions"), "consulta pelo sessionState");
  assert.ok(code.includes("isSyntheticTerminalState"), "terminal vem do contrato");
});
