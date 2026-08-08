/**
 * Política pura do acionador administrativo manual
 * (`manualSyntheticDispatchPolicy.ts`) — decisão fechada, sem I/O.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateManualSyntheticDispatchPolicy } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchPolicy";
import type { ManualSyntheticDispatchPolicyInput } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchPolicy";
import type { ManualSyntheticDispatchAdminContext } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchTypes";

const REQUESTED_AT = "2026-08-14T10:00:00.000Z";
const DEADLINE = "2026-08-14T10:05:00.000Z";
const PAST_DEADLINE = "2026-08-14T09:00:00.000Z";

function context(overrides: Partial<ManualSyntheticDispatchAdminContext> = {}): ManualSyntheticDispatchAdminContext {
  return {
    role: "ADMIN",
    environment: "SYNTHETIC_LAB",
    explicitConfirmation: true,
    requestedBy: "admin-teste-0001",
    ...overrides,
  };
}

function baseInput(overrides: Partial<ManualSyntheticDispatchPolicyInput> = {}): ManualSyntheticDispatchPolicyInput {
  return {
    context: context(),
    reason: "validação de rotina",
    requestId: "req-0001",
    batchId: "batch-0001",
    maxRuns: 3,
    maxConcurrency: 2,
    deadlineAt: DEADLINE,
    requestedAt: REQUESTED_AT,
    health: "HEALTHY",
    readiness: "READY",
    recentRequestCount: 0,
    ...overrides,
  };
}

// -------------------------------------------------------- 1. solicitação válida

test("solicitação válida: ALLOWED", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput());
  assert.equal(result.decision, "ALLOWED");
});

// -------------------------------------------------------------- 2/3. papel

test("papel autorizado (ADMIN e OPERATOR): ALLOWED", () => {
  assert.equal(evaluateManualSyntheticDispatchPolicy(baseInput({ context: context({ role: "ADMIN" }) })).decision, "ALLOWED");
  assert.equal(evaluateManualSyntheticDispatchPolicy(baseInput({ context: context({ role: "OPERATOR" }) })).decision, "ALLOWED");
});

test("papel não autorizado: DENIED_ROLE", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ context: context({ role: "SUPPORT" as never }) }));
  assert.equal(result.decision, "DENIED_ROLE");
});

// -------------------------------------------------------------- 4. ambiente

test("ambiente diferente de SYNTHETIC_LAB: DENIED_ENVIRONMENT", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ context: context({ environment: "PRODUCTION" as never }) }));
  assert.equal(result.decision, "DENIED_ENVIRONMENT");
});

// -------------------------------------------------------------- 5. confirmação

test("confirmação ausente: DENIED_CONFIRMATION", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ context: context({ explicitConfirmation: false }) }));
  assert.equal(result.decision, "DENIED_CONFIRMATION");
});

test("solicitante ausente: DENIED_CONFIGURATION (não confundido com confirmação)", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ context: context({ requestedBy: "  " }) }));
  assert.equal(result.decision, "DENIED_CONFIGURATION");
});

// -------------------------------------------------------------- 6. motivo vazio

test("motivo vazio: DENIED_REASON", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ reason: "   " }));
  assert.equal(result.decision, "DENIED_REASON");
});

// -------------------------------------------------------------- 7/8. ids obrigatórios

test("requestId vazio: DENIED_CONFIGURATION", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ requestId: "" }));
  assert.equal(result.decision, "DENIED_CONFIGURATION");
});

test("batchId vazio: DENIED_CONFIGURATION", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ batchId: "" }));
  assert.equal(result.decision, "DENIED_CONFIGURATION");
});

// -------------------------------------------------------------- 9. limite de runs

test("maxRuns fora do limite administrativo (0, negativo, acima do teto, não-inteiro): DENIED_CONFIGURATION", () => {
  for (const maxRuns of [0, -1, 11, 1.5]) {
    const result = evaluateManualSyntheticDispatchPolicy(baseInput({ maxRuns }));
    assert.equal(result.decision, "DENIED_CONFIGURATION", `maxRuns=${maxRuns}`);
  }
});

// -------------------------------------------------------------- 10. concorrência inválida

test("maxConcurrency fora do limite administrativo (0, negativo, acima do teto): DENIED_CONFIGURATION", () => {
  for (const maxConcurrency of [0, -1, 6]) {
    const result = evaluateManualSyntheticDispatchPolicy(baseInput({ maxConcurrency }));
    assert.equal(result.decision, "DENIED_CONFIGURATION", `maxConcurrency=${maxConcurrency}`);
  }
});

// ------------------------------------------------------ 11. concorrência > runs

test("maxConcurrency maior que maxRuns: DENIED_CONFIGURATION", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ maxRuns: 2, maxConcurrency: 3 }));
  assert.equal(result.decision, "DENIED_CONFIGURATION");
});

// -------------------------------------------------------------- 12. deadline passada

test("deadline no passado (ou igual ao instante do pedido): DENIED_CONFIGURATION", () => {
  assert.equal(evaluateManualSyntheticDispatchPolicy(baseInput({ deadlineAt: PAST_DEADLINE })).decision, "DENIED_CONFIGURATION");
  assert.equal(evaluateManualSyntheticDispatchPolicy(baseInput({ deadlineAt: REQUESTED_AT })).decision, "DENIED_CONFIGURATION");
});

test("deadline inválida (não parseável) ou infinita: DENIED_CONFIGURATION", () => {
  assert.equal(evaluateManualSyntheticDispatchPolicy(baseInput({ deadlineAt: "não é uma data" })).decision, "DENIED_CONFIGURATION");
});

// -------------------------------------------------------------- 13/14/15/16. health

test("health HEALTHY: ALLOWED", () => {
  assert.equal(evaluateManualSyntheticDispatchPolicy(baseInput({ health: "HEALTHY" })).decision, "ALLOWED");
});

test("health DEGRADED permitido quando a política explicita allowDegradedHealth", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ health: "DEGRADED" }), {
    allowedRoles: ["ADMIN", "OPERATOR"],
    allowDegradedHealth: true,
    maxRecentRequests: 20,
  });
  assert.equal(result.decision, "ALLOWED");
});

test("health DEGRADED recusado por padrão (allowDegradedHealth: false)", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ health: "DEGRADED" }));
  assert.equal(result.decision, "DENIED_HEALTH");
});

test("health UNHEALTHY sempre recusado, mesmo com allowDegradedHealth", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ health: "UNHEALTHY" }), {
    allowedRoles: ["ADMIN", "OPERATOR"],
    allowDegradedHealth: true,
    maxRecentRequests: 20,
  });
  assert.equal(result.decision, "DENIED_HEALTH");
});

// -------------------------------------------------------------- 17/18/19. readiness

test("readiness READY: ALLOWED", () => {
  assert.equal(evaluateManualSyntheticDispatchPolicy(baseInput({ readiness: "READY" })).decision, "ALLOWED");
});

test("readiness NOT_READY: DENIED_READINESS", () => {
  assert.equal(evaluateManualSyntheticDispatchPolicy(baseInput({ readiness: "NOT_READY" })).decision, "DENIED_READINESS");
});

test("readiness BLOCKED: DENIED_READINESS", () => {
  assert.equal(evaluateManualSyntheticDispatchPolicy(baseInput({ readiness: "BLOCKED" })).decision, "DENIED_READINESS");
});

// -------------------------------------------------------------------- rate limit

test("recentRequestCount atingindo o teto configurado: DENIED_RATE_LIMIT", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ recentRequestCount: 20 }));
  assert.equal(result.decision, "DENIED_RATE_LIMIT");
});

test("recentRequestCount abaixo do teto: ALLOWED", () => {
  const result = evaluateManualSyntheticDispatchPolicy(baseInput({ recentRequestCount: 19 }));
  assert.equal(result.decision, "ALLOWED");
});

// ------------------------------------------------------------------------ pureza

test("função é pura: mesma entrada produz sempre a mesma saída", () => {
  const input = baseInput();
  const a = evaluateManualSyntheticDispatchPolicy(input);
  const b = evaluateManualSyntheticDispatchPolicy(input);
  assert.deepEqual(a, b);
});

test("nunca lança erro para recusa normal — sempre devolve decisão tipada", () => {
  assert.doesNotThrow(() => evaluateManualSyntheticDispatchPolicy(baseInput({ context: context({ role: "GUEST" as never }) })));
});
