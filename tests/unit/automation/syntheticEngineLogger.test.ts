/**
 * Eventos de log do motor sintético (`syntheticEngineLogger.ts`) e o
 * sumidouro em memória (`inMemorySyntheticEngineLogger.ts`) — forma fechada,
 * redação, isolamento por instância, cópia defensiva.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SYNTHETIC_ENGINE_LOG_EVENT_CODES,
  buildSyntheticEngineLogEvent,
  validateSyntheticEngineLogEvent,
} from "../../../src/server/automation/synthetic/observability/syntheticEngineLogger";
import { InMemorySyntheticEngineLogger } from "../../../src/server/automation/synthetic/observability/inMemorySyntheticEngineLogger";

// ------------------------------------------------------------- construção

test("evento tem os 18 códigos fechados e nível padrão coerente", () => {
  assert.equal(SYNTHETIC_ENGINE_LOG_EVENT_CODES.length, 18);
  const event = buildSyntheticEngineLogEvent({ code: "RUN_FAILED", timestamp: "2026-08-13T10:00:00.000Z" });
  assert.equal(event.level, "WARN");
  const ok = buildSyntheticEngineLogEvent({ code: "RUN_COMPLETED", timestamp: "2026-08-13T10:00:00.000Z" });
  assert.equal(ok.level, "INFO");
});

test("nível pode ser sobreposto explicitamente", () => {
  const event = buildSyntheticEngineLogEvent({ code: "RUN_COMPLETED", timestamp: "2026-08-13T10:00:00.000Z", level: "ERROR" });
  assert.equal(event.level, "ERROR");
});

// ------------------------------------------------------------- 19. redação

test("motivo é sempre redigido (nunca texto cru)", () => {
  const event = buildSyntheticEngineLogEvent({
    code: "RUN_FAILED",
    timestamp: "2026-08-13T10:00:00.000Z",
    reason: "senha=abc123 falhou para o CPF 000.000.000-00",
  });
  assert.equal(event.reason.includes("abc123"), false);
  assert.equal(event.reason.includes("000.000.000-00"), false);
});

// ------------------------------------------------------ 20. sem stack trace

test("evento não tem campo para stack trace nem aceita um extra", () => {
  const event = buildSyntheticEngineLogEvent({ code: "RUN_FAILED", timestamp: "2026-08-13T10:00:00.000Z" });
  assert.equal("stack" in event, false);
  const validation = validateSyntheticEngineLogEvent({ ...event, stack: "Error: x\n  at y" });
  assert.equal(validation.ok, false);
});

// -------------------------------------------------- 21/22. sem handle/credencial

test("evento nunca carrega credencial em texto livre no motivo", () => {
  const event = buildSyntheticEngineLogEvent({
    code: "SESSION_MISMATCH",
    timestamp: "2026-08-13T10:00:00.000Z",
    reason: "token=xyz cookie=zzz",
  });
  const serialized = JSON.stringify(event).toLowerCase();
  for (const forbidden of ["token=xyz", "cookie=zzz"]) {
    assert.equal(serialized.includes(forbidden), false, `vazou "${forbidden}"`);
  }
});

test("evento fechado não tem campo próprio para sessionHandle — quem monta o evento nunca passa esse dado", () => {
  const event = buildSyntheticEngineLogEvent({ code: "SESSION_MISMATCH", timestamp: "2026-08-13T10:00:00.000Z" });
  assert.equal("sessionHandle" in event, false);
  assert.equal("session" in event, false);
});

test("validateSyntheticEngineLogEvent rejeita campo desconhecido e código fora da união fechada", () => {
  const base = buildSyntheticEngineLogEvent({ code: "BATCH_STARTED", timestamp: "2026-08-13T10:00:00.000Z" });
  const withExtra = { ...base, sessionHandle: "sh_x" };
  const validation = validateSyntheticEngineLogEvent(withExtra);
  assert.equal(validation.ok, false);

  const badCode = { ...base, code: "SOMETHING_ELSE" };
  const validation2 = validateSyntheticEngineLogEvent(badCode);
  assert.equal(validation2.ok, false);
});

test("counters e deltas nunca são negativos", () => {
  const event = buildSyntheticEngineLogEvent({
    code: "WORKER_FINISHED",
    timestamp: "2026-08-13T10:00:00.000Z",
    durationMs: -50,
    evidenceDelta: -3,
    eventsDelta: -1,
    counters: { negativo: -1, positivo: 2 },
  });
  assert.equal(event.durationMs, 0);
  assert.equal(event.evidenceDelta, 0);
  assert.equal(event.eventsDelta, 0);
  assert.deepEqual(event.counters, { positivo: 2 });
});

// --------------------------------------------------- 23. isolamento por instância

test("InMemorySyntheticEngineLogger: duas instâncias nunca compartilham estado", () => {
  const a = new InMemorySyntheticEngineLogger();
  const b = new InMemorySyntheticEngineLogger();

  a.emit(buildSyntheticEngineLogEvent({ code: "BATCH_STARTED", timestamp: "2026-08-13T10:00:00.000Z" }));

  assert.equal(a.snapshot().length, 1);
  assert.equal(b.snapshot().length, 0);
});

// ------------------------------------------------------- 24. cópias defensivas

test("InMemorySyntheticEngineLogger: snapshot é cópia defensiva", () => {
  const logger = new InMemorySyntheticEngineLogger();
  logger.emit(buildSyntheticEngineLogEvent({ code: "BATCH_STARTED", timestamp: "2026-08-13T10:00:00.000Z", counters: { x: 1 } }));

  const snapshot = logger.snapshot();
  (snapshot[0] as { reason: string }).reason = "adulterado";
  (snapshot[0]!.counters as Record<string, number>).x = 999;

  const secondSnapshot = logger.snapshot();
  assert.equal(secondSnapshot[0]!.reason, "");
  assert.equal(secondSnapshot[0]!.counters!.x, 1);
});

test("InMemorySyntheticEngineLogger: emit não é afetado por mutar o objeto original depois", () => {
  const logger = new InMemorySyntheticEngineLogger();
  const counters = { x: 1 };
  const event = buildSyntheticEngineLogEvent({ code: "BATCH_STARTED", timestamp: "2026-08-13T10:00:00.000Z", counters });
  logger.emit(event);
  counters.x = 999;

  assert.equal(logger.snapshot()[0]!.counters!.x, 1);
});

test("InMemorySyntheticEngineLogger: clear() limpa só a própria instância", () => {
  const a = new InMemorySyntheticEngineLogger();
  const b = new InMemorySyntheticEngineLogger();
  a.emit(buildSyntheticEngineLogEvent({ code: "BATCH_STARTED", timestamp: "2026-08-13T10:00:00.000Z" }));
  b.emit(buildSyntheticEngineLogEvent({ code: "BATCH_STARTED", timestamp: "2026-08-13T10:00:00.000Z" }));

  a.clear();

  assert.equal(a.snapshot().length, 0);
  assert.equal(b.snapshot().length, 1);
});

// -------------------------------------------------------------- estrutural

const LOGGER_SOURCE_FILES = [
  "src/server/automation/synthetic/observability/syntheticEngineLogger.ts",
  "src/server/automation/synthetic/observability/inMemorySyntheticEngineLogger.ts",
];

test("nenhum console.* nem I/O dentro dos módulos de log", () => {
  for (const file of LOGGER_SOURCE_FILES) {
    const code = readFileSync(file, "utf8");
    assert.doesNotMatch(code, /console\.(log|error|warn|info|debug)/, `${file} não deve usar console`);
    assert.doesNotMatch(code, /node:fs|node:child_process|node:net|fetch\(/, `${file} não faz I/O`);
  }
});

test("nenhuma variável de módulo mutável (sem estado global) nos módulos de log", () => {
  for (const file of LOGGER_SOURCE_FILES) {
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.equal(/^let \w/m.test(code), false, `${file} não pode ter \`let\` de módulo`);
  }
});
