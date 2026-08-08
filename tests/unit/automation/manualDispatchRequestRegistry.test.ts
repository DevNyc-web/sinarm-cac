/**
 * Registro em memória de pedidos administrativos
 * (`inMemoryManualDispatchRequestRegistry.ts`) e fingerprint puro
 * (`manualDispatchRequestRegistry.ts`) — isolamento por instância, cópia
 * defensiva, contagem.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { computeManualDispatchRequestFingerprint } from "../../../src/server/automation/synthetic/admin/manualDispatchRequestRegistry";
import { InMemoryManualDispatchRequestRegistry } from "../../../src/server/automation/synthetic/admin/inMemoryManualDispatchRequestRegistry";
import type { ManualSyntheticDispatchResult } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchTypes";

function fakeResult(overrides: Partial<ManualSyntheticDispatchResult> = {}): ManualSyntheticDispatchResult {
  return {
    requestId: "req-1",
    batchId: "batch-1",
    requestedAt: "2026-08-14T10:00:00.000Z",
    completedAt: "2026-08-14T10:00:01.000Z",
    requestedBy: "admin-teste",
    reason: "motivo redigido",
    decision: "ALLOWED",
    outcome: "DISPATCH_COMPLETED",
    batch: { stopReason: "LIMIT_REACHED", requested: 1, dispatched: 1, completed: 1, conflicted: 0, noWork: 0, interrupted: 0 },
    metrics: null,
    health: "HEALTHY",
    readiness: "READY",
    warnings: [],
    ...overrides,
  };
}

function fingerprintInput() {
  return { batchId: "batch-1", requestedBy: "admin-teste", reason: "motivo", maxRuns: 2, maxConcurrency: 1, deadlineAt: "2026-08-14T10:05:00.000Z" };
}

test("fingerprint é determinístico: mesma entrada produz a mesma string", () => {
  const a = computeManualDispatchRequestFingerprint(fingerprintInput());
  const b = computeManualDispatchRequestFingerprint(fingerprintInput());
  assert.equal(a, b);
});

test("fingerprint muda quando qualquer campo relevante muda", () => {
  const base = computeManualDispatchRequestFingerprint(fingerprintInput());
  assert.notEqual(computeManualDispatchRequestFingerprint({ ...fingerprintInput(), maxRuns: 3 }), base);
  assert.notEqual(computeManualDispatchRequestFingerprint({ ...fingerprintInput(), reason: "outro motivo" }), base);
  assert.notEqual(computeManualDispatchRequestFingerprint({ ...fingerprintInput(), deadlineAt: "2026-08-14T10:06:00.000Z" }), base);
});

// --------------------------------------------------------------- 39. isolamento

test("InMemoryManualDispatchRequestRegistry: duas instâncias nunca compartilham estado", async () => {
  const a = new InMemoryManualDispatchRequestRegistry();
  const b = new InMemoryManualDispatchRequestRegistry();

  await a.save({ requestId: "req-1", fingerprint: "fp-1", result: fakeResult() });

  assert.equal(await a.count(), 1);
  assert.equal(await b.count(), 0);
  assert.equal(await b.find("req-1"), null);
});

// ------------------------------------------------------------- 40. cópias defensivas

test("find() devolve cópia defensiva — mutar o retorno não afeta o registro", async () => {
  const registry = new InMemoryManualDispatchRequestRegistry();
  await registry.save({ requestId: "req-1", fingerprint: "fp-1", result: fakeResult({ warnings: [{ code: "PARTIAL_BATCH", detail: "x" }] }) });

  const found = await registry.find("req-1");
  assert.ok(found);
  (found!.result as { reason: string }).reason = "adulterado";
  (found!.result.warnings[0] as { detail: string }).detail = "adulterado";

  const secondLookup = await registry.find("req-1");
  assert.equal(secondLookup!.result.reason, "motivo redigido");
  assert.equal(secondLookup!.result.warnings[0]!.detail, "x");
});

test("save() não é afetado por mutar o objeto original depois", async () => {
  const registry = new InMemoryManualDispatchRequestRegistry();
  const result = fakeResult();
  await registry.save({ requestId: "req-1", fingerprint: "fp-1", result });
  result.reason = "mudou depois do save";

  const found = await registry.find("req-1");
  assert.equal(found!.result.reason, "motivo redigido");
});

test("count() reflete a quantidade de requestIds distintos registrados", async () => {
  const registry = new InMemoryManualDispatchRequestRegistry();
  await registry.save({ requestId: "req-1", fingerprint: "fp-1", result: fakeResult({ requestId: "req-1" }) });
  await registry.save({ requestId: "req-2", fingerprint: "fp-2", result: fakeResult({ requestId: "req-2" }) });
  assert.equal(await registry.count(), 2);
});

test("clear() limpa só a própria instância", async () => {
  const a = new InMemoryManualDispatchRequestRegistry();
  const b = new InMemoryManualDispatchRequestRegistry();
  await a.save({ requestId: "req-1", fingerprint: "fp-1", result: fakeResult() });
  await b.save({ requestId: "req-1", fingerprint: "fp-1", result: fakeResult() });

  a.clear();

  assert.equal(await a.count(), 0);
  assert.equal(await b.count(), 1);
});

test("find() de requestId ausente devolve null", async () => {
  const registry = new InMemoryManualDispatchRequestRegistry();
  assert.equal(await registry.find("nunca-existiu"), null);
});
