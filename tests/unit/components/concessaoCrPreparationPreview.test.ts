/**
 * Preview read-only da preparacao da Concessao de CR — testes de RENDER.
 *
 * Render puro via renderToStaticMarkup (sem JSX no teste: createElement). Sem DOM,
 * sem rede, sem banco. Verifica que o preview e SO informativo — sem botao/link/
 * form de criar e sem sugerir abertura de processo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConcessaoCrPreparationPreview } from "../../../src/components/processes/ConcessaoCrPreparationPreview";
import { getConcessaoCrPreparation } from "../../../src/server/processes/concessaoCrPreparation";

// tsconfig usa `jsx: preserve`; sob o tsx/esbuild o transform e classico e o
// componente referencia o `React` global no render — expomos so para o teste.
(globalThis as unknown as { React: typeof React }).React = React;

function render(): string {
  return renderToStaticMarkup(createElement(ConcessaoCrPreparationPreview));
}

test("renderiza titulo, badge e banner de bloqueio", () => {
  const html = render();
  assert.ok(html.includes("Concessão de CR — preparação"));
  assert.ok(html.includes("Em preparação"));
  assert.ok(
    html.includes(
      "A Concessão de CR ainda não está disponível para criação — nenhum processo de CR pode ser aberto nesta etapa.",
    ),
  );
});

test("renderiza a taxa GRU prevista exata", () => {
  assert.ok(render().includes("Taxa GRU prevista: R$ 100,00"));
});

test("renderiza os documentos do solicitante vindos do descritor", () => {
  const html = render();
  const prep = getConcessaoCrPreparation();
  assert.ok(prep.applicantRequirements.length > 0);
  assert.ok(html.includes("Documentos do solicitante (etapa futura)"));
  for (const requirement of prep.applicantRequirements) {
    assert.ok(html.includes(requirement.label), `esperado doc do solicitante: ${requirement.label}`);
  }
});

test("renderiza os documentos geraveis pelo sistema vindos do descritor", () => {
  const html = render();
  const prep = getConcessaoCrPreparation();
  assert.ok(prep.systemGeneratedRequirements.length > 0);
  assert.ok(html.includes("Documentos geráveis pelo sistema (etapa futura)"));
  for (const requirement of prep.systemGeneratedRequirements) {
    assert.ok(html.includes(requirement.label), `esperado doc do sistema: ${requirement.label}`);
  }
});

test("renderiza o notice de seguranca", () => {
  assert.ok(
    render().includes(
      "Prévia somente leitura — não cria processo, não executa automação e não acessa Gov.br/SINARM.",
    ),
  );
});

test("reflete available:false e canCreate:false de forma visivel", () => {
  const prep = getConcessaoCrPreparation();
  assert.equal(prep.available, false);
  assert.equal(prep.canCreate, false);
  const html = render();
  assert.ok(html.includes("Disponível para criação"));
  assert.ok(html.includes("Pode ser criado agora"));
  // Ambos os indicadores devem aparecer como "Não".
  assert.ok(!html.includes(">Sim<"), "nenhum indicador deve aparecer como Sim");
});

test("NAO contem botao/link/form de criar nem sugere abrir processo", () => {
  const html = render();
  assert.ok(!/<form/i.test(html), "sem <form>");
  assert.ok(!/<button/i.test(html), "sem <button>");
  assert.ok(!/<a\b/i.test(html), "sem link");
  assert.ok(!html.includes("Criar"), "sem texto 'Criar'");
  assert.ok(!html.toLowerCase().includes("abrir processo"), "nao sugere abrir processo");
});

/** Trava estatica: UI pura/read-only — sem I/O, rede, criacao, action ou form. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o componente e puro (sem Prisma/rede/criacao/action/form)", () => {
  const code = codeOnly(
    readFileSync("src/components/processes/ConcessaoCrPreparationPreview.tsx", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client|\bprisma\b/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede/URL externa");
  assert.doesNotMatch(code, /\bcreate\(|\bupdate\(|\bupsert\(|\bdelete\(/, "sem escrita");
  assert.doesNotMatch(code, /\baction\b|\bform\b/i, "sem action/form");
});
