/**
 * Prontidão operacional do motor sintético (`syntheticEngineReadiness.ts`)
 * — pura, separada de health (`syntheticEngineHealth.test.ts`).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSyntheticEngineReadiness } from "../../../src/server/automation/synthetic/observability/syntheticEngineReadiness";

function baseInput(overrides: Partial<Parameters<typeof buildSyntheticEngineReadiness>[0]> = {}) {
  return {
    storeAvailable: true,
    executorAvailable: true,
    configValid: true,
    requiredDependenciesPresent: true,
    operationalBlock: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------- 28. READY

test("READY: store, executor, config e dependências ok, sem bloqueio", () => {
  assert.equal(buildSyntheticEngineReadiness(baseInput()), "READY");
});

// ------------------------------------------------------------ 29. NOT_READY

test("NOT_READY: store indisponível", () => {
  assert.equal(buildSyntheticEngineReadiness(baseInput({ storeAvailable: false })), "NOT_READY");
});

test("NOT_READY: executor indisponível", () => {
  assert.equal(buildSyntheticEngineReadiness(baseInput({ executorAvailable: false })), "NOT_READY");
});

test("NOT_READY: configuração inválida", () => {
  assert.equal(buildSyntheticEngineReadiness(baseInput({ configValid: false })), "NOT_READY");
});

test("NOT_READY: dependência obrigatória ausente", () => {
  assert.equal(buildSyntheticEngineReadiness(baseInput({ requiredDependenciesPresent: false })), "NOT_READY");
});

// -------------------------------------------------------------- 30. BLOCKED

test("BLOCKED: bloqueio operacional explícito vence tudo, mesmo com o resto ok", () => {
  assert.equal(buildSyntheticEngineReadiness(baseInput({ operationalBlock: true })), "BLOCKED");
});

test("BLOCKED vence NOT_READY: bloqueio junto com dependência ausente ainda é BLOCKED", () => {
  const status = buildSyntheticEngineReadiness(baseInput({ operationalBlock: true, storeAvailable: false }));
  assert.equal(status, "BLOCKED");
});

// -------------------------------------------------- 32. execução real desabilitada

test("execução real desabilitada não é um campo desta função — o laboratório sintético continua READY", () => {
  // `SyntheticEngineReadinessInput` deliberadamente não tem
  // `phase9`/`realExecutionEnabled`: readiness do motor SINTÉTICO nunca
  // depende disso.
  const status = buildSyntheticEngineReadiness(baseInput());
  assert.equal(status, "READY");
});

// ------------------------------------------- 34. sessão ausente em item isolado

test("sessão ausente em UM run não é um campo desta função — readiness global não cai por isso", () => {
  // A mesma lógica: `SESSION_REQUIRED` é outcome de ITEM (métrica/log), não
  // entrada de readiness — a função nem aceita esse dado.
  const status = buildSyntheticEngineReadiness(baseInput());
  assert.equal(status, "READY");
});

test("função é pura: mesma entrada produz sempre a mesma saída", () => {
  const input = baseInput({ storeAvailable: false });
  assert.equal(buildSyntheticEngineReadiness(input), buildSyntheticEngineReadiness(input));
});
