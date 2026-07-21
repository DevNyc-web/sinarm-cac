/**
 * Fase 9 — Testes de seguranca do safety.ts.
 * Sem dependencia nova: node:test + node:assert, rodados via tsx.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateSafety,
  isPhase9RealExecutionEnabled,
  PHASE9_REAL_EXECUTION_ENABLED,
  assertNotRealMode,
  assertNoRealGru,
} from "../../../src/server/automation/phase9/safety";
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

test("pedido valido passa nos safety checks", () => {
  const decision = evaluateSafety(baseRequest());
  assert.equal(decision.allowed, true);
  assert.equal(decision.code, "OK");
});

test("exige stopPoint DADOS_DA_GRU", () => {
  const decision = evaluateSafety(baseRequest({ stopPoint: "OUTRO" as never }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "STOP_POINT_INVALID");
});

test("exige dryRun true", () => {
  const decision = evaluateSafety(baseRequest({ dryRun: false }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "DRY_RUN_REQUIRED");
});

test("exige allowRealExternalAccess false", () => {
  const decision = evaluateSafety(baseRequest({ allowRealExternalAccess: true }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "REAL_ACCESS_BLOCKED");
});

test("bloqueia pedido que referencia sistema oficial real", () => {
  const decision = evaluateSafety(baseRequest({ authorizedAccountLabel: "conta servicos.pf.gov.br" }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "REAL_DATA_BLOCKED");
});

test("execucao real esta desabilitada por padrao", () => {
  assert.equal(PHASE9_REAL_EXECUTION_ENABLED, false);
  assert.equal(isPhase9RealExecutionEnabled(), false);
});

test("assertNotRealMode sempre bloqueia nesta fase", () => {
  const decision = assertNotRealMode();
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "REAL_MODE_BLOCKED");
});

test("assertNoRealGru sempre bloqueia ato irreversivel", () => {
  const decision = assertNoRealGru("Gerar GRU e Salvar");
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "REAL_GRU_BLOCKED");
});
