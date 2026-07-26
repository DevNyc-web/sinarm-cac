/**
 * Fase 8D — redacao/sanitizacao do laboratorio sintetico (docs/37).
 *
 * Provam-se DUAS coisas: (1) chave de segredo nao sobrevive; (2) valor sensivel
 * em claro e mascarado. Todos os dados aqui sao FICTICIOS.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  LAB_REDACTED,
  isSecretKey,
  mergeRedactionSummary,
  redactLabError,
  redactLabMeta,
  redactLabText,
  redactLabValue,
} from "../../../src/server/automation/redaction";

/** Valores FICTICIOS usados como "vazamento" a ser barrado. */
const CPF = "123.456.789-09";
const CPF_CRU = "12345678909";
const RG = "12.345.678-9";
const EMAIL = "fulano.teste@example.com";
const TELEFONE = "(11) 98765-4321";
const NUMERO_LONGO = "9876543";

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

// ------------------------------------------------------------------ chaves

test("chaves de segredo sao substituidas por [REDACTED]", () => {
  const { value, summary } = redactLabMeta({
    senha: "SenhaFicticia123",
    password: "hunter2",
    pass: "abc",
    token: "eyJhbGciOiJIUzI1NiJ9.ficticio",
    cookie: "session=abc123; Path=/",
    otp: "123456",
    authorization: "Bearer ficticio-abc",
    secret: "s3gr3d0",
    credential: "cred-ficticia",
    credencial: "cred-ficticia",
  });

  for (const key of Object.keys(value)) {
    assert.equal(value[key], LAB_REDACTED, `${key} deveria estar redigida`);
  }
  assert.equal(summary.redactedKeys, 10);
});

test("variacoes de nome de chave tambem sao pegas", () => {
  for (const key of [
    "userPassword",
    "x-auth-token",
    "X_AUTH_TOKEN",
    "govbrPassword",
    "setCookie",
    "otpCode",
    "apiKey",
    "sessionId",
    "refreshToken",
    "Authorization",
  ]) {
    assert.equal(isSecretKey(key), true, `${key} deveria ser tratada como segredo`);
  }
});

test("chaves inocentes em portugues nao sao confundidas com segredo", () => {
  // "passo"/"passos" contem "pass" — nao pode virar falso positivo.
  for (const key of ["passo", "passos", "author", "autorizacaoCompra", "scenario", "status"]) {
    assert.equal(isSecretKey(key), false, `${key} nao deveria ser tratada como segredo`);
  }
});

test("o valor de uma chave de segredo nao vaza nem em objeto aninhado", () => {
  const { value } = redactLabValue({
    login: { dados: { senha: "SenhaFicticia123", usuario: "ficticio" } },
  });
  const output = serialize(value);
  assert.equal(output.includes("SenhaFicticia123"), false);
  assert.equal(output.includes("ficticio"), true, "irmao nao sensivel permanece");
});

test("container com nome de segredo derruba a subarvore inteira", () => {
  // `credentials` e, ela mesma, chave de segredo: nada abaixo dela e visitado.
  const { value, summary } = redactLabValue({
    credentials: { senha: "SenhaFicticia123", usuario: "ficticio" },
  });
  assert.deepEqual(value, { credentials: LAB_REDACTED });
  assert.equal(summary.redactedKeys, 1);
});

// ----------------------------------------------------------------- valores

test("CPF em claro e mascarado (com e sem pontuacao)", () => {
  const comPontos = redactLabText(`CPF do titular: ${CPF}`);
  assert.equal(comPontos.text.includes(CPF), false);
  assert.match(comPontos.text, /\*\*\*\.\*\*\*\.\*\*\*-\*\*/);

  const semPontos = redactLabText(`CPF ${CPF_CRU}`);
  assert.equal(semPontos.text.includes(CPF_CRU), false);
});

test("RG e mascarado", () => {
  const { text, masked } = redactLabText(`RG ${RG}`);
  assert.equal(text.includes(RG), false);
  assert.equal(masked, 1);
});

test("e-mail e mascarado", () => {
  const { text } = redactLabText(`contato ${EMAIL}`);
  assert.equal(text.includes(EMAIL), false);
  assert.equal(text.includes("[EMAIL]"), true);
});

test("telefone e mascarado", () => {
  const { text } = redactLabText(`telefone ${TELEFONE}`);
  assert.equal(text.includes(TELEFONE), false);
});

