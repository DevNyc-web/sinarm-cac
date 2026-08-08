/**
 * Saúde técnica do motor sintético (`syntheticEngineHealth.ts`) — pura,
 * separada de readiness (`syntheticEngineReadiness.test.ts`).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSyntheticEngineHealth } from "../../../src/server/automation/synthetic/observability/syntheticEngineHealth";
import { zeroSyntheticEngineMetrics } from "../../../src/server/automation/synthetic/observability/syntheticEngineMetrics";

function baseInput(overrides: Partial<Parameters<typeof buildSyntheticEngineHealth>[0]> = {}) {
  return {
    storeAccessible: true,
    configValid: true,
    internalErrorOccurred: false,
    corruptedRecordDetected: false,
    lastBatchHadIsolatedFailures: false,
    metrics: zeroSyntheticEngineMetrics(),
    ...overrides,
  };
}

// -------------------------------------------------------------- 25. HEALTHY

test("HEALTHY: store acessível, config válida, sem acúmulo além do limite", () => {
  const status = buildSyntheticEngineHealth(baseInput());
  assert.equal(status, "HEALTHY");
});

// -------------------------------------------------------------- 31. ausência de trabalho

test("ausência de runs não é falha: métricas zeradas continuam HEALTHY", () => {
  const status = buildSyntheticEngineHealth(baseInput({ metrics: zeroSyntheticEngineMetrics() }));
  assert.equal(status, "HEALTHY");
});

// -------------------------------------------------------------- 33. Fase 9

test("Fase 9 desabilitada não é um sinal de health — a entrada nem tem esse campo", () => {
  const status = buildSyntheticEngineHealth(baseInput());
  assert.equal(status, "HEALTHY");
  // `SyntheticEngineHealthInput` não tem campo phase9/realExecution — a
  // única forma de este teste falhar seria adicionar acoplamento indevido.
});

// -------------------------------------------------------------- 26. DEGRADED

test("DEGRADED: claims expirados acima do limite configurado", () => {
  const status = buildSyntheticEngineHealth(
    baseInput({ metrics: { ...zeroSyntheticEngineMetrics(), claimsExpired: 10 } }),
  );
  assert.equal(status, "DEGRADED");
});

test("DEGRADED: runs recuperáveis acumulados acima do limite", () => {
  const status = buildSyntheticEngineHealth(
    baseInput({ metrics: { ...zeroSyntheticEngineMetrics(), runsRecoverable: 50 } }),
  );
  assert.equal(status, "DEGRADED");
});

test("DEGRADED: conflitos (claim + versão) acima do limite", () => {
  const status = buildSyntheticEngineHealth(
    baseInput({ metrics: { ...zeroSyntheticEngineMetrics(), claimConflicts: 3, versionConflicts: 3 } }),
  );
  assert.equal(status, "DEGRADED");
});

test("DEGRADED: último lote com falhas isoladas, mas motor funcional", () => {
  const status = buildSyntheticEngineHealth(baseInput({ lastBatchHadIsolatedFailures: true }));
  assert.equal(status, "DEGRADED");
});

test("limite configurável: threshold customizado muda o corte HEALTHY/DEGRADED", () => {
  const metrics = { ...zeroSyntheticEngineMetrics(), claimsExpired: 1 };
  const withDefault = buildSyntheticEngineHealth(baseInput({ metrics }));
  const withTightThreshold = buildSyntheticEngineHealth(baseInput({ metrics, thresholds: { maxAcceptableClaimsExpired: 0 } }));
  assert.equal(withDefault, "HEALTHY");
  assert.equal(withTightThreshold, "DEGRADED");
});

// -------------------------------------------------------------- 27. UNHEALTHY

test("UNHEALTHY: store inacessível vence qualquer outra coisa", () => {
  const status = buildSyntheticEngineHealth(baseInput({ storeAccessible: false }));
  assert.equal(status, "UNHEALTHY");
});

test("UNHEALTHY: configuração inválida", () => {
  const status = buildSyntheticEngineHealth(baseInput({ configValid: false }));
  assert.equal(status, "UNHEALTHY");
});

test("UNHEALTHY: erro interno inesperado", () => {
  const status = buildSyntheticEngineHealth(baseInput({ internalErrorOccurred: true }));
  assert.equal(status, "UNHEALTHY");
});

test("UNHEALTHY: registro corrompido/inválido detectado", () => {
  const status = buildSyntheticEngineHealth(baseInput({ corruptedRecordDetected: true }));
  assert.equal(status, "UNHEALTHY");
});

test("UNHEALTHY vence DEGRADED: store inacessível mesmo com métricas dentro do limite", () => {
  const status = buildSyntheticEngineHealth(baseInput({ storeAccessible: false, metrics: zeroSyntheticEngineMetrics() }));
  assert.equal(status, "UNHEALTHY");
});

test("função é pura: mesma entrada produz sempre a mesma saída", () => {
  const input = baseInput({ metrics: { ...zeroSyntheticEngineMetrics(), claimsExpired: 1 } });
  const a = buildSyntheticEngineHealth(input);
  const b = buildSyntheticEngineHealth(input);
  assert.equal(a, b);
});
