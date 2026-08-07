/**
 * Guard de loopback do adaptador Playwright local (`localSyntheticNetworkGuard.ts`).
 *
 * Módulo puro, sem navegador — só parsing de URL. O bloqueio de rede REAL
 * (abortar requisição) é provado no spec Playwright; aqui é a regra fechada.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  assertLoopbackBaseUrl,
  checkLoopbackUrl,
  isLoopbackUrl,
} from "../../../src/server/automation/synthetic/playwright/localSyntheticNetworkGuard";

const SOURCE_PATH = "src/server/automation/synthetic/playwright/localSyntheticNetworkGuard.ts";

/** Código-fonte sem comentários — a prova estrutural não pode confundir texto explicativo com uso real. */
function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// -------------------------------------------------------------- aceitos

test("aceita http://localhost com porta", () => {
  assert.equal(isLoopbackUrl("http://localhost:3000/admin/lab/guia-trafego"), true);
});

test("aceita http://127.0.0.1 com porta", () => {
  assert.equal(isLoopbackUrl("http://127.0.0.1:3000/login"), true);
});

test("aceita esquemas sem rede (about/data/blob)", () => {
  assert.equal(isLoopbackUrl("about:blank"), true);
  assert.equal(isLoopbackUrl("data:text/plain;base64,AAA"), true);
  assert.equal(isLoopbackUrl("blob:http://localhost:3000/abc-123"), true);
});

// ------------------------------------------------------------- recusados

test("recusa domínio externo", () => {
  assert.equal(isLoopbackUrl("https://example.com"), false);
});

test("recusa IP remoto", () => {
  assert.equal(isLoopbackUrl("http://203.0.113.5:3000"), false);
});

test("recusa subdomínio parecido com loopback", () => {
  assert.equal(isLoopbackUrl("http://localhost.evil.com"), false);
});

test("recusa HTTPS mesmo em host loopback", () => {
  assert.equal(isLoopbackUrl("https://localhost:3000"), false);
});

test("recusa hosts da lista proibida, mesmo sem parecer URL de rede", () => {
  for (const url of [
    "https://www.gov.br",
    "https://servicos.pf.gov.br/sinarm",
    "https://sinarm.exemplo.com",
    "https://acesso.gov.br",
  ]) {
    assert.equal(isLoopbackUrl(url), false, `deveria recusar ${url}`);
  }
});

test("recusa URL malformada", () => {
  assert.equal(isLoopbackUrl("not a url"), false);
});

// --------------------------------------------------------- motivo tipado

test("checkLoopbackUrl devolve o host e o motivo, não só um booleano", () => {
  const rejected = checkLoopbackUrl("https://example.com/path");
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.host, "example.com");
  assert.ok(rejected.reason.length > 0);

  const accepted = checkLoopbackUrl("http://localhost:3000/x");
  assert.equal(accepted.allowed, true);
  assert.equal(accepted.host, "localhost");
});

// --------------------------------------------------- base URL (pré-browser)

test("assertLoopbackBaseUrl aceita localhost e 127.0.0.1 com porta", () => {
  assert.equal(assertLoopbackBaseUrl("http://localhost:3000").allowed, true);
  assert.equal(assertLoopbackBaseUrl("http://127.0.0.1:4000").allowed, true);
});

test("assertLoopbackBaseUrl recusa host externo mesmo vindo de env/parâmetro simulado", () => {
  for (const candidate of [
    "https://gov.br",
    "https://sinarm.gov.br",
    "http://evil.example.com:3000",
    "http://203.0.113.5:3000",
    "ftp://localhost:3000",
    process.env.SOME_UNSET_EXTERNAL_URL ?? "https://attacker.example",
  ]) {
    assert.equal(assertLoopbackBaseUrl(candidate).allowed, false, `deveria recusar ${candidate}`);
  }
});

test("assertLoopbackBaseUrl recusa about:/data:/blob: como base URL (não navegam para o laboratório)", () => {
  assert.equal(assertLoopbackBaseUrl("about:blank").allowed, false);
});

// ----------------------------------------------------- allow-list fechada

test("a regra não é uma allow-list ampla: só 2 hosts no conjunto fechado", () => {
  const code = readFileSync(SOURCE_PATH, "utf8");
  const match = code.match(/LOOPBACK_HOSTS[^\n]*Set\(\[([^\]]*)\]\)/);
  assert.ok(match, "LOOPBACK_HOSTS precisa ser um Set literal fechado");
  const hosts = match![1]!.split(",").map((h) => h.trim().replace(/["']/g, "")).filter(Boolean);
  assert.deepEqual(hosts.sort(), ["127.0.0.1", "localhost"]);
});

test("o módulo não importa Playwright nem toca rede/I-O", () => {
  const code = sourceCode();
  for (const forbidden of ["playwright", "fetch(", "chromium", "phase9", "fs.", "node:fs"]) {
    assert.equal(code.toLowerCase().includes(forbidden.toLowerCase()), false, `não pode referenciar ${forbidden}`);
  }
});
