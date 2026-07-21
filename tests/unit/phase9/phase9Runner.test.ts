/**
 * Fase 9 — Testes do runner (execucao real bloqueada por padrao).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { runPhase9 } from "../../../src/server/automation/phase9/phase9Runner";
import type { Phase9ExecutionRequest } from "../../../src/server/automation/phase9/types";

function baseRequest(overrides: Partial<Phase9ExecutionRequest> = {}): Phase9ExecutionRequest {
  return {
    executionId: "exec-1",
    processId: "proc-1",
    requestedByUserId: "user-1",
    authorizedAccountLabel: "Conta propria (dev)",
    stopPoint: "DADOS_DA_GRU",
    dryRun: true,
    allowRealExternalAccess: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("runner bloqueia execucao real por padrao (pedido valido)", () => {
  const result = runPhase9(baseRequest());
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.status, "BLOCKED");
});

test("mensagem menciona docs/34 §16 pendente", () => {
  const result = runPhase9(baseRequest());
  assert.match(result.message, /docs\/34 §16/);
});

test("resultado inclui sessionDiscarded true", () => {
  const result = runPhase9(baseRequest());
  assert.equal(result.sessionDiscarded, true);
});

test("runner exige dryRun true", () => {
  const result = runPhase9(baseRequest({ dryRun: false }));
  assert.equal(result.blocked, true);
  assert.equal(result.sessionDiscarded, true);
  assert.match(result.message, /dryRun/i);
});

test("runner exige allowRealExternalAccess false", () => {
  const result = runPhase9(baseRequest({ allowRealExternalAccess: true }));
  assert.equal(result.blocked, true);
  assert.match(result.message, /allowRealExternalAccess/i);
});

test("runner exige stopPoint DADOS_DA_GRU", () => {
  const result = runPhase9(baseRequest({ stopPoint: "OUTRO" as never }));
  assert.equal(result.blocked, true);
  assert.match(result.message, /DADOS_DA_GRU/);
});

test("nenhum artifact e gerado; todas as etapas ficam BLOCKED", () => {
  const result = runPhase9(baseRequest());
  assert.deepEqual(result.artifacts, []);
  assert.ok(result.steps.length > 0);
  assert.ok(result.steps.every((s) => s.status === "BLOCKED"));
});

test("auditoria registra criacao e aborto sem vazar segredo", () => {
  const result = runPhase9(baseRequest());
  const types = result.auditEvents.map((e) => e.type);
  assert.ok(types.includes("EXECUTION_CREATED"));
  assert.ok(types.includes("EXECUTION_ABORTED"));
  assert.ok(types.includes("SESSION_DISCARDED"));
});
