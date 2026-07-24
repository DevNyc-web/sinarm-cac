/**
 * Resumo auxiliar de requisitos (read-only) — testes de RENDER do componente.
 *
 * Render puro via renderToStaticMarkup (sem JSX no teste: usamos createElement
 * para nao depender do transform). Sem DOM, sem rede, sem banco. Nao executa o
 * checklist real nem toca o gate de envio — so verifica o que a tela apresenta.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProcessRequirementsSummary } from "../../../src/components/processes/ProcessRequirementsSummary";

// tsconfig usa `jsx: preserve` (o runtime automatico e injetado pelo Next). Sob o
// tsx/esbuild o transform e classico e o componente referencia o identificador
// global `React` no momento do render — expomos aqui, so para o teste.
(globalThis as unknown as { React: typeof React }).React = React;

const FUTURE_PERSISTED = ["CONCESSAO_CR", "AUTORIZACAO_COMPRA", "EMISSAO_CRAF"] as const;

const SECURITY_TEXT =
  "Este resumo não altera o checklist de automação e não executa nenhuma ação.";
const EMPTY_TEXT = "Nenhum requisito ativo para este processo nesta etapa.";

const GUIA_LABELS = [
  "Documento de identificação pessoal",
  "CR / registro CAC",
  "Comprovante de origem/endereço",
  "Declaração de destino/evento",
  "Documentos complementares",
];

function render(processTypeCode: string): string {
  return renderToStaticMarkup(createElement(ProcessRequirementsSummary, { processTypeCode }));
}

test("Guia (GUIA_TRAFEGO_PF_CAC) renderiza os 5 requisitos ativos do MVP", () => {
  const html = render("GUIA_TRAFEGO_PF_CAC");
  for (const label of GUIA_LABELS) {
    assert.ok(html.includes(label), `esperado requisito: ${label}`);
  }
});

test("Guia nao renderiza requisitos de etapa futura (nenhum vaza)", () => {
  const html = render("GUIA_TRAFEGO_PF_CAC");
  // Rotulos exclusivos de CR/Autorizacao/CRAF nao podem aparecer na Guia.
  assert.ok(!html.includes("Nota fiscal de aquisição"));
  assert.ok(!html.includes("Identificação do PCE pretendido"));
  assert.ok(!html.includes(EMPTY_TEXT), "Guia tem requisitos ativos, nao estado vazio");
});

test("CR/Autorizacao/CRAF renderizam o estado vazio (nada ativo nesta etapa)", () => {
  for (const code of FUTURE_PERSISTED) {
    const html = render(code);
    assert.ok(html.includes(EMPTY_TEXT), `${code} deve mostrar estado vazio`);
    for (const label of GUIA_LABELS) {
      assert.ok(!html.includes(label), `${code} nao deve listar requisito da Guia: ${label}`);
    }
  }
});

test("codigo desconhecido cai no fallback temporario e mostra requisitos da Guia", () => {
  const html = render("CODIGO_INEXISTENTE");
  for (const label of GUIA_LABELS) {
    assert.ok(html.includes(label), `fallback Guia: ${label}`);
  }
  assert.ok(!html.includes(EMPTY_TEXT));
});

test("mostra sempre o texto de seguranca", () => {
  assert.ok(render("GUIA_TRAFEGO_PF_CAC").includes(SECURITY_TEXT));
  assert.ok(render("CONCESSAO_CR").includes(SECURITY_TEXT));
});

test("marca Obrigatório para o requisito exigido e Opcional para os demais", () => {
  const html = render("GUIA_TRAFEGO_PF_CAC");
  assert.ok(html.includes("Obrigatório"), "identificacao pessoal e obrigatoria");
  assert.ok(html.includes("Opcional"), "os demais requisitos ativos sao opcionais");
});

/** Trava estatica: componente e so leitura/preparacao, sem executar o checklist real. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o componente NAO executa o checklist real nem o gate de envio", () => {
  const code = codeOnly(
    readFileSync("src/components/processes/ProcessRequirementsSummary.tsx", "utf8"),
  );
  assert.doesNotMatch(code, /deriveAutomationReadiness\s*\(/, "nao roda o checklist real");
  assert.doesNotMatch(code, /submitToAutomationQueue|getProcessReadinessState/, "nao toca o gate");
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede/URL externa");
});
