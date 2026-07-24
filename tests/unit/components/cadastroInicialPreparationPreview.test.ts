/**
 * Preview read-only da preparacao do Cadastro Inicial — testes de RENDER.
 *
 * Render puro via renderToStaticMarkup (sem JSX no teste: createElement). Sem DOM,
 * sem rede, sem banco, sem PII real. Verifica que o preview e SO informativo —
 * sem input/form/botao/link/action e sem sugerir abertura de cadastro.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CadastroInicialPreparationPreview } from "../../../src/components/processes/CadastroInicialPreparationPreview";
import { getCadastroInicialPreparation } from "../../../src/server/processes/cadastroInicialPreparation";

// tsconfig usa `jsx: preserve`; sob o tsx/esbuild o transform e classico e o
// componente referencia o `React` global no render — expomos so para o teste.
(globalThis as unknown as { React: typeof React }).React = React;

function render(): string {
  return renderToStaticMarkup(createElement(CadastroInicialPreparationPreview));
}

test("renderiza titulo, badge e banner de bloqueio", () => {
  const html = render();
  assert.ok(html.includes("Cadastro Inicial — preparação"));
  assert.ok(html.includes("Em preparação"));
  assert.ok(
    html.includes(
      "O Cadastro Inicial ainda não está disponível — nenhum cadastro pode ser aberto ou preenchido nesta etapa.",
    ),
  );
});

test("renderiza os 6 grupos e os campos esperados (por label)", () => {
  const html = render();
  const prep = getCadastroInicialPreparation();
  for (const group of prep.groups) {
    assert.ok(html.includes(group.title), `grupo ausente: ${group.title}`);
    for (const f of group.fields) {
      assert.ok(html.includes(f.label), `campo ausente: ${f.label}`);
    }
  }
});

test("apenas o segundo endereco de acervo mostra '(opcional)'", () => {
  const html = render();
  assert.ok(html.includes("Segundo endereço de acervo (opcional)"));
  assert.ok(!html.includes("Identidade (opcional)"));
  assert.ok(!html.includes("Endereço residencial (opcional)"));
});

test("renderiza os rotulos amigaveis de fonte", () => {
  const html = render();
  for (const label of [
    "pré-condição Gov.br",
    "lido do documento de identidade",
    "lido do comprovante de residência",
    "informado pelo solicitante",
    "consulta futura",
  ]) {
    assert.ok(html.includes(label), `rotulo de fonte ausente: ${label}`);
  }
});

test("reflete available:false e canCreate:false", () => {
  const prep = getCadastroInicialPreparation();
  assert.equal(prep.available, false);
  assert.equal(prep.canCreate, false);
  const html = render();
  assert.ok(html.includes("Disponível"));
  assert.ok(html.includes("Pode ser criado agora"));
  assert.ok(!html.includes(">Sim<"), "nenhum indicador deve aparecer como Sim");
});

test("renderiza o aviso Gov.br e o notice de seguranca", () => {
  const html = render();
  assert.ok(
    html.includes("A foto no Gov.br é apenas pré-condição — nenhuma credencial é lida ou armazenada."),
  );
  assert.ok(
    html.includes(
      "Prévia somente leitura — não coleta dados, não cria cadastro, não executa automação e não acessa Gov.br/SINARM.",
    ),
  );
});

test("NAO contem input/form/botao/link nem texto de criacao", () => {
  const html = render();
  assert.ok(!/<form/i.test(html), "sem <form>");
  assert.ok(!/<input/i.test(html), "sem <input>");
  assert.ok(!/<button/i.test(html), "sem <button>");
  assert.ok(!/<a\b/i.test(html), "sem link");
  assert.ok(!html.includes("Criar"), "sem texto 'Criar'");
  assert.ok(!html.toLowerCase().includes("abrir cadastro"), "nao sugere abrir cadastro");
});

test("contrato sem valores reais: nenhum campo do descritor tem 'value'", () => {
  const prep = getCadastroInicialPreparation();
  const allFields = prep.groups.flatMap((group) => group.fields);
  assert.ok(allFields.length > 0);
  for (const f of allFields) {
    assert.ok(!("value" in f), `campo ${f.key} nao deve ter 'value'`);
  }
  // Sem atributo de valor no HTML (nao ha inputs).
  assert.ok(!render().includes('value="'), "sem atributo value no HTML");
});

/** Trava estatica: UI pura/read-only — sem I/O, rede, criacao, action, form ou credencial. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o componente e puro (sem Prisma/rede/criacao/action/form/credencial)", () => {
  const code = codeOnly(
    readFileSync("src/components/processes/CadastroInicialPreparationPreview.tsx", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client|\bprisma\b/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede/URL externa");
  assert.doesNotMatch(code, /\bcreate\(|\bupdate\(|\bupsert\(|\bdelete\(/, "sem escrita");
  assert.doesNotMatch(code, /\baction\b|\bform\b/i, "sem action/form");
  assert.doesNotMatch(code, /\bpassword\b|\bsenha\b|\btoken\b|\bcookie\b/i, "sem credencial");
});
