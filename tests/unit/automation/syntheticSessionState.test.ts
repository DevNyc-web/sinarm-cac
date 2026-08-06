/**
 * Fase 2 — helpers puros da máquina de estados sintética (docs/74).
 *
 * Cobre a allow-list de transições, os estados terminais/bloqueado e as
 * descrições estáveis, sem I/O, sem Prisma, sem Playwright e sem Fase 9.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SYNTHETIC_HANDOFF_STATES } from "../../../src/server/automation/synthetic/sessionContract";
import {
  assertSyntheticTransition,
  canMoveSyntheticSession,
  describeSyntheticState,
  describeSyntheticTransitionError,
  getAllowedSyntheticTransitions,
  isSyntheticBlockedState,
  isSyntheticTerminalState,
} from "../../../src/server/automation/synthetic/sessionState";

const SOURCE_PATH = "src/server/automation/synthetic/sessionState.ts";

// ------------------------------------------------------------- transições

test("getAllowedSyntheticTransitions retorna as transições permitidas por estado", () => {
  assert.deepEqual(getAllowedSyntheticTransitions("CREATED"), ["CLAIMED", "EXPIRED", "CANCELLED"]);
  assert.deepEqual(getAllowedSyntheticTransitions("CLAIMED"), [
    "IN_PROGRESS",
    "EXPIRED",
    "CANCELLED",
  ]);
  assert.deepEqual(getAllowedSyntheticTransitions("IN_PROGRESS"), [
    "COMPLETED",
    "BLOCKED",
    "FAILED",
    "EXPIRED",
    "CANCELLED",
  ]);
  assert.deepEqual(getAllowedSyntheticTransitions("BLOCKED"), ["CANCELLED", "FAILED", "EXPIRED"]);
  for (const terminal of ["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"]) {
    assert.deepEqual(getAllowedSyntheticTransitions(terminal), []);
  }
  assert.deepEqual(getAllowedSyntheticTransitions("PAUSED"), [], "estado desconhecido -> vazio");
});

test("CREATED vai para CLAIMED, EXPIRED, CANCELLED", () => {
  assert.equal(canMoveSyntheticSession("CREATED", "CLAIMED"), true);
  assert.equal(canMoveSyntheticSession("CREATED", "EXPIRED"), true);
  assert.equal(canMoveSyntheticSession("CREATED", "CANCELLED"), true);
  assert.equal(canMoveSyntheticSession("CREATED", "IN_PROGRESS"), false);
});

test("CLAIMED vai para IN_PROGRESS, EXPIRED, CANCELLED", () => {
  assert.equal(canMoveSyntheticSession("CLAIMED", "IN_PROGRESS"), true);
  assert.equal(canMoveSyntheticSession("CLAIMED", "EXPIRED"), true);
  assert.equal(canMoveSyntheticSession("CLAIMED", "CANCELLED"), true);
  assert.equal(canMoveSyntheticSession("CLAIMED", "COMPLETED"), false);
});

test("IN_PROGRESS vai para COMPLETED, BLOCKED, FAILED, EXPIRED, CANCELLED", () => {
  for (const to of ["COMPLETED", "BLOCKED", "FAILED", "EXPIRED", "CANCELLED"]) {
    assert.equal(canMoveSyntheticSession("IN_PROGRESS", to), true, `IN_PROGRESS -> ${to}`);
  }
  assert.equal(canMoveSyntheticSession("IN_PROGRESS", "CLAIMED"), false);
});

test("BLOCKED vai para CANCELLED, FAILED, EXPIRED", () => {
  assert.equal(canMoveSyntheticSession("BLOCKED", "CANCELLED"), true);
  assert.equal(canMoveSyntheticSession("BLOCKED", "FAILED"), true);
  assert.equal(canMoveSyntheticSession("BLOCKED", "EXPIRED"), true);
});

test("BLOCKED não vai para COMPLETED nem IN_PROGRESS", () => {
  assert.equal(canMoveSyntheticSession("BLOCKED", "COMPLETED"), false);
  assert.equal(canMoveSyntheticSession("BLOCKED", "IN_PROGRESS"), false);
});

test("COMPLETED não sai para ninguém", () => {
  for (const to of SYNTHETIC_HANDOFF_STATES) {
    assert.equal(canMoveSyntheticSession("COMPLETED", to), false, `COMPLETED -> ${to}`);
  }
});

test("FAILED não sai para ninguém", () => {
  for (const to of SYNTHETIC_HANDOFF_STATES) {
    assert.equal(canMoveSyntheticSession("FAILED", to), false, `FAILED -> ${to}`);
  }
});

test("EXPIRED não sai para ninguém", () => {
  for (const to of SYNTHETIC_HANDOFF_STATES) {
    assert.equal(canMoveSyntheticSession("EXPIRED", to), false, `EXPIRED -> ${to}`);
  }
});

test("CANCELLED não sai para ninguém", () => {
  for (const to of SYNTHETIC_HANDOFF_STATES) {
    assert.equal(canMoveSyntheticSession("CANCELLED", to), false, `CANCELLED -> ${to}`);
  }
});

test("canMoveSyntheticSession retorna true para transições válidas", () => {
  assert.equal(canMoveSyntheticSession("CREATED", "CLAIMED"), true);
  assert.equal(canMoveSyntheticSession("IN_PROGRESS", "COMPLETED"), true);
});

test("canMoveSyntheticSession retorna false para transições inválidas", () => {
  assert.equal(canMoveSyntheticSession("CREATED", "COMPLETED"), false);
  assert.equal(canMoveSyntheticSession("COMPLETED", "IN_PROGRESS"), false);
  assert.equal(canMoveSyntheticSession("PAUSED", "CLAIMED"), false, "estado desconhecido");
});

// -------------------------------------------------------------- estados

test("isSyntheticTerminalState identifica os 4 terminais", () => {
  const terminals = ["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"];
  for (const state of SYNTHETIC_HANDOFF_STATES) {
    assert.equal(isSyntheticTerminalState(state), terminals.includes(state), state);
  }
  assert.equal(isSyntheticTerminalState("BLOCKED"), false, "BLOCKED não é terminal");
  assert.equal(isSyntheticTerminalState("PAUSED"), false);
});

test("isSyntheticBlockedState identifica BLOCKED", () => {
  for (const state of SYNTHETIC_HANDOFF_STATES) {
    assert.equal(isSyntheticBlockedState(state), state === "BLOCKED", state);
  }
  assert.equal(isSyntheticBlockedState("PAUSED"), false);
});

// ---------------------------------------------------------------- assert

test("assertSyntheticTransition não lança para transição válida", () => {
  assert.doesNotThrow(() => assertSyntheticTransition("CREATED", "CLAIMED"));
  assert.doesNotThrow(() => assertSyntheticTransition("BLOCKED", "EXPIRED"));
});

test("assertSyntheticTransition lança para transição inválida", () => {
  assert.throws(() => assertSyntheticTransition("BLOCKED", "COMPLETED"));
  assert.throws(() => assertSyntheticTransition("COMPLETED", "IN_PROGRESS"));
});

// -------------------------------------------------------------- descrições

test("describeSyntheticState retorna texto estável para cada estado, sem dado sensível", () => {
  for (const state of SYNTHETIC_HANDOFF_STATES) {
    const first = describeSyntheticState(state);
    const second = describeSyntheticState(state);
    assert.equal(first, second, "determinístico");
    assert.ok(first.startsWith(state));
    for (const forbidden of ["senha", "password", "cookie", "cpf", "token"]) {
      assert.equal(first.toLowerCase().includes(forbidden), false);
    }
  }
  assert.ok(describeSyntheticState("PAUSED").includes("desconhecido"));
});

test("describeSyntheticTransitionError retorna mensagem útil e estável", () => {
  const first = describeSyntheticTransitionError("BLOCKED", "COMPLETED");
  const second = describeSyntheticTransitionError("BLOCKED", "COMPLETED");
  assert.equal(first, second);
  assert.ok(first.includes("BLOCKED"));
  assert.ok(first.includes("COMPLETED"));

  const terminalReopen = describeSyntheticTransitionError("COMPLETED", "IN_PROGRESS");
  assert.ok(terminalReopen.includes("terminal"));

  const unknownState = describeSyntheticTransitionError("PAUSED", "CLAIMED");
  assert.ok(unknownState.includes("desconhecido"));
});

// ------------------------------------------------------- provas estruturais

function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("o módulo não importa Prisma, Playwright, phase9, fs ou rede", () => {
  const code = sourceCode();
  for (const forbidden of [
    "@prisma/client",
    "playwright",
    "phase9",
    "node:fs",
    "node:http",
    "node:https",
    "fetch(",
  ]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

test("o módulo não lê process.env nem usa Date.now, Math.random ou new Date", () => {
  const code = sourceCode();
  assert.equal(code.includes("process.env"), false);
  assert.equal(code.includes("Date.now()"), false);
  assert.equal(code.includes("Math.random()"), false);
  assert.equal(code.includes("new Date()"), false);
});
