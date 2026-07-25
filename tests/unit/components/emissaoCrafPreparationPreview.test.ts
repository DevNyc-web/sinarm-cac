/**
 * Preview read-only da preparacao da Emissao de CRAF — testes de RENDER.
 *
 * Render puro via renderToStaticMarkup (sem JSX no teste: createElement). Sem DOM,
 * sem rede, sem banco, sem PII. Verifica que o preview e SO informativo — sem
 * input/select/form/botao/link/action e sem sugerir criar/emitir CRAF.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmissaoCrafPreparationPreview } from "../../../src/components/processes/EmissaoCrafPreparationPreview";
import { getEmissaoCrafPreparation } from "../../../src/server/processes/emissaoCrafPreparation";

// tsconfig usa `jsx: preserve`; sob o tsx/esbuild o transform e classico e o
// componente referencia o `React` global no render — expomos so para o teste.
(globalThis as unknown as { React: typeof React }).React = React;

function render(): string {
  return renderToStaticMarkup(createElement(EmissaoCrafPreparationPreview));
}

test("titulo, badge e banner de bloqueio", () => {
  const html = render();
  assert.ok(html.includes("Emissão de CRAF — preparação"));
  assert.ok(html.includes("Em preparação"));
  assert.ok(
    html.includes(
      "A Emissão de CRAF ainda não está disponível — nenhum registro pode ser aberto ou preenchido nesta etapa.",
    ),
  );
});

test("taxa, dependencia e metadados de servico", () => {
  const html = render();
  const prep = getEmissaoCrafPreparation();
  assert.ok(html.includes("Taxa GRU prevista: R$ 88,00"));
  assert.ok(html.includes("Depende de Autorização de Compra deferida."));
  assert.ok(html.includes(prep.service.service));
  assert.ok(html.includes(prep.service.defaultActivity));
  assert.ok(html.includes(prep.service.defaultPceType));
});

test("indicadores refletem available:false e canCreate:false", () => {
  const prep = getEmissaoCrafPreparation();
  assert.equal(prep.available, false);
  assert.equal(prep.canCreate, false);
  const html = render();
  assert.ok(html.includes("Disponível"));
  assert.ok(html.includes("Pode ser criado agora"));
  assert.ok(!html.includes(">Sim<"), "nenhum indicador deve aparecer como Sim");
});

test("renderiza os 5 requisitos, incluindo a Nota fiscal", () => {
  const html = render();
  const prep = getEmissaoCrafPreparation();
  assert.equal(prep.requirements.length, 5);
  assert.ok(html.includes("Requisitos (etapa futura) (5)"));
  for (const r of prep.requirements) {
    assert.ok(html.includes(r.label), `requisito ausente: ${r.label}`);
  }
  assert.ok(html.includes("Nota fiscal de aquisição"));
});

test("authorizationData: bloco com os 4 campos como chips", () => {
  const html = render();
  const prep = getEmissaoCrafPreparation();
  assert.equal(prep.authorizationData.length, 4);
  assert.ok(html.includes("Dados da autorização (etapa futura)"));
  for (const label of ["Número da autorização", "SFPC", "Data da autorização", "Data de validade"]) {
    assert.ok(html.includes(label), `campo ausente: ${label}`);
  }
});

test("pceReference aparece so como nota, sem remodelar os 21 campos", () => {
  const html = render();
  const prep = getEmissaoCrafPreparation();
  assert.ok(html.includes(prep.pceReference.note));
  assert.match(prep.pceReference.note, /reaproveitad/i);
  // PCE de Arma de Fogo NAO e recadastrado aqui.
  assert.ok(!html.includes("Alma do cano"));
  assert.ok(!html.includes("Sentido das raias"));
});

test("NAO contem input/select/form/botao/link nem texto de criacao/emissao", () => {
  const html = render();
  assert.ok(!/<input/i.test(html), "sem <input>");
  assert.ok(!/<select/i.test(html), "sem <select>");
  assert.ok(!/<form/i.test(html), "sem <form>");
  assert.ok(!/<button/i.test(html), "sem <button>");
  assert.ok(!/<a\b/i.test(html), "sem link");
  assert.ok(!html.includes("value="), "sem atributo value");
  assert.ok(!html.includes("Criar"), "sem 'Criar'");
  assert.ok(!html.toLowerCase().includes("abrir craf"), "nao sugere abrir CRAF");
  assert.ok(!html.toLowerCase().includes("emitir craf"), "nao sugere emitir CRAF");
});

/** Trava estatica: UI pura/read-only — sem I/O, rede, criacao, action, form, credencial. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o componente e puro (sem Prisma/rede/criacao/action/form/options/credencial)", () => {
  const code = codeOnly(
    readFileSync("src/components/processes/EmissaoCrafPreparationPreview.tsx", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client|\bprisma\b/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede/URL externa");
  assert.doesNotMatch(code, /\bcreate\(|\bupdate\(|\bupsert\(|\bdelete\(/, "sem escrita");
  assert.doesNotMatch(code, /\baction\b|\bform\b/i, "sem action/form");
  assert.doesNotMatch(code, /\boptions\b|\bplaceholder\b/, "sem options/placeholder");
  assert.doesNotMatch(code, /\bpassword\b|\bsenha\b|\btoken\b|\bcookie\b/i, "sem credencial");
});
