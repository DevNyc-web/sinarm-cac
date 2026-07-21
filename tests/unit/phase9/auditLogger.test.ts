/**
 * Fase 9 — Testes do audit logger (mascaramento e campos proibidos).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPhase9AuditLogger,
  sanitizeMeta,
} from "../../../src/server/automation/phase9/auditLogger";

test("nao registra campos proibidos (senha/otp/cookie/token)", () => {
  const clean = sanitizeMeta({
    password: "segredo",
    senha: "segredo",
    otp: "123456",
    cookie: "abc=def",
    token: "xyz",
    processId: "proc-1",
  });
  assert.equal("password" in clean, false);
  assert.equal("senha" in clean, false);
  assert.equal("otp" in clean, false);
  assert.equal("cookie" in clean, false);
  assert.equal("token" in clean, false);
  // campo nao sensivel permanece
  assert.equal(clean.processId, "proc-1");
  // marcador de redacao presente
  assert.equal(clean._redactedKeys, 5);
});

test("mascara CPF e sequencias longas de digitos em valores string", () => {
  const clean = sanitizeMeta({ nota: "CPF 123.456.789-00 serie 987654321" });
  assert.equal(String(clean.nota).includes("123.456.789-00"), false);
  assert.equal(String(clean.nota).includes("987654321"), false);
});

test("logger registra evento e devolve copia; nao vaza campo proibido", () => {
  const audit = createPhase9AuditLogger();
  audit.record({
    type: "STEP_STARTED",
    executionId: "exec-1",
    step: "HEALTH_CHECK",
    meta: { token: "deveria-sumir", ok: true },
  });
  const events = audit.events();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "STEP_STARTED");
  assert.equal("token" in (events[0].meta ?? {}), false);
  assert.equal(events[0].meta?.ok, true);
});
