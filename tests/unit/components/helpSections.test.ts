/**
 * Secoes da central de ajuda — testes de RENDER (read-only).
 *
 * Render puro via renderToStaticMarkup (sem JSX no teste: usamos createElement
 * para nao depender do transform). Sem DOM, sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AjudaPage from "../../../src/app/(public)/ajuda/page";
import { ClientStatusGuideSection } from "../../../src/components/help/ClientStatusGuideSection";
import { HelpTopicsSection } from "../../../src/components/help/HelpTopicsSection";
import { SupportChannelSection } from "../../../src/components/help/SupportChannelSection";
import { TutorialVideosSection } from "../../../src/components/help/TutorialVideosSection";
import { CLIENT_STATUS_GUIDE } from "../../../src/server/support/clientStatusGuide";
import { HELP_TOPICS } from "../../../src/server/support/helpTopics";
import { TUTORIAL_VIDEOS } from "../../../src/server/support/tutorialVideos";

// tsconfig usa `jsx: preserve` (o runtime automatico e injetado pelo Next). Sob o
// tsx/esbuild o transform e classico e o componente referencia o identificador
// global `React` no momento do render — expomos aqui, so para o teste.
(globalThis as unknown as { React: typeof React }).React = React;

/**
 * Atributo real do botao desabilitado. Procurar so por "disabled" daria falso
 * positivo: as classes do Button trazem `disabled:opacity-50` sempre.
 */
const BOTAO_DESABILITADO = 'disabled=""';

/** Render isolando a env, para o teste nao depender da maquina. */
function renderWithEnv(component: () => unknown, url: string | undefined): string {
  const anterior = process.env.SUPPORT_WHATSAPP_URL;
  if (url === undefined) delete process.env.SUPPORT_WHATSAPP_URL;
  else process.env.SUPPORT_WHATSAPP_URL = url;
  try {
    return renderToStaticMarkup(createElement(component as never));
  } finally {
    if (anterior === undefined) delete process.env.SUPPORT_WHATSAPP_URL;
    else process.env.SUPPORT_WHATSAPP_URL = anterior;
  }
}

test("topicos: renderiza as 6 perguntas com ancora propria", () => {
  const html = renderToStaticMarkup(createElement(HelpTopicsSection));
  for (const topic of HELP_TOPICS) {
    assert.ok(html.includes(`id="${topic.id}"`), `ancora ausente: ${topic.id}`);
    assert.ok(html.includes(topic.question), `pergunta ausente: ${topic.question}`);
  }
});

test("status: renderiza os 12 rotulos do guia", () => {
  const html = renderToStaticMarkup(createElement(ClientStatusGuideSection));
  for (const status of CLIENT_STATUS_GUIDE) {
    assert.ok(html.includes(status.label), `status ausente: ${status.label}`);
  }
  assert.ok(html.includes("Guia informativo"));
});

test("videos: cada card tem titulo e o botao 'Assistir tutorial'", () => {
  const html = renderToStaticMarkup(createElement(TutorialVideosSection));
  for (const video of TUTORIAL_VIDEOS) {
    assert.ok(html.includes(video.title), `video ausente: ${video.title}`);
  }
  const botoes = html.split("Assistir tutorial").length - 1;
  assert.equal(botoes, TUTORIAL_VIDEOS.length);
});

test("videos: sem link publicado, botao desabilitado e marcado 'Em breve'", () => {
  const html = renderToStaticMarkup(createElement(TutorialVideosSection));
  assert.ok(html.includes("Em breve"));
  assert.ok(html.includes(BOTAO_DESABILITADO), "botao deve estar desabilitado");
  assert.ok(!html.includes("<a href="), "nao renderiza link enquanto nao ha video");
});

test("videos: mostra o aviso de que nao e material oficial", () => {
  const html = renderToStaticMarkup(createElement(TutorialVideosSection));
  assert.ok(html.includes("Não são material oficial de nenhum órgão público."));
});

