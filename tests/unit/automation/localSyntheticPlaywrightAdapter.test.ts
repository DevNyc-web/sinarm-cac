/**
 * Adaptador Playwright local (`localSyntheticPlaywrightAdapter.ts`) — provas
 * que NÃO exigem navegador real: rejeição de base URL antes de abrir o
 * Chromium, e provas estruturais de que erro bruto/segredo/screenshot nunca
 * chegam à evidência. O caminho feliz completo (com navegador real) está no
 * spec Playwright `tests/e2e/lab-guia-trafego-playwright-adapter.spec.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LocalSyntheticPlaywrightAdapter } from "../../../src/server/automation/synthetic/playwright/localSyntheticPlaywrightAdapter";

const SOURCE_PATH = "src/server/automation/synthetic/playwright/localSyntheticPlaywrightAdapter.ts";

function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// --------------------------------------------------- 7/8. rejeição pré-browser

test("recusa domínio externo como baseUrl ANTES de abrir o navegador", () => {
  assert.throws(() => new LocalSyntheticPlaywrightAdapter({ baseUrl: "https://example.com" }));
});

test("recusa IP remoto como baseUrl ANTES de abrir o navegador", () => {
  assert.throws(() => new LocalSyntheticPlaywrightAdapter({ baseUrl: "http://203.0.113.5:3000" }));
});

test("recusa host da lista proibida (Gov.br/SINARM/PF) como baseUrl", () => {
  for (const baseUrl of ["https://www.gov.br", "https://servicos.pf.gov.br", "https://acesso.gov.br"]) {
    assert.throws(() => new LocalSyntheticPlaywrightAdapter({ baseUrl }), `deveria recusar ${baseUrl}`);
  }
});

test("aceita localhost e 127.0.0.1 como baseUrl sem lançar", () => {
  assert.doesNotThrow(() => new LocalSyntheticPlaywrightAdapter({ baseUrl: "http://localhost:3000" }));
  assert.doesNotThrow(() => new LocalSyntheticPlaywrightAdapter({ baseUrl: "http://127.0.0.1:3000" }));
});

// -------------------------------------------------------------- 17. screenshot

test("o adaptador nunca chama page.screenshot", () => {
  const code = sourceCode();
  assert.equal(code.includes(".screenshot("), false);
});

// ------------------------------------------------------- 16. erro bruto redigido

test("erro bruto do Playwright nunca vira evidência: classifyError só devolve rótulos fixos", () => {
  const code = sourceCode();

  // O catch não pode propagar error.message/error.stack para o resultado tipado.
  assert.equal(code.includes("error.message"), false, "não pode expor error.message");
  assert.equal(code.includes("error.stack"), false, "não pode expor error.stack");
  assert.equal(code.includes("String(error)"), false, "não pode serializar o erro bruto");
});

// ------------------------------------------------- 18/19/20. sem credencial/cpf/handle

test("o adaptador não referencia credencial, CPF, cookie, token ou sessionHandle", () => {
  const code = sourceCode().toLowerCase();
  for (const forbidden of ["senha", "password", "cookie", "token", "storagestate", "sessionhandle", "cpf"]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

// -------------------------------------------------------- não é Fase 9 / worker

test("o adaptador não importa a Fase 9 nem persistência", () => {
  const code = sourceCode();
  for (const forbidden of ["phase9", "@prisma/client", "localStorage", "sessionStorage", "Date.now(", "playwright.phase9.config"]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

test("o adaptador não importa nem é importado pelo coordenador puro", () => {
  const code = sourceCode();
  assert.equal(code.includes("from \"../syntheticRunCoordinator\""), false);

  const coordinatorSource = readFileSync(
    "src/server/automation/synthetic/syntheticRunCoordinator.ts",
    "utf8",
  );
  for (const forbidden of ["playwright", "chromium"]) {
    assert.equal(
      coordinatorSource.toLowerCase().includes(forbidden),
      false,
      `o coordenador puro não pode referenciar ${forbidden}`,
    );
  }
});
