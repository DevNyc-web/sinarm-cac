/**
 * Contrato `ManualDispatchRequestRegistry` — testado UMA VEZ por
 * comportamento, contra as DUAS implementações (memória e Prisma/fake), para
 * provar paridade por construção em vez de duplicar a suíte inteira.
 *
 * Fingerprint (`computeManualDispatchRequestFingerprint`) e a validação do
 * resultado persistível (`validateManualSyntheticDispatchResult`) são
 * testados à parte, puros, sem I/O.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  computeManualDispatchRequestFingerprint,
  type ManualDispatchRequestRegistry,
} from "../../../src/server/automation/synthetic/admin/manualDispatchRequestRegistry";
import { InMemoryManualDispatchRequestRegistry } from "../../../src/server/automation/synthetic/admin/inMemoryManualDispatchRequestRegistry";
import { PrismaManualDispatchRequestRegistry } from "../../../src/server/automation/synthetic/admin/prismaManualDispatchRequestRegistry";
import { installFakeManualDispatchPrisma } from "./testManualDispatchPrisma";
import { validateManualSyntheticDispatchResult, MANUAL_DISPATCH_RESULT_FORMAT_VERSION } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchTypes";
import type { ManualSyntheticDispatchResult } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchTypes";
import type { ManualSyntheticDispatchPolicyConfig } from "../../../src/server/automation/synthetic/admin/manualSyntheticDispatchPolicy";

const AT = "2026-08-15T10:00:00.000Z";
const LATER = "2026-08-15T10:01:00.000Z";
const TTL = 60_000;

function policyConfig(): ManualSyntheticDispatchPolicyConfig {
  return { allowedRoles: ["ADMIN", "OPERATOR"], allowDegradedHealth: false, maxRecentRequests: 20 };
}

function fingerprintInput(overrides: Partial<Parameters<typeof computeManualDispatchRequestFingerprint>[0]> = {}) {
  return {
    requestId: "req-1",
    batchId: "batch-1",
    role: "ADMIN" as const,
    environment: "SYNTHETIC_LAB" as const,
    explicitConfirmation: true,
    requestedBy: "admin-teste",
    reason: "motivo",
    requestedAt: AT,
    maxRuns: 2,
    maxConcurrency: 1,
    deadlineAt: "2026-08-15T10:05:00.000Z",
    policyConfig: policyConfig(),
    ...overrides,
  };
}

function fakeResult(overrides: Partial<ManualSyntheticDispatchResult> = {}): ManualSyntheticDispatchResult {
  return {
    formatVersion: MANUAL_DISPATCH_RESULT_FORMAT_VERSION,
    requestId: "req-1",
    batchId: "batch-1",
    requestedAt: AT,
    completedAt: LATER,
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

function registries(): Record<"memoria" | "prisma", () => ManualDispatchRequestRegistry> {
  return {
    memoria: () => new InMemoryManualDispatchRequestRegistry(),
    prisma: () => {
      installFakeManualDispatchPrisma();
      return new PrismaManualDispatchRequestRegistry();
    },
  };
}

// -------------------------------------------------------- fingerprint puro

test("fingerprint é determinístico: mesma entrada produz a mesma string", () => {
  assert.equal(computeManualDispatchRequestFingerprint(fingerprintInput()), computeManualDispatchRequestFingerprint(fingerprintInput()));
});

test("fingerprint muda quando qualquer campo relevante muda", () => {
  const base = computeManualDispatchRequestFingerprint(fingerprintInput());
  assert.notEqual(computeManualDispatchRequestFingerprint(fingerprintInput({ maxRuns: 3 })), base);
  assert.notEqual(computeManualDispatchRequestFingerprint(fingerprintInput({ role: "OPERATOR" })), base);
  assert.notEqual(computeManualDispatchRequestFingerprint(fingerprintInput({ reason: "outro motivo" })), base);
  assert.notEqual(computeManualDispatchRequestFingerprint(fingerprintInput({ deadlineAt: "2026-08-15T10:06:00.000Z" })), base);
  assert.notEqual(computeManualDispatchRequestFingerprint(fingerprintInput({ policyConfig: { ...policyConfig(), maxRecentRequests: 5 } })), base);
});

test("fingerprint nunca depende de dependência de runtime — a entrada não tem campo pra isso", () => {
  const input = fingerprintInput();
  assert.equal("store" in input, false);
  assert.equal("executor" in input, false);
  assert.equal("logger" in input, false);
  assert.equal("signal" in input, false);
});

// ---------------------------------------------------- validação do resultado

test("validateManualSyntheticDispatchResult aceita um resultado bem formado", () => {
  assert.equal(validateManualSyntheticDispatchResult(fakeResult()).ok, true);
});

test("validateManualSyntheticDispatchResult rejeita JSON com campo desconhecido, decisão/outcome fora da união fechada", () => {
  assert.equal(validateManualSyntheticDispatchResult({ ...fakeResult(), sessionHandle: "sh_x" }).ok, false);
  assert.equal(validateManualSyntheticDispatchResult({ ...fakeResult(), decision: "SOMETHING_ELSE" }).ok, false);
  assert.equal(validateManualSyntheticDispatchResult({ ...fakeResult(), outcome: "SOMETHING_ELSE" }).ok, false);
  assert.equal(validateManualSyntheticDispatchResult(null).ok, false);
  assert.equal(validateManualSyntheticDispatchResult("not an object").ok, false);
  assert.equal(validateManualSyntheticDispatchResult({ ...fakeResult(), warnings: [{ code: "NOT_A_REAL_CODE", detail: "x" }] }).ok, false);
});

// ------------------------------------------------------- comportamento (memória + prisma)

for (const [name, make] of Object.entries(registries())) {
  // -------------------------------------------------------------- 1/2. criar/ler

  test(`[${name}] reserve() cria um pedido PENDING; find() lê de volta`, async () => {
    const registry = make();
    const reserved = await registry.reserve({ requestId: "req-1", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "manual-req-1", at: AT, leaseTtlMs: TTL });
    assert.equal(reserved.outcome, "RESERVED");
    if (reserved.outcome !== "RESERVED") return;

    const found = await registry.find("req-1");
    assert.ok(found);
    assert.equal(found!.status, "PENDING");
    assert.equal(found!.fingerprint, "fp-1");
    assert.equal(found!.result, null);
    assert.equal(found!.lease?.executionToken, reserved.lease.executionToken);
  });

  test(`[${name}] find() de requestId ausente devolve null`, async () => {
    assert.equal(await make().find("nunca-existiu"), null);
  });

  // ------------------------------------------------------------ 3. fingerprint igual

  test(`[${name}] segundo reserve() com o MESMO fingerprint, depois de concluído: REPLAY`, async () => {
    const registry = make();
    const reserved = await registry.reserve({ requestId: "req-1", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "manual-req-1", at: AT, leaseTtlMs: TTL });
    if (reserved.outcome !== "RESERVED") throw new Error("unreachable");
    await registry.finish({ requestId: "req-1", executionToken: reserved.lease.executionToken, status: "COMPLETED", result: fakeResult(), at: LATER });

    const replay = await registry.reserve({ requestId: "req-1", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "manual-req-1-again", at: LATER, leaseTtlMs: TTL });
    assert.equal(replay.outcome, "REPLAY");
    if (replay.outcome !== "REPLAY") return;
    assert.equal(replay.entry.status, "COMPLETED");
    assert.equal(replay.entry.result?.outcome, "DISPATCH_COMPLETED");
  });

  // ------------------------------------------------------- 4. fingerprint incompatível

  test(`[${name}] segundo reserve() com fingerprint DIFERENTE: FINGERPRINT_CONFLICT`, async () => {
    const registry = make();
    await registry.reserve({ requestId: "req-1", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "manual-req-1", at: AT, leaseTtlMs: TTL });

    const conflict = await registry.reserve({ requestId: "req-1", batchId: "batch-2", fingerprint: "fp-2", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "outro", requestedAt: AT, claimedBy: "manual-req-1-b", at: AT, leaseTtlMs: TTL });
    assert.equal(conflict.outcome, "FINGERPRINT_CONFLICT");
  });

  // -------------------------------------------------------------- 5. requestId único

  test(`[${name}] requestId é único: duas reservas com o mesmo id nunca coexistem como PENDING independentes`, async () => {
    const registry = make();
    const first = await registry.reserve({ requestId: "req-unico", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker-a", at: AT, leaseTtlMs: TTL });
    const second = await registry.reserve({ requestId: "req-unico", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker-b", at: AT, leaseTtlMs: TTL });
    assert.equal(first.outcome, "RESERVED");
    assert.equal(second.outcome, "ALREADY_RUNNING");
  });

  // ------------------------------------------------------ 6/7/8. concorrência

  test(`[${name}] dois "processos" concorrentes: exatamente um autorizado, o outro recebe ALREADY_RUNNING`, async () => {
    const registry = make();
    const input = { requestId: "req-concorrente", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB" as const, reason: "motivo", requestedAt: AT, at: AT, leaseTtlMs: TTL };
    const [a, b] = await Promise.all([registry.reserve({ ...input, claimedBy: "worker-a" }), registry.reserve({ ...input, claimedBy: "worker-b" })]);

    const outcomes = [a.outcome, b.outcome].sort();
    assert.deepEqual(outcomes, ["ALREADY_RUNNING", "RESERVED"]);
  });

  // -------------------------------------------------------------- 15-19. status

  test(`[${name}] status PENDING logo após reserve()`, async () => {
    const registry = make();
    const reserved = await registry.reserve({ requestId: "req-status", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });
    if (reserved.outcome !== "RESERVED") throw new Error("unreachable");
    assert.equal((await registry.find("req-status"))!.status, "PENDING");
  });

  for (const status of ["COMPLETED", "DENIED", "FAILED", "CANCELLED"] as const) {
    test(`[${name}] finish() grava status ${status} e o resultado correspondente`, async () => {
      const registry = make();
      const requestId = `req-status-${status}`;
      const reserved = await registry.reserve({ requestId, batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });
      if (reserved.outcome !== "RESERVED") throw new Error("unreachable");

      const outcomeByStatus = { COMPLETED: "DISPATCH_COMPLETED", DENIED: "REQUEST_DENIED", FAILED: "DISPATCH_FAILED", CANCELLED: "DISPATCH_CANCELLED" } as const;
      const finished = await registry.finish({ requestId, executionToken: reserved.lease.executionToken, status, result: fakeResult({ requestId, outcome: outcomeByStatus[status] }), at: LATER });
      assert.equal(finished.ok, true);
      if (!finished.ok) return;
      assert.equal(finished.entry.status, status);
      assert.equal(finished.entry.result?.outcome, outcomeByStatus[status]);
    });
  }

  // ------------------------------------------------------------ 20/21. lease

  test(`[${name}] lease válida (não vencida): segunda tentativa vê ALREADY_RUNNING`, async () => {
    const registry = make();
    await registry.reserve({ requestId: "req-lease", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker-a", at: AT, leaseTtlMs: TTL });
    const second = await registry.reserve({ requestId: "req-lease", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker-b", at: new Date(Date.parse(AT) + 1_000).toISOString(), leaseTtlMs: TTL });
    assert.equal(second.outcome, "ALREADY_RUNNING");
  });

  test(`[${name}] lease vencida: segunda tentativa vê RECOVERY_REQUIRED, sem executar nada sozinha`, async () => {
    const registry = make();
    await registry.reserve({ requestId: "req-lease-vencida", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker-a", at: AT, leaseTtlMs: TTL });
    const muchLater = new Date(Date.parse(AT) + TTL + 1_000).toISOString();
    const second = await registry.reserve({ requestId: "req-lease-vencida", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker-b", at: muchLater, leaseTtlMs: TTL });
    assert.equal(second.outcome, "RECOVERY_REQUIRED");
    if (second.outcome !== "RECOVERY_REQUIRED") return;
    assert.equal(second.entry.status, "PENDING");

    const recoverable = await registry.listRecoverable(muchLater);
    assert.ok(recoverable.some((e) => e.requestId === "req-lease-vencida"));
  });

  // ------------------------------------------------------ 22/23. owner/token incorreto

  test(`[${name}] finish()/release() com token errado: REQUEST_OWNER_MISMATCH`, async () => {
    const registry = make();
    await registry.reserve({ requestId: "req-owner", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });

    const finishResult = await registry.finish({ requestId: "req-owner", executionToken: "token-errado", status: "COMPLETED", result: fakeResult(), at: LATER });
    assert.equal(finishResult.ok, false);
    if (finishResult.ok) return;
    assert.equal(finishResult.violation.code, "REQUEST_OWNER_MISMATCH");

    const releaseResult = await registry.release({ requestId: "req-owner", executionToken: "token-errado" });
    assert.equal(releaseResult.ok, false);
    if (releaseResult.ok) return;
    assert.equal(releaseResult.violation.code, "REQUEST_OWNER_MISMATCH");
  });

  // --------------------------------------------------- 24/25. versão conflitante / transacional

  test(`[${name}] finish() duas vezes com o MESMO token: a segunda vê REQUEST_VERSION_CONFLICT (conclusão transacional)`, async () => {
    const registry = make();
    const reserved = await registry.reserve({ requestId: "req-versao", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });
    if (reserved.outcome !== "RESERVED") throw new Error("unreachable");

    const first = await registry.finish({ requestId: "req-versao", executionToken: reserved.lease.executionToken, status: "COMPLETED", result: fakeResult(), at: LATER });
    assert.equal(first.ok, true);

    const second = await registry.finish({ requestId: "req-versao", executionToken: reserved.lease.executionToken, status: "COMPLETED", result: fakeResult(), at: LATER });
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.violation.code, "REQUEST_VERSION_CONFLICT");
  });

  // -------------------------------------------------------------- REQUEST_NOT_FOUND

  test(`[${name}] finish()/release() de requestId inexistente: REQUEST_NOT_FOUND`, async () => {
    const registry = make();
    const finishResult = await registry.finish({ requestId: "nunca-existiu", executionToken: "x", status: "COMPLETED", result: fakeResult(), at: LATER });
    assert.equal(finishResult.ok, false);
    if (!finishResult.ok) assert.equal(finishResult.violation.code, "REQUEST_NOT_FOUND");
  });

  // ------------------------------------------------------------ resultado inválido

  test(`[${name}] finish() com resultado malformado é rejeitado antes de persistir (REQUEST_INVALID_STORED_RESULT)`, async () => {
    const registry = make();
    const reserved = await registry.reserve({ requestId: "req-invalido", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });
    if (reserved.outcome !== "RESERVED") throw new Error("unreachable");

    const malformed = { ...fakeResult(), decision: "NOT_A_REAL_DECISION" } as unknown as ManualSyntheticDispatchResult;
    const finished = await registry.finish({ requestId: "req-invalido", executionToken: reserved.lease.executionToken, status: "COMPLETED", result: malformed, at: LATER });
    assert.equal(finished.ok, false);
    if (!finished.ok) assert.equal(finished.violation.code, "REQUEST_INVALID_STORED_RESULT");
  });

  // -------------------------------------------------------------- 37. isolamento

  test(`[${name}] duas instâncias nunca compartilham estado`, async () => {
    const a = make();
    const b = make();
    await a.reserve({ requestId: "req-isolado", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });
    assert.equal(await a.count(), 1);
    assert.equal(await b.count(), 0);
  });

  // ---------------------------------------------------------- segurança do resultado

  test(`[${name}] resultado persistido nunca carrega sessionHandle nem credencial`, async () => {
    const registry = make();
    const reserved = await registry.reserve({ requestId: "req-seguranca", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });
    if (reserved.outcome !== "RESERVED") throw new Error("unreachable");
    await registry.finish({ requestId: "req-seguranca", executionToken: reserved.lease.executionToken, status: "COMPLETED", result: fakeResult({ requestId: "req-seguranca" }), at: LATER });

    const found = await registry.find("req-seguranca");
    const serialized = JSON.stringify(found).toLowerCase();
    for (const forbidden of ["sessionhandle", "senha", "password", "cookie", "token=", "000.000.000-00"]) {
      assert.equal(serialized.includes(forbidden), false, `[${name}] vazou "${forbidden}"`);
    }
  });
}

// ------------------------------------------------------------- cópias defensivas

test("InMemoryManualDispatchRequestRegistry: find() devolve cópia defensiva", async () => {
  const registry = new InMemoryManualDispatchRequestRegistry();
  const reserved = await registry.reserve({ requestId: "req-1", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });
  if (reserved.outcome !== "RESERVED") throw new Error("unreachable");
  await registry.finish({ requestId: "req-1", executionToken: reserved.lease.executionToken, status: "COMPLETED", result: fakeResult({ warnings: [{ code: "PARTIAL_BATCH", detail: "x" }] }), at: LATER });

  const found = await registry.find("req-1");
  (found!.result as { reason: string }).reason = "adulterado";
  (found!.result!.warnings[0] as { detail: string }).detail = "adulterado";

  const secondLookup = await registry.find("req-1");
  assert.equal(secondLookup!.result!.reason, "motivo redigido");
  assert.equal(secondLookup!.result!.warnings[0]!.detail, "x");
});

test("InMemoryManualDispatchRequestRegistry: clear() limpa só a própria instância", async () => {
  const a = new InMemoryManualDispatchRequestRegistry();
  const b = new InMemoryManualDispatchRequestRegistry();
  await a.reserve({ requestId: "req-1", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });
  await b.reserve({ requestId: "req-1", batchId: "batch-1", fingerprint: "fp-1", requestedBy: "admin", environment: "SYNTHETIC_LAB", reason: "motivo", requestedAt: AT, claimedBy: "worker", at: AT, leaseTtlMs: TTL });

  a.clear();

  assert.equal(await a.count(), 0);
  assert.equal(await b.count(), 1);
});

// ------------------------------------------------------------------- 40. rede

test("nenhuma rede/I/O externo, nenhum console.* nos módulos do registry", () => {
  const files = [
    "src/server/automation/synthetic/admin/manualDispatchRequestRegistry.ts",
    "src/server/automation/synthetic/admin/inMemoryManualDispatchRequestRegistry.ts",
    "src/server/automation/synthetic/admin/prismaManualDispatchRequestRegistry.ts",
    "src/server/automation/synthetic/admin/manualDispatchRequestRegistryFactory.ts",
  ];
  for (const file of files) {
    const code = readFileSync(file, "utf8");
    assert.doesNotMatch(code, /console\.(log|error|warn|info|debug)/, `${file} não deve usar console`);
    assert.doesNotMatch(code, /\bfetch\(/, `${file} não faz rede`);
    assert.doesNotMatch(code, /chromium|@playwright\/test/, `${file} não referencia Playwright`);
  }
});

test("nenhuma variável de módulo mutável nos módulos do registry", () => {
  const files = [
    "src/server/automation/synthetic/admin/manualDispatchRequestRegistry.ts",
    "src/server/automation/synthetic/admin/inMemoryManualDispatchRequestRegistry.ts",
    "src/server/automation/synthetic/admin/prismaManualDispatchRequestRegistry.ts",
    "src/server/automation/synthetic/admin/manualDispatchRequestRegistryFactory.ts",
  ];
  for (const file of files) {
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.equal(/^let \w/m.test(code), false, `${file} não pode ter \`let\` de módulo`);
  }
});

test("o trigger não importa Prisma; o adaptador Prisma não importa o dispatcher/executor/Playwright", () => {
  const triggerCode = readFileSync("src/server/automation/synthetic/admin/manualSyntheticDispatchTrigger.ts", "utf8");
  assert.doesNotMatch(triggerCode, /@prisma\/client|prismaManualDispatchRequestRegistry/, "trigger não pode importar Prisma diretamente");

  const prismaAdapterCode = readFileSync("src/server/automation/synthetic/admin/prismaManualDispatchRequestRegistry.ts", "utf8");
  assert.doesNotMatch(prismaAdapterCode, /dispatchSyntheticBatch|syntheticStepExecutor|chromium|@playwright\/test|Gov\.br|SINARM/, "adaptador Prisma não pode acessar dispatcher/executor/portal");
});
