/**
 * Fase 9 — Testes do audit logger (mascaramento e campos proibidos).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPhase9AuditLogger,
  sanitizeMeta,
} from "../../../src/server/automation/phase9/auditLogger";
import { LAB_REDACTED } from "../../../src/server/automation/lab/labRedaction";

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

test("metrica numerica de auditoria e preservada; segredo e PII nao", () => {
  // Numero em audit meta e EVIDENCIA legitima (duracao, bytes, tentativa) — nao
  // pode ser mascarado so por ter muitos digitos, nem virar string. Strings
  // continuam sendo redigidas normalmente.
  const clean = sanitizeMeta({
    durationMs: 123456,
    bytes: 987654,
    attempt: 123456,
    tentativas: 3,
    senha: "hunter2",
    cpf: "123.456.789-09",
    email: "teste@example.com",
  });

  // numeros: mesmo valor E mesmo tipo
  assert.equal(clean.durationMs, 123456);
  assert.equal(typeof clean.durationMs, "number");
  assert.equal(clean.bytes, 987654);
  assert.equal(typeof clean.bytes, "number");
  assert.equal(clean.attempt, 123456);
  assert.equal(typeof clean.attempt, "number");
  assert.equal(clean.tentativas, 3);
  assert.equal(typeof clean.tentativas, "number");

  // segredo e PII continuam tratados
  assert.equal(clean.senha, LAB_REDACTED);
  assert.equal(String(clean.cpf).includes("123.456.789-09"), false);
  assert.equal(String(clean.email).includes("teste@example.com"), false);

  const serialized = JSON.stringify(clean);
  for (const secret of ["hunter2", "123.456.789-09", "teste@example.com"]) {
    assert.equal(serialized.includes(secret), false, `"${secret}" vazou no evento`);
  }
});

test("boolean tambem e preservado como boolean", () => {
  const clean = sanitizeMeta({ dryRun: true, blocked: false });
  assert.equal(clean.dryRun, true);
  assert.equal(typeof clean.dryRun, "boolean");
  assert.equal(clean.blocked, false);
  assert.equal(typeof clean.blocked, "boolean");
});

test("digitos longos EM STRING continuam mascarados", () => {
  // A preservacao vale para o TIPO number, nao para numero escrito em texto.
  const clean = sanitizeMeta({ serie: "987654321" });
  assert.equal(String(clean.serie).includes("987654321"), false);
});

test("estrutura aninhada e array continuam sanitizados (chamador sem tipos)", () => {
  const clean = sanitizeMeta({
    dados: { senha: "hunter2", ok: 1 },
    lista: ["123.456.789-09", "teste@example.com"],
  } as unknown as Parameters<typeof sanitizeMeta>[0]);

  const serialized = JSON.stringify(clean);
  for (const secret of ["hunter2", "123.456.789-09", "teste@example.com"]) {
    assert.equal(serialized.includes(secret), false, `"${secret}" vazou no aninhado`);
  }
  assert.equal(serialized.includes(LAB_REDACTED), true, "segredo aninhado foi redigido");
  // o contador nao pode ignorar o que foi redigido dentro da estrutura
  assert.equal(clean._redactedKeys, 1);
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
