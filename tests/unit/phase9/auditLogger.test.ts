/**
 * Fase 9 — Testes do audit logger (mascaramento e campos proibidos).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPhase9AuditLogger,
  sanitizeMeta,
} from "../../../src/server/automation/phase9/auditLogger";

test("nao registra o VALOR de campos proibidos (senha/otp/cookie/token)", () => {
  const clean = sanitizeMeta({
    password: "segredo",
    senha: "segredo",
    otp: "123456",
    cookie: "abc=def",
    token: "xyz",
    processId: "proc-1",
  });

  // Decisao da Fase 8D (docs/37): a CHAVE permanece como evidencia de
  // auditoria; o VALOR original e que nunca pode sobreviver.
  for (const key of ["password", "senha", "otp", "cookie", "token"]) {
    assert.equal(clean[key], "[REDACTED]", `${key} deveria estar redigida`);
  }
  const serialized = JSON.stringify(clean);
  for (const secret of ["segredo", "123456", "abc=def", "xyz"]) {
    assert.equal(serialized.includes(secret), false, `"${secret}" vazou no evento`);
  }

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

test("herda do labRedaction o que a mascara propria da Fase 9 nao cobria", () => {
  const clean = sanitizeMeta({
    contato: "fulano.teste@example.com",
    telefone: "(11) 98765-4321",
    rg: "12.345.678-9",
  });

  const serialized = JSON.stringify(clean);
  for (const pii of ["fulano.teste@example.com", "(11) 98765-4321", "12.345.678-9"]) {
    assert.equal(serialized.includes(pii), false, `"${pii}" nao foi mascarado`);
  }
});

test("chave inocente em portugues nao e confundida com segredo", () => {
  // A mascara antiga casava `pass` dentro de `passo` e `auth` dentro de `author`.
  const clean = sanitizeMeta({ passo: "HEALTH_CHECK", author: "operador-ficticio" });
  assert.equal(clean.passo, "HEALTH_CHECK");
  assert.equal(clean.author, "operador-ficticio");
  assert.equal("_redactedKeys" in clean, false);
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
  assert.equal(events[0].meta?.token, "[REDACTED]");
  assert.equal(JSON.stringify(events[0]).includes("deveria-sumir"), false);
  assert.equal(events[0].meta?.ok, true);
});
