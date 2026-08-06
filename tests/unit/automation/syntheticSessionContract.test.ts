/**
 * Fase 2 — contrato de sessao sintetica (docs/73) e estados (docs/74).
 *
 * O contrato precisa ser: FECHADO (campo fora da lista e rejeitado, nao
 * ignorado), incapaz de carregar credencial ou dado real, restrito a ambiente
 * sintetico e alinhado a maquina de estados. Todos os dados aqui sao FICTICIOS.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SYNTHETIC_HANDOFF_STATES,
  SYNTHETIC_SESSION_FIELDS,
  SYNTHETIC_TERMINAL_STATES,
  canTransition,
  isSuspiciousFieldName,
  isSyntheticTerminalState,
  validateSyntheticSessionContract,
  type SyntheticViolationCode,
} from "../../../src/server/automation/synthetic/sessionContract";

const SOURCE_PATH = "src/server/automation/synthetic/sessionContract.ts";

const EMITIDO = "2026-08-06T10:00:00.000Z";
const EXPIRA = "2026-08-06T10:10:00.000Z";

function baseContract(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionHandle: "sh_lab_0001",
    processId: "proc-lab-0001",
    actorId: "actor-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: EXPIRA,
    issuedAt: EMITIDO,
    environment: "synthetic",
    consentMarker: "consent-sintetico-0001",
    handoffState: "CREATED",
    auditCorrelationId: "corr-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-0001",
    ...overrides,
  };
}

/** Códigos das violações, para asserção legível. */
function codes(input: unknown): SyntheticViolationCode[] {
  return validateSyntheticSessionContract(input).violations.map((v) => v.code);
}

// ------------------------------------------------------------ caminho feliz

test("aceita o contrato mínimo válido", () => {
  const result = validateSyntheticSessionContract(baseContract());

  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
  assert.equal(result.contract?.environment, "synthetic");
  assert.equal(result.contract?.handoffState, "CREATED");
  assert.deepEqual(result.contract?.scope, ["LAB_GUIA_TRAFEGO_SYNTHETIC"]);
});

test("expõe exatamente os 11 campos permitidos do docs/73 §3", () => {
  assert.equal(SYNTHETIC_SESSION_FIELDS.length, 11);
  assert.deepEqual([...SYNTHETIC_SESSION_FIELDS].sort(), [
    "actorId",
    "allowedSyntheticProcessCode",
    "auditCorrelationId",
    "consentMarker",
    "environment",
    "expiresAt",
    "handoffState",
    "issuedAt",
    "processId",
    "scope",
    "sessionHandle",
  ]);
});

test("é determinístico — mesma entrada, mesmo resultado", () => {
  const input = baseContract({ handoffState: "BLOCKED" });
  assert.deepEqual(
    validateSyntheticSessionContract(input),
    validateSyntheticSessionContract(input),
  );
});

// --------------------------------------------------------- campos proibidos

test("rejeita campo desconhecido, mesmo inofensivo", () => {
  assert.deepEqual(codes(baseContract({ observacao: "nota qualquer" })), ["UNKNOWN_FIELD"]);
});

for (const key of [
  "password",
  "senha",
  "otp",
  "cookie",
  "token",
  "credential",
  "credencial",
  "cpf",
  "storageState",
  "storage_state",
  "govbr",
  "gov_br",
]) {
  test(`rejeita chave suspeita "${key}" com código próprio`, () => {
    const result = validateSyntheticSessionContract(baseContract({ [key]: "x" }));

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.violations.map((v) => v.code),
      ["SUSPICIOUS_FIELD_NAME"],
      "campo suspeito é alarme, não UNKNOWN_FIELD genérico",
    );
    assert.equal(result.violations[0]?.field, key);
  });
}

test("pega nome suspeito com separador ou caixa diferente", () => {
  assert.equal(isSuspiciousFieldName("govBrToken"), true);
  assert.equal(isSuspiciousFieldName("x-auth-cookie"), true);
  assert.equal(isSuspiciousFieldName("STORAGE_STATE"), true);
  assert.equal(isSuspiciousFieldName("cpfDoCliente"), true);
  assert.equal(isSuspiciousFieldName("scope"), false);
});

test("sessionHandle é permitido — a allow-list vence a varredura de suspeitos", () => {
  // O nome casa com a varredura (`session`), mas está entre os 11 permitidos.
  assert.equal(isSuspiciousFieldName("sessionHandle"), false);
  assert.equal(validateSyntheticSessionContract(baseContract()).ok, true);
});

// ---------------------------------------------------------------- ambiente

test("rejeita environment production", () => {
  assert.deepEqual(codes(baseContract({ environment: "production" })), ["INVALID_ENVIRONMENT"]);
});

