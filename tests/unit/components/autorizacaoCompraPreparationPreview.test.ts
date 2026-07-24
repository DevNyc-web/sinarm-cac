/**
 * Preview read-only da preparacao da Autorizacao de Compra — testes de RENDER.
 *
 * Render puro via renderToStaticMarkup (sem JSX no teste: createElement). Sem DOM,
 * sem rede, sem banco, sem PII. Verifica que o preview e SO informativo — sem
 * input/select/form/botao/link/action e sem sugerir abrir autorizacao.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutorizacaoCompraPreparationPreview } from "../../../src/components/processes/AutorizacaoCompraPreparationPreview";
import { getAutorizacaoCompraPreparation } from "../../../src/server/processes/autorizacaoCompraPreparation";

// tsconfig usa `jsx: preserve`; sob o tsx/esbuild o transform e classico e o
// componente referencia o `React` global no render — expomos so para o teste.
(globalThis as unknown as { React: typeof React }).React = React;

function render(): string {
  return renderToStaticMarkup(createElement(AutorizacaoCompraPreparationPreview));
}

test("titulo, badge e banner de bloqueio", () => {
  const html = render();
  assert.ok(html.includes("Autorização de Compra — preparação"));
  assert.ok(html.includes("Em preparação"));
  assert.ok(
    html.includes(
      "A Autorização de Compra ainda não está disponível — nenhuma solicitação pode ser aberta ou preenchida nesta etapa.",
    ),
  );
});

test("taxa, dependencia e metadados de servico", () => {
  const html = render();
  const prep = getAutorizacaoCompraPreparation();
  assert.ok(html.includes("Taxa GRU prevista: R$ 25,00"));
  assert.ok(html.includes("Depende de Concessão de CR deferida."));
  assert.ok(html.includes(prep.service.service));
  assert.ok(html.includes(prep.service.defaultActivity));
  assert.ok(html.includes(prep.service.defaultPceType));
});

test("indicadores refletem available:false e canCreate:false", () => {
  const prep = getAutorizacaoCompraPreparation();
  assert.equal(prep.available, false);
  assert.equal(prep.canCreate, false);
  const html = render();
  assert.ok(html.includes("Disponível"));
  assert.ok(html.includes("Pode ser criado agora"));
  assert.ok(!html.includes(">Sim<"), "nenhum indicador deve aparecer como Sim");
});

test("renderiza os 5 requisitos atuais e NAO expande para os 12", () => {
  const html = render();
  const prep = getAutorizacaoCompraPreparation();
  assert.equal(prep.requirements.length, 5);
  assert.ok(html.includes("Requisitos (etapa futura) (5)"));
  for (const r of prep.requirements) {
    assert.ok(html.includes(r.label), `requisito ausente: ${r.label}`);
  }
  // Label exclusivo dos 12 detalhados (memoria) nao pode aparecer.
  assert.ok(!html.includes("Antecedentes Justiça Federal"));
  assert.ok(!html.includes("Justiça Militar"));
});

test("PCE: blocos Acessorio (7) e Arma de Fogo (21) com todos os labels", () => {
  const html = render();
  const prep = getAutorizacaoCompraPreparation();
  const acessorio = prep.pcePreparation.find((p) => p.key === "ACESSORIO");
  const arma = prep.pcePreparation.find((p) => p.key === "ARMA_DE_FOGO");
  assert.equal(acessorio?.fields.length, 7);
  assert.equal(arma?.fields.length, 21);
  assert.ok(html.includes("Acessório (7 campos)"));
  assert.ok(html.includes("Arma de Fogo (21 campos)"));
  for (const f of acessorio?.fields ?? []) {
    assert.ok(html.includes(f.label), `campo Acessorio ausente: ${f.label}`);
  }
  for (const f of arma?.fields ?? []) {
    assert.ok(html.includes(f.label), `campo Arma ausente: ${f.label}`);
  }
});

test("NAO contem input/select/form/botao/link nem texto de criacao", () => {
  const html = render();
  assert.ok(!/<input/i.test(html), "sem <input>");
  assert.ok(!/<select/i.test(html), "sem <select>");
  assert.ok(!/<form/i.test(html), "sem <form>");
  assert.ok(!/<button/i.test(html), "sem <button>");
  assert.ok(!/<a\b/i.test(html), "sem link");
  assert.ok(!html.includes("value="), "sem atributo value");
  assert.ok(!html.includes("Criar"), "sem 'Criar'");
  assert.ok(!html.toLowerCase().includes("abrir autorização"), "nao sugere abrir autorizacao");
  assert.ok(!html.toLowerCase().includes("solicitar autorização"), "nao sugere solicitar");
});

/** Trava estatica: UI pura/read-only — sem I/O, rede, criacao, action, form, credencial. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o componente e puro (sem Prisma/rede/criacao/action/form/options/credencial)", () => {
  const code = codeOnly(
    readFileSync("src/components/processes/AutorizacaoCompraPreparationPreview.tsx", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client|\bprisma\b/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede/URL externa");
  assert.doesNotMatch(code, /\bcreate\(|\bupdate\(|\bupsert\(|\bdelete\(/, "sem escrita");
  assert.doesNotMatch(code, /\baction\b|\bform\b/i, "sem action/form");
  assert.doesNotMatch(code, /\boptions\b|\bplaceholder\b/, "sem options/placeholder");
  assert.doesNotMatch(code, /\bpassword\b|\bsenha\b|\btoken\b|\bcookie\b/i, "sem credencial");
});
