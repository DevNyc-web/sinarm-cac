/**
 * Claim/reserva do store em memória — `claimNext`, `renewClaim`,
 * `releaseClaim`, `completeClaim`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSyntheticRun, executeNextSyntheticStep, type SyntheticAutomationRun } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { applySyntheticTransition } from "../../../src/server/automation/synthetic/sessionLifecycle";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_claim_lab_0001",
    processId: "proc-claim-lab-0001",
    actorId: "actor-claim-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-09T23:59:59.000Z",
    issuedAt: "2026-08-09T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-claim-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-claim-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-CLAIM-0001",
    ...overrides,
  };
}

function makeRun(runId: string, overrides: Partial<SyntheticSessionContract> = {}): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(overrides),
    plan: {
      planId: "plan-claim-0001",
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

async function seededStore(runId = "run-claim-0001"): Promise<InMemorySyntheticRunStore> {
  const store = new InMemorySyntheticRunStore();
  await store.create({ run: makeRun(runId), idempotencyKey: `idem-${runId}`, at: "2026-08-09T11:00:00.000Z" });
  return store;
}

const T0 = "2026-08-09T11:00:00.000Z";
const TTL = 60_000;

// -------------------------------------------------------------- 9. claim único

test("claimNext reserva o run e devolve um claim com expiresAt = at + ttlMs", async () => {
  const store = await seededStore();
  const result = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-0001", at: T0, ttlMs: TTL });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.claim.runId, "run-claim-0001");
  assert.equal(result.claim.workerId, "worker-0001");
  assert.equal(result.claim.expiresAt, new Date(Date.parse(T0) + TTL).toISOString());
});

// --------------------------------------------------------- 10. worker correto

test("claim registrado pertence ao worker que reservou", async () => {
  const store = await seededStore();
  const result = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-dono", at: T0, ttlMs: TTL });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const stored = await store.getById("run-claim-0001");
  assert.equal(stored?.claim?.workerId, "worker-dono");
});

// ---------------------------------------------------------- 11. segundo claim

test("segundo claimNext enquanto o primeiro está válido é recusado (CLAIM_ALREADY_ACTIVE)", async () => {
  const store = await seededStore();
  await store.claimNext({ runId: "run-claim-0001", workerId: "worker-a", at: T0, ttlMs: TTL });

  const second = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-b", at: "2026-08-09T11:00:10.000Z", ttlMs: TTL });
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.deepEqual(second.violations.map((v) => v.code), ["CLAIM_ALREADY_ACTIVE"]);
});

// ------------------------------------------------------------ 12. renovação

test("renewClaim pelo dono estende expiresAt", async () => {
  const store = await seededStore();
  const claimed = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-dono", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const renewAt = "2026-08-09T11:00:30.000Z";
  const renewed = await store.renewClaim({ runId: "run-claim-0001", claimId: claimed.claim.claimId, workerId: "worker-dono", at: renewAt, ttlMs: TTL });

  assert.equal(renewed.ok, true);
  if (!renewed.ok) return;
  assert.equal(renewed.claim.expiresAt, new Date(Date.parse(renewAt) + TTL).toISOString());
});

// ------------------------------------------------------ 13. renovação errada

test("renewClaim por worker errado é recusado (CLAIM_OWNER_MISMATCH)", async () => {
  const store = await seededStore();
  const claimed = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-dono", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const result = await store.renewClaim({ runId: "run-claim-0001", claimId: claimed.claim.claimId, workerId: "worker-intruso", at: "2026-08-09T11:00:10.000Z", ttlMs: TTL });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["CLAIM_OWNER_MISMATCH"]);
});

// ------------------------------------------------------------ 14. liberação

test("releaseClaim pelo dono libera o run para um novo claim", async () => {
  const store = await seededStore();
  const claimed = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-dono", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const released = await store.releaseClaim({ runId: "run-claim-0001", claimId: claimed.claim.claimId, workerId: "worker-dono" });
  assert.equal(released.ok, true);

  const stored = await store.getById("run-claim-0001");
  assert.equal(stored?.claim, null);

  const reClaimed = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-novo", at: "2026-08-09T11:00:05.000Z", ttlMs: TTL });
  assert.equal(reClaimed.ok, true);
});

test("release por worker errado é recusado", async () => {
  const store = await seededStore();
  const claimed = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-dono", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const result = await store.releaseClaim({ runId: "run-claim-0001", claimId: claimed.claim.claimId, workerId: "worker-intruso" });
  assert.equal(result.ok, false);
});

// ------------------------------------------------------------ 15. conclusão

test("completeClaim pelo dono limpa a reserva", async () => {
  const store = await seededStore();
  const claimed = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-dono", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const completed = await store.completeClaim({ runId: "run-claim-0001", claimId: claimed.claim.claimId, workerId: "worker-dono" });
  assert.equal(completed.ok, true);

  const stored = await store.getById("run-claim-0001");
  assert.equal(stored?.claim, null);
});

// -------------------------------------------------------- 16. expiração de claim

test("claim expirado permite um NOVO claimNext (não é CLAIM_ALREADY_ACTIVE)", async () => {
  const store = await seededStore();
  await store.claimNext({ runId: "run-claim-0001", workerId: "worker-a", at: T0, ttlMs: 1_000 });

  // 2s depois: o claim de 1s já expirou.
  const afterExpiry = "2026-08-09T11:00:02.000Z";
  const result = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-b", at: afterExpiry, ttlMs: TTL });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.claim.workerId, "worker-b");
});

test("renovar um claim já expirado é recusado (CLAIM_EXPIRED)", async () => {
  const store = await seededStore();
  const claimed = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-a", at: T0, ttlMs: 1_000 });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const result = await store.renewClaim({
    runId: "run-claim-0001",
    claimId: claimed.claim.claimId,
    workerId: "worker-a",
    at: "2026-08-09T11:00:02.000Z",
    ttlMs: TTL,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["CLAIM_EXPIRED"]);
});

// -------------------------------------------------- regras adicionais do claim

test("run terminal não pode ser reservado", async () => {
  const store = new InMemorySyntheticRunStore();
  let run = makeRun("run-claim-terminal");
  await store.create({ run, idempotencyKey: "idem-terminal", at: T0 });

  for (const at of [T0, "2026-08-09T11:00:01.000Z"]) {
    const result = executeNextSyntheticStep({ run, at });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    run = result.run;
    await store.save({ runId: run.runId, expectedVersion: (await store.getById(run.runId))!.version, run, at });
  }
  assert.equal(run.state, "COMPLETED");

  const claimResult = await store.claimNext({ runId: "run-claim-terminal", workerId: "worker-x", at: "2026-08-09T11:00:02.000Z", ttlMs: TTL });
  assert.equal(claimResult.ok, false);
  if (claimResult.ok) return;
  assert.deepEqual(claimResult.violations.map((v) => v.code), ["RUN_TERMINAL"]);
});

test("run WAITING_HUMAN não pode ser reservado para execução automática", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun("run-claim-waiting");
  await store.create({ run, idempotencyKey: "idem-waiting", at: T0 });

  // Leva a sessão a IN_PROGRESS e depois BLOCKED, refletindo isso no run "à mão"
  // (só para preparar o cenário de teste do claim; o coordenador é testado à parte).
  const inProgress = executeNextSyntheticStep({ run, at: T0 });
  assert.equal(inProgress.ok, true);
  if (!inProgress.ok) return;

  const blocked = applySyntheticTransition({ session: inProgress.run.session, to: "BLOCKED", at: "2026-08-09T11:00:01.000Z", reason: "captcha sintético" });
  assert.equal(blocked.ok, true);
  if (!blocked.ok) return;

  const waitingRun: SyntheticAutomationRun = { ...inProgress.run, session: blocked.session, state: "WAITING_HUMAN", humanFallbackRequired: true };
  await store.save({ runId: run.runId, expectedVersion: 1, run: waitingRun, at: "2026-08-09T11:00:01.000Z" });

  const claimResult = await store.claimNext({ runId: "run-claim-waiting", workerId: "worker-x", at: "2026-08-09T11:00:02.000Z", ttlMs: TTL });
  assert.equal(claimResult.ok, false);
  if (claimResult.ok) return;
  assert.deepEqual(claimResult.violations.map((v) => v.code), ["RUN_WAITING_HUMAN"]);
});

test("claim nunca carrega segredo (só workerId fictício e timestamps)", async () => {
  const store = await seededStore();
  const claimed = await store.claimNext({ runId: "run-claim-0001", workerId: "worker-fictício-0001", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const serialized = JSON.stringify(claimed.claim).toLowerCase();
  for (const forbidden of ["sh_claim_lab", "senha", "password", "token", "cookie"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
});
