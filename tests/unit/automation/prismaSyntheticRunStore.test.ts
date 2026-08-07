/**
 * Adaptador Prisma do store sintético (`prismaSyntheticRunStore.ts`).
 *
 * LIMITE HONESTO — LEIA ANTES DE CONFIAR NESTES TESTES (mesmo critério de
 * `documentExtractionConcurrency.test.ts`): o fake dedicado
 * (`testSyntheticRunPrisma.ts`) prova a POLÍTICA do adaptador e a FORMA das
 * consultas — `where` com versão/estado no `updateMany`, captura de `P2002`
 * para idempotência e corrida de claim, `select` fechado. NÃO prova o
 * comportamento real do Postgres: isolamento de transação, deadlock e a
 * atomicidade de duas CONEXÕES concorrentes de verdade continuam sem
 * cobertura em CI, que roda sem banco (`.github/workflows/ci.yml`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, beforeEach } from "node:test";
import { installFakeSyntheticRunPrisma } from "./testSyntheticRunPrisma";
import { PrismaSyntheticRunStore, InvalidStoredSyntheticRunError } from "../../../src/server/automation/synthetic/store/prismaSyntheticRunStore";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { createSyntheticRun, executeNextSyntheticStep, type SyntheticAutomationRun, type SyntheticRunStep } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import { applySyntheticTransition } from "../../../src/server/automation/synthetic/sessionLifecycle";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import type { SyntheticRunStore } from "../../../src/server/automation/synthetic/store/syntheticRunStore";

const SOURCE_PATH = "src/server/automation/synthetic/store/prismaSyntheticRunStore.ts";
const SCHEMA_PATH = "prisma/schema.prisma";
const MIGRATION_PATH = "prisma/migrations/20260810000000_add_synthetic_run_store/migration.sql";

function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_prisma_lab_0001",
    processId: "proc-prisma-lab-0001",
    actorId: "actor-prisma-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-10T23:59:59.000Z",
    issuedAt: "2026-08-10T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-prisma-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-prisma-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-PRISMA-0001",
    ...overrides,
  };
}

const TWO_STEPS: readonly SyntheticRunStep[] = [
  { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" },
  { stepId: "step-2", type: "OPEN_FORM", description: "abrir formulário fictício", expectedResult: "ok" },
];

function makeRun(runId: string, sessionOverrides: Partial<SyntheticSessionContract> = {}, steps: readonly SyntheticRunStep[] = TWO_STEPS): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(sessionOverrides),
    plan: { planId: "plan-prisma-0001", version: "1.0.0", allowedSyntheticData: [], steps },
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.run;
}

const T0 = "2026-08-10T11:00:00.000Z";
const T1 = "2026-08-10T11:01:00.000Z";
const TTL = 60_000;

let store: PrismaSyntheticRunStore;

beforeEach(() => {
  installFakeSyntheticRunPrisma();
  store = new PrismaSyntheticRunStore();
});

// -------------------------------------------------------------- 1. criar/ler

test("cria o registro e devolve version=1; getById recupera", async () => {
  const run = makeRun("run-prisma-0001");
  const created = await store.create({ run, idempotencyKey: "idem-0001", at: T0 });

  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.created, true);
  assert.equal(created.run.version, 1);
  assert.equal(created.run.runState, "QUEUED");

  const found = await store.getById("run-prisma-0001");
  assert.equal(found?.runId, "run-prisma-0001");
});

// --------------------------------------------------------- 2/3. idempotência

test("criação idempotente: mesma chave e mesmo payload devolve o registro existente", async () => {
  const run = makeRun("run-prisma-0002");
  const first = await store.create({ run, idempotencyKey: "idem-0002", at: T0 });
  const second = await store.create({ run, idempotencyKey: "idem-0002", at: T1 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.run.createdAt, first.run.createdAt);
});

test("conflito de idempotência: mesma chave, payload incompatível", async () => {
  await store.create({ run: makeRun("run-prisma-0003"), idempotencyKey: "idem-0003", at: T0 });
  const result = await store.create({ run: makeRun("run-prisma-0004"), idempotencyKey: "idem-0003", at: T1 });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["IDEMPOTENCY_CONFLICT"]);
});

// -------------------------------------------------------- 4/5/6. versão

test("versão inicial 1, incremento atômico a cada save", async () => {
  const run = makeRun("run-prisma-0005");
  await store.create({ run, idempotencyKey: "idem-0005", at: T0 });

  const step1 = executeNextSyntheticStep({ run, at: T1 });
  assert.equal(step1.ok, true);
  if (!step1.ok) return;

  const saved = await store.save({ runId: run.runId, expectedVersion: 1, run: step1.run, at: T1 });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.run.version, 2);
  assert.equal(saved.run.attempts, 1);
});

test("conflito de versão: expectedVersion divergente não atualiza nada", async () => {
  const run = makeRun("run-prisma-0006");
  await store.create({ run, idempotencyKey: "idem-0006", at: T0 });

  const result = await store.save({ runId: run.runId, expectedVersion: 99, run, at: T1 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["VERSION_CONFLICT"]);

  const stillThere = await store.getById(run.runId);
  assert.equal(stillThere?.version, 1);
});

// ------------------------------------------------------------- 7. claim único

test("claimNext reserva o run com sucesso", async () => {
  const run = makeRun("run-prisma-0007");
  await store.create({ run, idempotencyKey: "idem-0007", at: T0 });

  const claimed = await store.claimNext({ runId: run.runId, workerId: "worker-a", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;
  assert.equal(claimed.claim.workerId, "worker-a");

  const second = await store.claimNext({ runId: run.runId, workerId: "worker-b", at: T1, ttlMs: TTL });
  assert.equal(second.ok, false);
});

// ------------------------------------------------------ 8. corrida entre workers

test("corrida entre dois workers: apenas um vence, o outro recebe CLAIM_ALREADY_ACTIVE", async () => {
  const run = makeRun("run-prisma-0008");
  await store.create({ run, idempotencyKey: "idem-0008", at: T0 });

  const [resultA, resultB] = await Promise.all([
    store.claimNext({ runId: run.runId, workerId: "worker-a", at: T0, ttlMs: TTL }),
    store.claimNext({ runId: run.runId, workerId: "worker-b", at: T0, ttlMs: TTL }),
  ]);

  const outcomes = [resultA.ok, resultB.ok];
  assert.deepEqual(outcomes.sort(), [false, true], "exatamente um dos dois vence");

  const loser = resultA.ok ? resultB : resultA;
  assert.equal(loser.ok, false);
  if (loser.ok) return;
  assert.deepEqual(loser.violations.map((v) => v.code), ["CLAIM_ALREADY_ACTIVE"]);
});

// -------------------------------------------------------------- 9. expirado

test("claim expirado pode ser substituído por um novo claimNext", async () => {
  const run = makeRun("run-prisma-0009");
  await store.create({ run, idempotencyKey: "idem-0009", at: T0 });
  await store.claimNext({ runId: run.runId, workerId: "worker-a", at: T0, ttlMs: 1_000 });

  const afterExpiry = await store.claimNext({ runId: run.runId, workerId: "worker-b", at: "2026-08-10T11:00:02.000Z", ttlMs: TTL });
  assert.equal(afterExpiry.ok, true);
  if (!afterExpiry.ok) return;
  assert.equal(afterExpiry.claim.workerId, "worker-b");
});

// --------------------------------------------------------- 10/11. renovação

test("renovação pelo dono estende expiresAt", async () => {
  const run = makeRun("run-prisma-0010");
  await store.create({ run, idempotencyKey: "idem-0010", at: T0 });
  const claimed = await store.claimNext({ runId: run.runId, workerId: "worker-a", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  // Bem antes do vencimento (T0 + TTL): T1 == T0 + TTL cairia exatamente na
  // borda "expirado" (mesma convenção de `classifySyntheticRunRecovery`).
  const renewAt = "2026-08-10T11:00:30.000Z";
  const renewed = await store.renewClaim({ runId: run.runId, claimId: claimed.claim.claimId, workerId: "worker-a", at: renewAt, ttlMs: TTL });
  assert.equal(renewed.ok, true);
  if (!renewed.ok) return;
  assert.equal(renewed.claim.expiresAt, new Date(Date.parse(renewAt) + TTL).toISOString());
});

test("owner incorreto é recusado em renovação/liberação/conclusão", async () => {
  const run = makeRun("run-prisma-0011");
  await store.create({ run, idempotencyKey: "idem-0011", at: T0 });
  const claimed = await store.claimNext({ runId: run.runId, workerId: "worker-dono", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const renew = await store.renewClaim({ runId: run.runId, claimId: claimed.claim.claimId, workerId: "worker-intruso", at: T1, ttlMs: TTL });
  assert.equal(renew.ok, false);
  if (!renew.ok) assert.deepEqual(renew.violations.map((v) => v.code), ["CLAIM_OWNER_MISMATCH"]);

  const release = await store.releaseClaim({ runId: run.runId, claimId: claimed.claim.claimId, workerId: "worker-intruso" });
  assert.equal(release.ok, false);

  const complete = await store.completeClaim({ runId: run.runId, claimId: claimed.claim.claimId, workerId: "worker-intruso" });
  assert.equal(complete.ok, false);
});

// --------------------------------------------------------- 12/13. liberação/conclusão

test("liberação limpa a reserva e permite novo claim", async () => {
  const run = makeRun("run-prisma-0012");
  await store.create({ run, idempotencyKey: "idem-0012", at: T0 });
  const claimed = await store.claimNext({ runId: run.runId, workerId: "worker-a", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const released = await store.releaseClaim({ runId: run.runId, claimId: claimed.claim.claimId, workerId: "worker-a" });
  assert.equal(released.ok, true);

  const stored = await store.getById(run.runId);
  assert.equal(stored?.claim, null);

  const reClaimed = await store.claimNext({ runId: run.runId, workerId: "worker-b", at: T1, ttlMs: TTL });
  assert.equal(reClaimed.ok, true);
});

test("conclusão limpa a reserva", async () => {
  const run = makeRun("run-prisma-0013");
  await store.create({ run, idempotencyKey: "idem-0013", at: T0 });
  const claimed = await store.claimNext({ runId: run.runId, workerId: "worker-a", at: T0, ttlMs: TTL });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;

  const completed = await store.completeClaim({ runId: run.runId, claimId: claimed.claim.claimId, workerId: "worker-a" });
  assert.equal(completed.ok, true);

  const stored = await store.getById(run.runId);
  assert.equal(stored?.claim, null);
});

// --------------------------------------------------- 14/15. estados não-reserváveis

test("run terminal não é reservável", async () => {
  const run = makeRun("run-prisma-0014", {}, [TWO_STEPS[0]!]);
  await store.create({ run, idempotencyKey: "idem-0014", at: T0 });

  const step1 = executeNextSyntheticStep({ run, at: T0 });
  assert.equal(step1.ok, true);
  if (!step1.ok) return;
  await store.save({ runId: run.runId, expectedVersion: 1, run: step1.run, at: T0 });

  const stored = await store.getById(run.runId);
  assert.equal(stored?.runState, "COMPLETED");

  const claimResult = await store.claimNext({ runId: run.runId, workerId: "worker-a", at: T1, ttlMs: TTL });
  assert.equal(claimResult.ok, false);
  if (claimResult.ok) return;
  assert.deepEqual(claimResult.violations.map((v) => v.code), ["RUN_TERMINAL"]);
});

test("WAITING_HUMAN não é reservável para execução automática", async () => {
  const run = makeRun("run-prisma-0015");
  await store.create({ run, idempotencyKey: "idem-0015", at: T0 });

  const step1 = executeNextSyntheticStep({ run, at: T0 });
  assert.equal(step1.ok, true);
  if (!step1.ok) return;

  // Constrói um run WAITING_HUMAN manualmente para o teste do claim (o
  // lifecycle em si é testado à parte, em `syntheticSessionLifecycle.test.ts`).
  const blocked = applySyntheticTransition({ session: step1.run.session, to: "BLOCKED", at: T1, reason: "captcha sintético" });
  assert.equal(blocked.ok, true);
  if (!blocked.ok) return;
  const waitingRun: SyntheticAutomationRun = { ...step1.run, session: blocked.session, state: "WAITING_HUMAN", humanFallbackRequired: true };
  await store.save({ runId: run.runId, expectedVersion: 1, run: waitingRun, at: T1 });

  const claimResult = await store.claimNext({ runId: run.runId, workerId: "worker-a", at: "2026-08-10T11:00:02.000Z", ttlMs: TTL });
  assert.equal(claimResult.ok, false);
  if (claimResult.ok) return;
  assert.deepEqual(claimResult.violations.map((v) => v.code), ["RUN_WAITING_HUMAN"]);
});

// ------------------------------------------------------------- 16. recuperação

test("listRecoverable devolve runs RUNNING sem claim válido, e nunca terminal/WAITING_HUMAN", async () => {
  const recoverable = makeRun("run-prisma-0016-recuperavel");
  const terminal = makeRun("run-prisma-0016-terminal", {}, [TWO_STEPS[0]!]);

  await store.create({ run: recoverable, idempotencyKey: "idem-0016-a", at: T0 });
  await store.create({ run: terminal, idempotencyKey: "idem-0016-b", at: T0 });

  const step1Recoverable = executeNextSyntheticStep({ run: recoverable, at: T0 });
  assert.equal(step1Recoverable.ok, true);
  if (!step1Recoverable.ok) return;
  await store.save({ runId: recoverable.runId, expectedVersion: 1, run: step1Recoverable.run, at: T0 });

  const step1Terminal = executeNextSyntheticStep({ run: terminal, at: T0 });
  assert.equal(step1Terminal.ok, true);
  if (!step1Terminal.ok) return;
  await store.save({ runId: terminal.runId, expectedVersion: 1, run: step1Terminal.run, at: T0 });

  const listed = await store.listRecoverable({ at: T1 });
  const listedIds = listed.map((r) => r.runId);
  assert.ok(listedIds.includes("run-prisma-0016-recuperavel"));
  assert.equal(listedIds.includes("run-prisma-0016-terminal"), false);
});

// -------------------------------------------------------- 17. eventos/evidências

test("eventos e evidências são preservados através de save/getById", async () => {
  const run = makeRun("run-prisma-0017");
  await store.create({ run, idempotencyKey: "idem-0017", at: T0 });

  const step1 = executeNextSyntheticStep({ run, at: T0 });
  assert.equal(step1.ok, true);
  if (!step1.ok) return;
  await store.save({ runId: run.runId, expectedVersion: 1, run: step1.run, at: T0 });

  const stored = await store.getById(run.runId);
  assert.equal(stored?.events.length, 2); // step_started (transição) + step_completed
  assert.equal(stored?.evidence.length, 1);
  assert.equal(stored?.evidence[0]?.stepId, "step-1");
});

// ------------------------------------------------------------- 18. protocolo

test("protocolo não duplica ao repetir o save da última etapa com a mesma idempotencyKey", async () => {
  const run = makeRun("run-prisma-0018", {}, [TWO_STEPS[0]!]);
  await store.create({ run, idempotencyKey: "idem-0018", at: T0 });

  const step1 = executeNextSyntheticStep({ run, at: T0 });
  assert.equal(step1.ok, true);
  if (!step1.ok) return;

  const first = await store.save({ runId: run.runId, expectedVersion: 1, run: step1.run, at: T0, idempotencyKey: "attempt-1" });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const protocol1 = first.run.result?.syntheticProtocol;
  assert.ok(protocol1?.startsWith("PROT-FICT-"));

  const second = await store.save({ runId: run.runId, expectedVersion: 1, run: step1.run, at: T1, idempotencyKey: "attempt-1" });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.run.result?.syntheticProtocol, protocol1);
  assert.equal(second.run.version, first.run.version, "replay não incrementa a versão de novo");
});

// -------------------------------------------------------- 19. JSON inválido

test("JSON corrompido/inválido lido do banco é rejeitado, não confiado cegamente", async () => {
  const run = makeRun("run-prisma-0019");
  await store.create({ run, idempotencyKey: "idem-0019", at: T0 });

  const fake = (globalThis as unknown as { prisma: { syntheticRun: { rows: Record<string, unknown>[] } } }).prisma;
  const row = fake.syntheticRun.rows.find((r) => r.runId === "run-prisma-0019")!;
  row.runState = "ESTADO_QUE_NAO_EXISTE"; // corrompe deliberadamente

  await assert.rejects(() => store.getById("run-prisma-0019"), InvalidStoredSyntheticRunError);
});

// ------------------------------------------------------ 20/21. sem segredo

test("sessionHandle e credenciais nunca são persistidos", async () => {
  const run = makeRun("run-prisma-0020", { sessionHandle: "sh_prisma_secreto_0020" });
  const created = await store.create({ run, idempotencyKey: "idem-0020", at: T0 });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const serialized = JSON.stringify(created.run).toLowerCase();
  for (const forbidden of ["sh_prisma_secreto", "sessionhandle", "senha", "password", "cookie", "token", "000.000.000-00"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }

  const fake = (globalThis as unknown as { prisma: { syntheticRun: { rows: Record<string, unknown>[] } } }).prisma;
  const rawRow = JSON.stringify(fake.syntheticRun.rows.find((r) => r.runId === "run-prisma-0020")).toLowerCase();
  assert.equal(rawRow.includes("sh_prisma_secreto"), false, "a LINHA BRUTA do banco também não pode carregar o handle");
});

// -------------------------------------------------- 22. paridade com o store em memória

test("paridade comportamental: a mesma sequência de operações produz o mesmo resultado nos dois adaptadores", async () => {
  const stores: Record<string, SyntheticRunStore> = {
    memoria: new InMemorySyntheticRunStore(),
    prisma: store,
  };

  const outcomes: Record<string, unknown> = {};
  for (const [name, s] of Object.entries(stores)) {
    const run = makeRun(`run-paridade-${name}`);
    const created = await s.create({ run, idempotencyKey: `idem-paridade-${name}`, at: T0 });
    assert.equal(created.ok, true);
    if (!created.ok) continue;

    const step1 = executeNextSyntheticStep({ run, at: T0 });
    assert.equal(step1.ok, true);
    if (!step1.ok) continue;
    const saved = await s.save({ runId: run.runId, expectedVersion: 1, run: step1.run, at: T0 });
    assert.equal(saved.ok, true);
    if (!saved.ok) continue;

    const conflict = await s.save({ runId: run.runId, expectedVersion: 99, run: step1.run, at: T1 });

    outcomes[name] = {
      afterStep1State: saved.run.runState,
      afterStep1Version: saved.run.version,
      conflictOk: conflict.ok,
      conflictCode: conflict.ok ? null : conflict.violations.map((v) => v.code),
    };
  }

  assert.deepEqual(outcomes.memoria, outcomes.prisma);
});

// --------------------------------------------------------------- estrutural

test("o adaptador não roda Playwright nem toca a Fase 9", () => {
  const code = sourceCode();
  for (const forbidden of ["@playwright/test", "chromium", "phase9", "PHASE9_REAL_EXECUTION_ENABLED"]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

test("a tabela não tem coluna de sessionHandle, senha, token, cookie ou OTP", () => {
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  const inicio = schema.indexOf("model SyntheticRun {");
  const fim = schema.indexOf("model SyntheticRunClaim", inicio);
  const bloco = schema
    .slice(inicio, fim)
    .split("\n")
    .filter((linha) => !/^\s*\/\//.test(linha))
    .join("\n");
  assert.doesNotMatch(bloco, /session_?handle|password|senha|\btoken\b|\bcookie\b|\botp\b/i);
});

test("a migration é aditiva — não altera tabela existente", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  assert.match(sql, /CREATE TABLE "synthetic_runs"/);
  assert.match(sql, /CREATE TABLE "synthetic_run_claims"/);
  assert.doesNotMatch(sql, /ALTER TABLE "process/i, "não toca tabelas de processo/produção");
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/i, "nenhum comando destrutivo manual");
});