test("suporte: sem env, botao desabilitado e explica que o canal nao esta configurado", () => {
  const html = renderWithEnv(SupportChannelSection, undefined);
  assert.ok(html.includes("Falar com suporte"));
  assert.ok(html.includes(BOTAO_DESABILITADO));
  assert.ok(html.includes("ainda não está configurado"));
  assert.ok(!html.includes("wa.me"), "nenhum link vaza sem env");
});

test("suporte: com env valida, renderiza link externo seguro", () => {
  const html = renderWithEnv(SupportChannelSection, "https://wa.me/5500000000000");
  assert.ok(html.includes('href="https://wa.me/5500000000000"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(!html.includes(BOTAO_DESABILITADO));
});

test("suporte: env invalida NAO vira link — degrada para desabilitado", () => {
  const html = renderWithEnv(SupportChannelSection, "https://exemplo.com/suporte");
  assert.ok(!html.includes("exemplo.com"), "URL recusada nao pode aparecer no HTML");
  assert.ok(html.includes(BOTAO_DESABILITADO));
  assert.ok(html.includes("endereço inválido"));
});

test("suporte: sempre avisa que nunca pedimos credencial do Gov.br", () => {
  const html = renderWithEnv(SupportChannelSection, undefined);
  assert.ok(html.includes("nunca pede senha, código ou token do Gov.br"));
});

// ------------------------------------------------- pagina /ajuda montada
//
// As secoes acima sao testadas ISOLADAS, e foi por isso que um `id` duplicado
// entre duas delas passou despercebido. Estes testes montam a pagina inteira.

/** Todos os `id="..."` do HTML, na ordem em que aparecem. */
function idsOf(html: string): string[] {
  return [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
}

/** Todas as ancoras `href="#..."` do HTML. */
function anchorsOf(html: string): string[] {
  return [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
}

test("/ajuda nao tem id duplicado", () => {
  const ids = idsOf(renderWithEnv(AjudaPage, undefined));
  const duplicados = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicados, [], `ids duplicados na pagina: ${duplicados.join(", ")}`);
});

test("/ajuda: toda ancora do indice aponta para um id existente", () => {
  const html = renderWithEnv(AjudaPage, undefined);
  const ids = new Set(idsOf(html));
  for (const anchor of anchorsOf(html)) {
    assert.ok(ids.has(anchor), `ancora sem destino: #${anchor}`);
  }
});

test("/ajuda: o atalho #suporte leva ao BLOCO de suporte, nao ao card de FAQ", () => {
  const html = renderWithEnv(AjudaPage, undefined);
  const posSuporte = html.indexOf('id="suporte"');
  const posFaq = html.indexOf('id="suporte-faq"');

  assert.ok(posSuporte >= 0, "bloco de suporte deve manter id=suporte");
  assert.ok(posFaq >= 0, "card de FAQ deve usar id=suporte-faq");
  assert.ok(posFaq < posSuporte, "o card de FAQ vem antes; ids nao podem colidir");
  assert.ok(
    html.slice(posSuporte).includes("Falar com suporte"),
    "o destino de #suporte deve conter o botao de suporte",
  );
});

/** Trava estatica: as secoes sao so leitura — sem banco, sem automacao, sem Fase 9. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const HELP_COMPONENTS = [
  "src/components/help/HelpTopicsSection.tsx",
  "src/components/help/ClientStatusGuideSection.tsx",
  "src/components/help/TutorialVideosSection.tsx",
  "src/components/help/SupportChannelSection.tsx",
  "src/app/(public)/ajuda/page.tsx",
];

test("as telas de ajuda nao tocam Prisma, automacao, Fase 9 nem pagamento", () => {
  for (const path of HELP_COMPONENTS) {
    const code = codeOnly(readFileSync(path, "utf8"));
    assert.doesNotMatch(code, /@prisma\/client|getPrisma/, `${path}: sem Prisma`);
    assert.doesNotMatch(code, /phase9|PHASE9/i, `${path}: sem Fase 9`);
    assert.doesNotMatch(code, /automationQueue|submitToAutomationQueue/, `${path}: sem fila`);
    assert.doesNotMatch(code, /createPixPayment|confirmPixPayment/, `${path}: sem pagamento`);
    assert.doesNotMatch(code, /\bfetch\(/, `${path}: sem rede`);
  }
});
