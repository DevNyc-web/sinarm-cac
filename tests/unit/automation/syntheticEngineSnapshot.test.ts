/**
 * Snapshot operacional do motor sintético (`syntheticEngineSnapshot.ts`) —
 * combina métricas/health/readiness já calculados, sem carregar run
 * completo, sessão ou handle.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SYNTHETIC_ENGINE_SNAPSHOT_FORMAT_VERSION,
  buildSyntheticEngineOperationalSnapshot,
  validateSyntheticEngineOperationalSnapshot,
} from "../../../src/server/automation/synthetic/observability/syntheticEngineSnapshot";
import { zeroSyntheticEngineMetrics } from "../../../src/server/automation/synthetic/observability/syntheticEngineMetrics";

const TS = "2026-08-13T10:00:00.000Z";

function baseSnapshotInput(overrides: Partial<Parameters<typeof buildSyntheticEngineOperationalSnapshot>[0]> = {}) {
  return {
    timestamp: TS,
    metrics: zeroSyntheticEngineMetrics(),
    health: "HEALTHY" as const,
    readiness: "READY" as const,
    ...overrides,
  };
}

test("snapshot traz formatVersion, timestamp, métricas, health e readiness", () => {
  const snapshot = buildSyntheticEngineOperationalSnapshot(baseSnapshotInput());
  assert.equal(snapshot.formatVersion, SYNTHETIC_ENGINE_SNAPSHOT_FORMAT_VERSION);
  assert.equal(snapshot.timestamp, TS);
  assert.equal(snapshot.health, "HEALTHY");
  assert.equal(snapshot.readiness, "READY");
  assert.deepEqual(snapshot.metrics, zeroSyntheticEngineMetrics());
  assert.equal(snapshot.lastBatch, null);
});

// -------------------------------------------------------- 35. claims expirados

test("claims expirados geram aviso tipado", () => {
  const snapshot = buildSyntheticEngineOperationalSnapshot(
    baseSnapshotInput({ metrics: { ...zeroSyntheticEngineMetrics(), claimsExpired: 2 } }),
  );
  assert.ok(snapshot.warnings.some((w) => w.code === "CLAIMS_EXPIRED_PRESENT"));
  assert.equal(snapshot.claimsExpiredCount, 2);
});

test("sem claim expirado, nenhum aviso de claim é gerado", () => {
  const snapshot = buildSyntheticEngineOperationalSnapshot(baseSnapshotInput());
  assert.equal(snapshot.warnings.some((w) => w.code === "CLAIMS_EXPIRED_PRESENT"), false);
});

// ------------------------------------------------------ 36. runs recuperáveis

test("runs recuperáveis aparecem no snapshot com contagem e aviso", () => {
  const snapshot = buildSyntheticEngineOperationalSnapshot(
    baseSnapshotInput({ metrics: { ...zeroSyntheticEngineMetrics(), runsRecoverable: 4 } }),
  );
  assert.equal(snapshot.runsRecoverableCount, 4);
  assert.ok(snapshot.warnings.some((w) => w.code === "RUNS_RECOVERABLE_PRESENT"));
});

// -------------------------------------------------- 37. sem objeto de run completo

test("snapshot não contém objetos completos de run, sessão ou handle", () => {
  const snapshot = buildSyntheticEngineOperationalSnapshot(
    baseSnapshotInput({
      lastBatch: {
        stopReason: "LIMIT_REACHED",
        requested: 2,
        dispatched: 2,
        completed: 2,
        conflicted: 0,
        noWork: 0,
        interrupted: 0,
        startedAt: TS,
        finishedAt: TS,
      },
    }),
  );
  const serialized = JSON.stringify(snapshot).toLowerCase();
  for (const forbidden of ["sessionhandle", "\"plan\"", "pendingsteps", "completedsteps", "\"evidence\"", "\"events\"", "sh_"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
  assert.equal(typeof snapshot.metrics.evidenceProduced, "number", "evidência é só um número, nunca a lista integral");
  assert.equal(typeof snapshot.metrics.eventsProduced, "number", "evento é só um número, nunca a lista integral");
});

// ------------------------------------------------------------- 38. validação

test("snapshot bem formado passa na validação", () => {
  const snapshot = buildSyntheticEngineOperationalSnapshot(baseSnapshotInput());
  const validation = validateSyntheticEngineOperationalSnapshot(snapshot);
  assert.equal(validation.ok, true);
});

test("validação rejeita campo desconhecido no snapshot", () => {
  const snapshot = buildSyntheticEngineOperationalSnapshot(baseSnapshotInput());
  const withExtra = { ...snapshot, run: { runId: "run-1" } };
  const validation = validateSyntheticEngineOperationalSnapshot(withExtra);
  assert.equal(validation.ok, false);
});

test("validação rejeita campo desconhecido dentro de lastBatch", () => {
  const snapshot = buildSyntheticEngineOperationalSnapshot(
    baseSnapshotInput({
      lastBatch: {
        stopReason: "LIMIT_REACHED",
        requested: 1,
        dispatched: 1,
        completed: 1,
        conflicted: 0,
        noWork: 0,
        interrupted: 0,
        startedAt: TS,
        finishedAt: TS,
      },
    }),
  );
  const corrupted = { ...snapshot, lastBatch: { ...snapshot.lastBatch, sessionHandle: "sh_x" } };
  const validation = validateSyntheticEngineOperationalSnapshot(corrupted);
  assert.equal(validation.ok, false);
});

test("validação rejeita entrada que não é objeto", () => {
  assert.equal(validateSyntheticEngineOperationalSnapshot(null).ok, false);
  assert.equal(validateSyntheticEngineOperationalSnapshot("snapshot").ok, false);
  assert.equal(validateSyntheticEngineOperationalSnapshot([]).ok, false);
});