test("aceita synthetic, local e test", () => {
  for (const environment of ["synthetic", "local", "test"]) {
    assert.equal(validateSyntheticSessionContract(baseContract({ environment })).ok, true);
  }
});

// -------------------------------------------------------- valores proibidos

for (const host of [
  "https://gov.br/algo",
  "https://servicos.pf.gov.br/sisgcorp",
  "sinarm",
  "https://sso.acesso.gov.br/login",
]) {
  test(`rejeita valor com host oficial: ${host}`, () => {
    const result = validateSyntheticSessionContract(baseContract({ consentMarker: host }));

    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.code === "FORBIDDEN_HOST"));
  });
}

test("rejeita host oficial dentro de item do scope (varredura recursiva)", () => {
  const result = validateSyntheticSessionContract(
    baseContract({ scope: ["LAB_OK", "https://servicos.pf.gov.br/x"] }),
  );

  assert.equal(result.ok, false);
  const forbidden = result.violations.find((v) => v.code === "FORBIDDEN_HOST");
  assert.equal(forbidden?.field, "scope[1]");
});

test("rejeita URL externa", () => {
  assert.ok(codes(baseContract({ processId: "https://example.com/x" })).includes("EXTERNAL_URL"));
});

test("aceita URL de localhost", () => {
  assert.equal(
    validateSyntheticSessionContract(baseContract({ consentMarker: "http://localhost:3000/lab" }))
      .ok,
    true,
  );
});

// O proibido continua proibido serializado (docs/73 §4): sem isto, o mesmo
// segredo entraria uma camada de aspas adiante.
for (const payload of [
  '{"cookie":"abc123"}',
  '{"storageState":{}}',
  '{"cpf":"000.000.000-00"}',
  '{"token":"abc"}',
  '{"otp":"123456"}',
  '{"password":"abc"}',
  '{"senha":"abc"}',
  '{"credencial":"abc"}',
  "cookie=abc123",
  "storage_state: {}",
]) {
  test(`rejeita campo permitido com payload serializado: ${payload}`, () => {
    const result = validateSyntheticSessionContract(baseContract({ consentMarker: payload }));

    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((v) => v.code === "SERIALIZED_SECRET"),
      `esperava SERIALIZED_SECRET, veio ${result.violations.map((v) => v.code).join(", ")}`,
    );
  });
}

test("payload serializado é pego também dentro do scope (recursivo)", () => {
  const result = validateSyntheticSessionContract(
    baseContract({ scope: ["LAB_OK", '{"cookie":"abc"}'] }),
  );

  const violation = result.violations.find((v) => v.code === "SERIALIZED_SECRET");
  assert.equal(violation?.field, "scope[1]");
});

test("termo proibido sem separador de chave não é falso positivo", () => {
  // `token` dentro de um identificador legítimo não carrega segredo: sem `:`
  // ou `=` depois, não há payload.
  for (const value of ["consent-token-0001", "otpional-lab", "marcador-senhal"]) {
    assert.equal(
      validateSyntheticSessionContract(baseContract({ consentMarker: value })).ok,
      true,
      `${value} não deveria disparar SERIALIZED_SECRET`,
    );
  }
});

test("sessionHandle válido continua aceito com a trava de serializado ativa", () => {
  const result = validateSyntheticSessionContract(baseContract({ sessionHandle: "sh_lab_0001" }));

  assert.equal(result.ok, true);
  assert.equal(result.contract?.sessionHandle, "sh_lab_0001");
});

test("rejeita valor com formato de CPF, inclusive o fictício do laboratório", () => {
  assert.ok(codes(baseContract({ actorId: "123.456.789-09" })).includes("CPF_LIKE_VALUE"));
  assert.ok(codes(baseContract({ actorId: "000.000.000-00" })).includes("CPF_LIKE_VALUE"));
  assert.ok(codes(baseContract({ actorId: "12345678909" })).includes("CPF_LIKE_VALUE"));
});

// ------------------------------------------------------------------ prazos

test("exige expiresAt — ausência não vira 'não expira'", () => {
  const input = baseContract();
  delete input.expiresAt;

  assert.deepEqual(codes(input), ["MISSING_FIELD"]);
});

test("rejeita timestamp fora do ISO-8601", () => {
  assert.deepEqual(codes(baseContract({ issuedAt: "06/08/2026" })), ["INVALID_TIMESTAMP"]);
});