test("numeros longos sao mascarados (string e number)", () => {
  const comoTexto = redactLabText(`serie ${NUMERO_LONGO}`);
  assert.equal(comoTexto.text.includes(NUMERO_LONGO), false);

  const { value } = redactLabValue({ serie: 9876543, quantidade: 3 });
  assert.equal(serialize(value).includes("9876543"), false);
  assert.deepEqual(value, { serie: "******", quantidade: 3 });
});

test("modo 'identifiers' mascara PII mas preserva digitos legitimos", () => {
  // Texto livre: na duvida, mascara.
  assert.equal(redactLabText("arquivo-1784987585333.png").text.includes("1784987585333"), false);

  // Nome de arquivo: o timestamp sobrevive, o CPF e o e-mail nao.
  const timestamp = redactLabText("arquivo-1784987585333.png", "identifiers");
  assert.equal(timestamp.text, "arquivo-1784987585333.png");
  assert.equal(timestamp.masked, 0);

  const comCpf = redactLabText(`doc-${CPF}.png`, "identifiers");
  assert.equal(comCpf.text.includes(CPF), false);

  const comEmail = redactLabText(`export-${EMAIL}.json`, "identifiers");
  assert.equal(comEmail.text.includes(EMAIL), false);
});

// -------------------------------------------------------------- estruturas

test("objetos aninhados e arrays sao sanitizados", () => {
  const { value, summary } = redactLabValue({
    solicitante: { cpf: CPF, email: EMAIL, nome: "Cliente Fictício" },
    tentativas: [
      { token: "abc", telefone: TELEFONE },
      { token: "def", rg: RG },
    ],
  });

  const output = serialize(value);
  for (const original of [CPF, EMAIL, TELEFONE, RG, "abc", "def"]) {
    assert.equal(output.includes(original), false, `${original} vazou no relatório`);
  }
  assert.equal(output.includes("Cliente Fictício"), true, "dado nao sensivel permanece");
  assert.equal(summary.redactedKeys, 2, "dois tokens redigidos");
  assert.ok(summary.maskedValues >= 4, "cpf, e-mail, telefone e rg mascarados");
  assert.equal(summary.total, summary.redactedKeys + summary.maskedValues);
});

test("estrutura circular nao trava a redacao", () => {
  const node: Record<string, unknown> = { nome: "lab" };
  node.self = node;
  const { value } = redactLabValue(node);
  assert.deepEqual(value, { nome: "lab", self: "[CIRCULAR]" });
});

test("erro e sanitizado e o stack e descartado", () => {
  const error = new Error(`Falha ao enviar ${CPF} para ${EMAIL}`);
  const redacted = redactLabError(error);

  assert.equal(redacted.name, "Error");
  assert.equal(redacted.message.includes(CPF), false);
  assert.equal(redacted.message.includes(EMAIL), false);
  assert.equal(Object.keys(redacted).sort().join(","), "message,name", "sem stack");
});

// ------------------------------------------------------------- contabilidade

test("a contagem de itens redigidos e devolvida e somavel", () => {
  const { summary } = redactLabValue({ senha: "x", cpf: CPF });
  assert.equal(summary.redactedKeys, 1);
  assert.equal(summary.maskedValues, 1);
  assert.equal(summary.total, 2);

  const merged = mergeRedactionSummary(summary, summary);
  assert.deepEqual(merged, { redactedKeys: 2, maskedValues: 2, total: 4 });
});

test("a redacao e deterministica", () => {
  const input = { senha: "x", solicitante: { cpf: CPF, email: EMAIL }, lista: [TELEFONE, RG] };
  const primeira = redactLabValue(input);
  const segunda = redactLabValue(input);
  assert.deepEqual(primeira, segunda);
});

// ------------------------------------------------------------ trava estatica

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("a redacao do lab e pura: sem banco, rede, arquivo ou navegador", () => {
  const code = codeOnly(readFileSync("src/server/automation/redaction.ts", "utf8"));
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "e puro, sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, "nao faz requisicao");
  assert.doesNotMatch(code, /\b(?:https?|wss?):\/\//, "nao tem URL externa");
  assert.doesNotMatch(
    code,
    /(?:import|require)[^;\n]*["'][^"']*(?:node:fs|node:http|playwright|chromium|puppeteer)/i,
    "nao importa fs/http/navegador",
  );
  assert.doesNotMatch(
    code,
    /(?:import|require)[^;\n]*["'][^"']*phase9/i,
    "nao reaproveita codigo da Fase 9",
  );
});
