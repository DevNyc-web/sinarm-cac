/**
 * Adaptador em memória do store (`inMemorySyntheticRunStore.ts`) — criação,
 * leitura, versão otimista e idempotência de CRIAÇÃO. Claim/reserva está em
 * `syntheticRunClaim.test.ts`; recuperação em `syntheticRunRecovery.test.ts`;
 * o serviço de execução em `syntheticStoredRunExecutor.test.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createSyntheticRun, executeNextSyntheticStep, type SyntheticAutomationRun } from "../../../src/server/automation/synthetic/syntheticRunCoordinator";
import type { SyntheticSessionContract } from "../../../src/server/automation/synthetic/sessionContract";
import { InMemorySyntheticRunStore } from "../../../src/server/automation/synthetic/store/inMemorySyntheticRunStore";

const SOURCE_PATH = "src/server/automation/synthetic/store/inMemorySyntheticRunStore.ts";
const STORE_SOURCE_PATH = "src/server/automation/synthetic/store/syntheticRunStore.ts";

function sourceCode(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_store_lab_0001",
    processId: "proc-store-lab-0001",
    actorId: "actor-store-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-09T23:59:59.000Z",
    issuedAt: "2026-08-09T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-store-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-store-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-STORE-0001",
    ...overrides,
  };
}

function makeRun(overrides: Partial<SyntheticSessionContract> = {}, runId = "run-store-0001"): SyntheticAutomationRun {
  const result = createSyntheticRun({
    runId,
    session: session(overrides),
    plan: {
      planId: "plan-store-0001",
      version: "1.0.0",
      allowedSyntheticData: [],
      steps: [
        { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" },
        { stepId: "step-2", type: "OPEN_FORM", description: "abrir formulário fictício", expectedResult: "ok" },
      ],
    },
  });
  assert.equal(result.ok, true, "fixture de teste deveria criar o run");
  if (!result.ok) throw new Error("unreachable");
  return result.run;
}

const T0 = "2026-08-09T11:00:00.000Z";
const T1 = "2026-08-09T11:01:00.000Z";

// -------------------------------------------------------------- 1/2. criar/ler

test("cria o registro e devolve version=1", async () => {
  const store = new InMemorySyntheticRunStore();
  const result = await store.create({ run: makeRun(), idempotencyKey: "idem-0001", at: T0 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.created, true);
  assert.equal(result.run.version, 1);
  assert.equal(result.run.runId, "run-store-0001");
  assert.equal(result.run.runState, "QUEUED");
});

test("getById recupera o registro criado", async () => {
  const store = new InMemorySyntheticRunStore();
  await store.create({ run: makeRun(), idempotencyKey: "idem-0002", at: T0 });

  const found = await store.getById("run-store-0001");
  assert.notEqual(found, null);
  assert.equal(found?.runId, "run-store-0001");
});

test("getById devolve null para runId inexistente", async () => {
  const store = new InMemorySyntheticRunStore();
  assert.equal(await store.getById("nao-existe"), null);
});

// -------------------------------------------------------------- 3. cópia defensiva

test("getById nunca devolve a referência viva do store", async () => {
  const store = new InMemorySyntheticRunStore();
  const created = await store.create({ run: makeRun(), idempotencyKey: "idem-0003", at: T0 });
  assert.equal(created.ok, true);

  const first = await store.getById("run-store-0001");
  const second = await store.getById("run-store-0001");
  assert.notEqual(first, second, "duas leituras devolvem objetos distintos");

  // Mutar o que foi lido não pode vazar para o próximo getById.
  (first as { runState: string }).runState = "COMPLETED";
  const third = await store.getById("run-store-0001");
  assert.equal(third?.runState, "QUEUED", "mutação externa não afeta o registro interno");
});

// -------------------------------------------------------------- 4/5. versão

test("versão inicial é 1 e cada save válido incrementa em 1", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun();
  const created = await store.create({ run, idempotencyKey: "idem-0004", at: T0 });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.run.version, 1);

  const saved = await store.save({ runId: run.runId, expectedVersion: 1, run, at: T1, idempotencyKey: "step-1-attempt" });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.run.version, 2);
});

// -------------------------------------------------------------- 6. conflito de versão

test("save com expectedVersion divergente devolve VERSION_CONFLICT sem sobrescrever", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun();
  await store.create({ run, idempotencyKey: "idem-0005", at: T0 });

  const result = await store.save({ runId: run.runId, expectedVersion: 99, run, at: T1 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["VERSION_CONFLICT"]);

  const stillThere = await store.getById(run.runId);
  assert.equal(stillThere?.version, 1, "versão não mudou após o conflito");
});

// -------------------------------------------------------------- 7/8. idempotência de criação

test("criar o mesmo run duas vezes com a mesma chave devolve o registro existente (created=false)", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun();

  const first = await store.create({ run, idempotencyKey: "idem-0006", at: T0 });
  const second = await store.create({ run, idempotencyKey: "idem-0006", at: T1 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.run.version, first.run.version);
  assert.equal(second.run.createdAt, first.run.createdAt, "não recria — devolve o registro original");
});

test("mesma chave de idempotência com payload incompatível devolve conflito", async () => {
  const store = new InMemorySyntheticRunStore();
  await store.create({ run: makeRun(), idempotencyKey: "idem-0007", at: T0 });

  const otherRun = makeRun({}, "run-store-0002");
  const result = await store.create({ run: otherRun, idempotencyKey: "idem-0007", at: T1 });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["IDEMPOTENCY_CONFLICT"]);
});

test("idempotencyKey vazia é recusada na criação", async () => {
  const store = new InMemorySyntheticRunStore();
  const result = await store.create({ run: makeRun(), idempotencyKey: "  ", at: T0 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["EMPTY_VALUE"]);
});

test("runId repetido com chave de idempotência diferente é recusado", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun();
  await store.create({ run, idempotencyKey: "idem-0008", at: T0 });

  const result = await store.create({ run, idempotencyKey: "idem-0009-outra", at: T1 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.violations.map((v) => v.code), ["RUN_ALREADY_EXISTS"]);
});

// -------------------------------------------------------------- 22. terminal imutável

test("run terminal não pode ser salvo com mudança, mesmo com expectedVersion certo", async () => {
  const store = new InMemorySyntheticRunStore();
  let run = makeRun({}, "run-store-terminal");
  await store.create({ run, idempotencyKey: "idem-terminal", at: T0 });

  // Executa as 2 etapas até concluir, salvando a cada etapa.
  const step1 = await store.getById(run.runId);
  assert.equal(step1?.version, 1);

  const afterStep1 = executeNextSyntheticStep({ run, at: T1 });
  assert.equal(afterStep1.ok, true);
  if (!afterStep1.ok) return;
  const saved1 = await store.save({ runId: run.runId, expectedVersion: 1, run: afterStep1.run, at: T1 });
  assert.equal(saved1.ok, true);

  const afterStep2 = executeNextSyntheticStep({ run: afterStep1.run, at: "2026-08-09T11:02:00.000Z" });
  assert.equal(afterStep2.ok, true);
  if (!afterStep2.ok) return;
  assert.equal(afterStep2.run.state, "COMPLETED");
  const saved2 = await store.save({ runId: run.runId, expectedVersion: 2, run: afterStep2.run, at: "2026-08-09T11:02:00.000Z" });
  assert.equal(saved2.ok, true);
  if (!saved2.ok) return;
  assert.equal(saved2.run.runState, "COMPLETED");

  // Nova tentativa de save, mesmo com expectedVersion certo: recusada por terminalidade.
  const thirdAttempt = await store.save({ runId: run.runId, expectedVersion: saved2.run.version, run: afterStep2.run, at: "2026-08-09T11:03:00.000Z" });
  assert.equal(thirdAttempt.ok, false);
  if (thirdAttempt.ok) return;
  assert.deepEqual(thirdAttempt.violations.map((v) => v.code), ["RUN_TERMINAL"]);
});

// ---------------------------------------------------------- 33/34. sem segredo

test("nenhum segredo nem sessionHandle entra no registro persistível", async () => {
  const store = new InMemorySyntheticRunStore();
  const run = makeRun({ sessionHandle: "sh_super_secreto_0001" });
  const created = await store.create({ run, idempotencyKey: "idem-secreto", at: T0 });

  assert.equal(created.ok, true);
  if (!created.ok) return;

  const serialized = JSON.stringify(created.run).toLowerCase();
  for (const forbidden of ["sh_super_secreto", "sessionhandle", "senha", "password", "cookie", "token", "000.000.000-00"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
});

// ------------------------------------------------------- 35-38. sem dependências reais

test("nenhum dos módulos do store referencia rede, Prisma, Redis ou filesystem", () => {
  for (const path of [SOURCE_PATH, STORE_SOURCE_PATH]) {
    const code = sourceCode(path);
    for (const forbidden of ["fetch(", "http://", "https://", "@prisma/client", "ioredis", "redis", "node:fs", "readFileSync", "writeFileSync", "phase9"]) {
      assert.equal(code.toLowerCase().includes(forbidden.toLowerCase()), false, `${path} não pode referenciar ${forbidden}`);
    }
  }
});

// ------------------------------------------------------------- 39. relógio injetado

test("o adaptador nunca usa Date.now nem timer real", () => {
  const code = sourceCode(SOURCE_PATH);
  for (const forbidden of ["Date.now(", "setTimeout(", "setInterval(", "new Date()"]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

// -------------------------------------------------------- 40. sem variável global

test("duas instâncias do store são totalmente isoladas (sem estado global compartilhado)", async () => {
  const storeA = new InMemorySyntheticRunStore();
  const storeB = new InMemorySyntheticRunStore();

  await storeA.create({ run: makeRun({}, "run-isolado-a"), idempotencyKey: "idem-a", at: T0 });

  assert.notEqual(await storeA.getById("run-isolado-a"), null);
  assert.equal(await storeB.getById("run-isolado-a"), null, "storeB não pode enxergar o run criado em storeA");
});

test("o adaptador não é exportado como singleton nem usa variável de módulo mutável", () => {
  const code = sourceCode(SOURCE_PATH);
  // Nenhuma constante de módulo do tipo `const store = new InMemorySyntheticRunStore()`.
  assert.equal(/^const \w+ = new InMemorySyntheticRunStore\(\)/m.test(code), false);
  assert.equal(code.includes("export default"), false);
});