test("rejeita expiração anterior ou igual à emissão", () => {
  assert.deepEqual(codes(baseContract({ expiresAt: EMITIDO })), ["EXPIRES_NOT_AFTER_ISSUED"]);
  assert.deepEqual(codes(baseContract({ expiresAt: "2026-08-06T09:00:00.000Z" })), [
    "EXPIRES_NOT_AFTER_ISSUED",
  ]);
});

// ------------------------------------------------------- código de processo

test("rejeita código com formato de protocolo real", () => {
  assert.deepEqual(codes(baseContract({ allowedSyntheticProcessCode: "2026123456789" })), [
    "INVALID_PROCESS_CODE",
  ]);
});

test("aceita PROT-FICT-* e CAC-*", () => {
  for (const code of ["PROT-FICT-0001", "CAC-2026-000001"]) {
    assert.equal(
      validateSyntheticSessionContract(baseContract({ allowedSyntheticProcessCode: code })).ok,
      true,
    );
  }
});

// ------------------------------------------------------------------ estados

test("valida os 8 estados permitidos", () => {
  assert.equal(SYNTHETIC_HANDOFF_STATES.length, 8);
  for (const handoffState of SYNTHETIC_HANDOFF_STATES) {
    assert.equal(validateSyntheticSessionContract(baseContract({ handoffState })).ok, true);
  }
  assert.deepEqual(codes(baseContract({ handoffState: "PAUSED" })), ["INVALID_STATE"]);
});

test("terminais são exatamente COMPLETED, FAILED, EXPIRED e CANCELLED", () => {
  assert.deepEqual([...SYNTHETIC_TERMINAL_STATES].sort(), [
    "CANCELLED",
    "COMPLETED",
    "EXPIRED",
    "FAILED",
  ]);
  assert.equal(isSyntheticTerminalState("BLOCKED"), false);
});

test("terminal não reabre, não renova, não reexecuta", () => {
  for (const from of SYNTHETIC_TERMINAL_STATES) {
    for (const to of SYNTHETIC_HANDOFF_STATES) {
      assert.equal(canTransition(from, to), false, `${from} -> ${to} deveria ser proibido`);
    }
  }
});

test("BLOCKED sai para CANCELLED, FAILED ou EXPIRED", () => {
  assert.equal(canTransition("BLOCKED", "CANCELLED"), true);
  assert.equal(canTransition("BLOCKED", "FAILED"), true);
  assert.equal(canTransition("BLOCKED", "EXPIRED"), true);
});

test("BLOCKED não vai para COMPLETED nem IN_PROGRESS", () => {
  assert.equal(canTransition("BLOCKED", "COMPLETED"), false);
  assert.equal(canTransition("BLOCKED", "IN_PROGRESS"), false);
});

test("caminho feliz do handoff é permitido", () => {
  assert.equal(canTransition("CREATED", "CLAIMED"), true);
  assert.equal(canTransition("CLAIMED", "IN_PROGRESS"), true);
  assert.equal(canTransition("IN_PROGRESS", "COMPLETED"), true);
  assert.equal(canTransition("IN_PROGRESS", "BLOCKED"), true);
});

test("claim é único e estado desconhecido nunca transita", () => {
  assert.equal(canTransition("CLAIMED", "CLAIMED"), false);
  assert.equal(canTransition("CREATED", "COMPLETED"), false);
  assert.equal(canTransition("PAUSED", "COMPLETED"), false);
});

// ------------------------------------------------------- provas estruturais

/**
 * Código sem comentários. As travas abaixo valem para o que executa: um
 * comentário que cita `phase9/` ou `Date.now()` para explicar por que NÃO os
 * usa não pode derrubar o teste.
 */
function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("o módulo não importa Phase 9, Prisma nem I/O", () => {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const imports = source.match(/^import[\s\S]*?from\s+"[^"]+";/gm) ?? [];
  const code = sourceCode();

  assert.deepEqual(imports, [], "o contrato é puro: nenhum import");
  for (const forbidden of [
    "phase9",
    "@prisma/client",
    "node:fs",
    "playwright",
    "next/",
    "process.env",
    "fetch(",
  ]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

test("o módulo não lê relógio nem sorteia — determinismo por construção", () => {
  const code = sourceCode();

  assert.equal(code.includes("Date.now()"), false);
  assert.equal(code.includes("Math.random()"), false);
  assert.equal(code.includes("new Date()"), false);
});

test("o módulo não declara campo de credencial", () => {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const contractBlock = source.slice(source.indexOf("export interface SyntheticSessionContract"));
  const declared = contractBlock.slice(0, contractBlock.indexOf("}"));

  for (const forbidden of ["password", "senha", "otp", "cookie", "storageState", "cpf"]) {
    assert.equal(
      declared.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `contrato não pode declarar ${forbidden}`,
    );
  }
});
