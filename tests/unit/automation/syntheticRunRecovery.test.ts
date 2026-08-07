/**
 * Classificação de recuperação (`syntheticRunRecovery.ts`) e `listRecoverable`
 * do store em memória.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSyntheticRun, executeNextSyntheticStep, type SyntheticAutomationRun } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { applySyntheticTransition } from "../../../src/server/automation/synthetic/sessionLifecycle";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { classifySyntheticRunRecovery } from "../../../src/server/automation/synthetic/store/syntheticRunRecovery";
import type { StoredSyntheticRun } from "../../../src/server/automation/synthetic/store/syntheticRunStore";

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_recovery_lab_0001",
    processId: "proc-recovery-lab-0001",
    actorId: "actor-recovery-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-09T10:10:00.000Z",
    issuedAt: "2026-08-09T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-recovery-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-recovery-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-RECOVERY-0001",
    ...overrides,
  };
}

function makeRun(runId: string, overrides: Partial<SyntheticSessionContract> = {}): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(overrides),
    plan: {
      planId: "plan-recovery-0001",
      version: "1.0.0",
      allowedSyntheticData: [],
      steps: [
        { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" },
        { stepId: "step-2", type: "OPEN_FORM", description: "abrir formulário fictício", expectedResult: "ok" },
      ],
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.run;
}

const T0 = "2026-08-09T10:00:00.000Z";
const TTL = 60_000;

// -------------------------------------------------------- 18. RUNNING sem claim

test("run RUNNING sem claim é RECOVERABLE", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun("run-rec-running");
  await store.create({ run, idempotencyKey: "idem-running", at: T0 });

  const inProgress = executeNextSyntheticStep({ run, at: T0 });
  assert.equal(inProgress.ok, true);
  if (!inProgress.ok) return;
  await store.save({ runId: run.runId, expectedVersion: 1, run: inProgress.run, at: T0 });

  const stored = await store.getById("run-rec-running");
  assert.equal(stored?.runState, "RUNNING");
  assert.equal(classifySyntheticRunRecovery(stored!, "2026-08-09T10:05:00.000Z"), "RECOVERABLE");
});

// ---------------------------------------------------- 17. claim expirado -> recuperável

test("claim expirado torna o run RECOVERABLE de novo", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun("run-rec-expired-claim");
  await store.create({ run, idempotencyKey: "idem-expclaim", at: T0 });

  await store.claimNext({ runId: "run-rec-expired-claim", workerId: "worker-a", at: T0, ttlMs: 1_000 });

  const beforeExpiry = await store.getById("run-rec-expired-claim");
  assert.equal(classifySyntheticRunRecovery(beforeExpiry!, T0), "CLAIM_STILL_VALID");

  const afterExpiry = await store.getById("run-rec-expired-claim");
  assert.equal(classifySyntheticRunRecovery(afterExpiry!, "2026-08-09T10:00:05.000Z"), "RECOVERABLE");

  const listed = await store.listRecoverable({ at: "2026-08-09T10:00:05.000Z" });
  assert.ok(listed.some((r) => r.runId === "run-rec-expired-claim"));
});

// -------------------------------------------------------------- 19. terminal

test("run terminal nunca é recuperável, mesmo sem claim", async () => {
  const store = new InMemorySyntheticRunStore();
  let run = makeRun("run-rec-terminal");
  await store.create({ run, idempotencyKey: "idem-rec-terminal", at: T0 });

  for (const at of [T0, "2026-08-09T10:00:01.000Z"]) {
    const result = executeNextSyntheticStep({ run, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    run = result.run;
    await store.save({ runId: run.runId, expectedVersion: (await store.getById(run.runId))!.version, run, at });
  }
  assert.equal(run.state, "COMPLETED");

  const stored = await store.getById("run-rec-terminal");
  assert.equal(classifySyntheticRunRecovery(stored!, "2026-08-09T10:05:00.000Z"), "TERMINAL");

  const listed = await store.listRecoverable({ at: "2026-08-09T10:05:00.000Z" });
  assert.equal(listed.some((r) => r.runId === "run-rec-terminal"), false);
});

// -------------------------------------------------------- 20. WAITING_HUMAN

test("WAITING_HUMAN nunca volta automaticamente para RUNNING (não recuperável)", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun("run-rec-waiting");
  await store.create({ run, idempotencyKey: "idem-rec-waiting", at: T0 });

  const inProgress = executeNextSyntheticStep({ run, at: T0 });
  assert.equal(inProgress.ok, true);
  if (!inProgress.ok) return;

  const blocked = applySyntheticTransition({ session: inProgress.run.session, to: "BLOCKED", at: "2026-08-09T10:00:01.000Z", reason: "captcha sintético" });
  assert.equal(blocked.ok, true);
  if (!blocked.ok) return;

  const waitingRun: SyntheticAutomationRun = { ...inProgress.run, session: blocked.session, state: "WAITING_HUMAN", humanFallbackRequired: true };
  await store.save({ runId: run.runId, expectedVersion: 1, run: waitingRun, at: "2026-08-09T10:00:01.000Z" });

  const stored = await store.getById("run-rec-waiting");
  assert.equal(classifySyntheticRunRecovery(stored!, "2026-08-09T10:10:00.000Z"), "WAITING_HUMAN");

  const listed = await store.listRecoverable({ at: "2026-08-09T10:10:00.000Z" });
  assert.equal(listed.some((r) => r.runId === "run-rec-waiting"), false);
});

// --------------------------------------------------------- 21. sessão expirada

test("EXPIRED nunca é recuperável, e nunca é renovado", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun("run-rec-expired");
  await store.create({ run, idempotencyKey: "idem-rec-expired", at: T0 });

  const inProgress = executeNextSyntheticStep({ run, at: T0 });
  assert.equal(inProgress.ok, true);
  if (!inProgress.ok) return;

  const expiresAt = run.session.expiresAt;
  const expired = applySyntheticTransition({ session: inProgress.run.session, to: "EXPIRED", at: expiresAt, reason: "prazo vencido" });
  assert.equal(expired.ok, true);
  if (!expired.ok) return;

  const expiredRun: SyntheticAutomationRun = { ...inProgress.run, session: expired.session, state: "EXPIRED", result: { outcome: "EXPIRED", syntheticProtocol: null, completedAt: expiresAt } };
  await store.save({ runId: run.runId, expectedVersion: 1, run: expiredRun, at: expiresAt });

  const stored = await store.getById("run-rec-expired");
  assert.equal(stored?.sessionState, "EXPIRED");
  assert.equal(stored?.runState, "EXPIRED");
  assert.equal(classifySyntheticRunRecovery(stored!, "2026-08-09T11:00:00.000Z"), "TERMINAL");
  assert.equal(stored?.runState === "EXPIRED" && stored.sessionState === "EXPIRED", true, "sessão e run terminam juntos, sem renovação");
});

// ------------------------------------------------------------- fabricação pura

test("classifySyntheticRunRecovery é pura: mesma entrada produz sempre a mesma saída", () => {
  const record = fakeRecord("QUEUED", null);
  const first = classifySyntheticRunRecovery(record, "2026-08-09T10:05:00.000Z");
  const second = classifySyntheticRunRecovery(record, "2026-08-09T10:05:00.000Z");
  assert.equal(first, second);
  assert.equal(first, "RECOVERABLE");
});

function fakeRecord(runState: StoredSyntheticRun["runState"], claim: StoredSyntheticRun["claim"]): StoredSyntheticRun {
  return {
    runId: "run-fake",
    version: 1,
    runState,
    sessionState: "IN_PROGRESS",
    plan: { planId: "plan-fake", version: "1.0.0", allowedSyntheticData: [], steps: [] },
    pendingSteps: [],
    completedSteps: [],
    events: [],
    evidence: [],
    humanFallbackRequired: false,
    result: null,
    createdAt: "2026-08-09T10:00:00.000Z",
    updatedAt: "2026-08-09T10:00:00.000Z",
    auditCorrelationId: "corr-fake",
    claim,
    attempts: 0,
    idempotencyKey: "idem-fake",
    lastStepIdempotencyKey: null,
    lastInterruptionReason: null,
  };
}
