/**
 * Painel de entrada da area logada — testes de RENDER (read-only).
 *
 * Render puro via renderToStaticMarkup (sem JSX no teste: usamos createElement
 * para nao depender do transform). Sem DOM, sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientStartPanel } from "../../../src/components/client/ClientStartPanel";
import {
  OFFICIAL_STEPS_NOTICE,
  ONBOARDING_STEPS,
  TRUST_NOTES,
} from "../../../src/server/support/clientOnboarding";

// tsconfig usa `jsx: preserve` (o runtime automatico e injetado pelo Next). Sob o
// tsx/esbuild o transform e classico e o componente referencia o identificador
// global `React` no momento do render — expomos aqui, so para o teste.
(globalThis as unknown as { React: typeof React }).React = React;

function render(props: { name: string; variant?: "full" | "compact" }): string {
  return renderToStaticMarkup(createElement(ClientStartPanel, props));
}

test("full: mostra saudacao pelo primeiro nome", () => {
  const html = render({ name: "Maria Silva" });
  assert.ok(html.includes("Olá, Maria"));
  assert.ok(html.includes("Boas-vindas"));
});

test("full: renderiza os 4 passos", () => {
  const html = render({ name: "Maria" });
  for (const step of ONBOARDING_STEPS) {
    assert.ok(html.includes(step.title), `passo ausente: ${step.title}`);
  }
});

test("full: renderiza as frases de confianca", () => {
  const html = render({ name: "Maria" });
  for (const nota of TRUST_NOTES) {
    assert.ok(html.includes(nota), `frase ausente: ${nota}`);
  }
});

test("full: mostra o aviso de etapas oficiais fora do site", () => {
  assert.ok(render({ name: "Maria" }).includes(OFFICIAL_STEPS_NOTICE));
});

test("full: aponta para a central de ajuda e para o suporte", () => {
  const html = render({ name: "Maria" });
  assert.ok(html.includes('href="/ajuda"'));
  assert.ok(html.includes('href="/ajuda#suporte"'));
});

test("full: passo sem acao nao vira link vazio", () => {
  const html = render({ name: "Maria" });
  // "Envie os documentos" e orientacao: o envio acontece dentro do pedido.
  const semAcao = ONBOARDING_STEPS.filter((s) => s.href === null);
  assert.ok(semAcao.length > 0, "o cenario precisa existir para o teste valer");
  assert.ok(!html.includes('href=""'), "nenhum href vazio");
  assert.ok(!html.includes("href=\"null\""), "nenhum href nulo");
});

test("compact: mantem aviso oficial e ajuda, sem os passos", () => {
  const html = render({ name: "Maria", variant: "compact" });
  assert.ok(html.includes(OFFICIAL_STEPS_NOTICE));
  assert.ok(html.includes('href="/ajuda"'));
  for (const step of ONBOARDING_STEPS) {
    assert.ok(!html.includes(step.title), `compact nao deve listar: ${step.title}`);
  }
});

test("compact: nao repete a saudacao (o cliente ja usa o produto)", () => {
  const html = render({ name: "Maria", variant: "compact" });
  assert.ok(!html.includes("Olá, Maria"));
});

test("nome vazio nao quebra o render", () => {
  const html = render({ name: "" });
  assert.ok(html.includes("Olá"));
});

test("o nome do usuario e escapado no HTML", () => {
  const html = render({ name: "<script>alert(1)</script>" });
  assert.ok(!html.includes("<script>"), "React deve escapar o nome");
});

/** Trava estatica: painel e so leitura — sem banco, automacao, Fase 9 ou rede. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o painel nao toca Prisma, automacao, Fase 9, pagamento nem rede", () => {
  const code = codeOnly(readFileSync("src/components/client/ClientStartPanel.tsx", "utf8"));
  assert.doesNotMatch(code, /@prisma\/client|getPrisma|Repository/, "sem Prisma");
  assert.doesNotMatch(code, /phase9|PHASE9/i, "sem Fase 9");
  assert.doesNotMatch(code, /automationQueue|submitToAutomationQueue/, "sem fila");
  assert.doesNotMatch(code, /createPixPayment|confirmPixPayment/, "sem pagamento");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
});
