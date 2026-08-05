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
import {
  CLIENT_PROCESS_LABELS,
  CLIENT_START_QUESTION,
  clientProcessChoices,
} from "../../../src/server/support/clientProcessChoices";
import { isProcessAvailable } from "../../../src/server/processes/processAvailability";

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

/* -------------------------------------------------------------------------
   Escolha de processo do cliente novo (docs/63 / docs/61 bloco B).
   ------------------------------------------------------------------------- */

test("full: a pergunta e o titulo da tela do cliente novo", () => {
  const html = render({ name: "Maria" });
  assert.ok(html.includes(CLIENT_START_QUESTION), "pergunta ausente");
  // Titulo da PAGINA, nao um subtitulo qualquer: quem chega sem processo abre aqui.
  assert.match(html, /<h1[^>]*>Qual processo você deseja realizar\?<\/h1>/);
});

test("full: mostra os nomes amigaveis, nao os codigos tecnicos", () => {
  const html = render({ name: "Maria" });
  for (const { label } of Object.values(CLIENT_PROCESS_LABELS)) {
    assert.ok(html.includes(label), `nome amigavel ausente: ${label}`);
  }
  for (const code of Object.keys(CLIENT_PROCESS_LABELS)) {
    assert.ok(!html.includes(code), `codigo tecnico vazou na tela: ${code}`);
  }
  assert.ok(!html.includes("GUIA_TRAFEGO_PF_CAC"), "codigo persistido vazou na tela");
});

test("full: so o processo criavel tem CTA de criacao", () => {
  const html = render({ name: "Maria" });
  const disponiveis = clientProcessChoices().filter((c) => c.available);
  assert.ok(disponiveis.length > 0, "o cenario precisa de ao menos um processo criavel");

  const links = html.match(/href="\/processos\/novo"/g) ?? [];
  assert.equal(
    links.length,
    disponiveis.length,
    "numero de CTAs precisa bater com o de processos criaveis",
  );
});

test("full: processo em preparacao aparece sem CTA falso", () => {
  const html = render({ name: "Maria" });
  const emPreparacao = clientProcessChoices().filter((c) => !c.available);
  assert.ok(emPreparacao.length > 0, "o cenario precisa de ao menos um em preparacao");

  for (const choice of emPreparacao) {
    assert.ok(html.includes(choice.label), `label ausente: ${choice.label}`);
    assert.equal(choice.href, null, `${choice.code} nao pode ter rota`);
    assert.equal(choice.cta, null, `${choice.code} nao pode ter CTA`);
    assert.ok(html.includes(choice.note ?? ""), `aviso de preparacao ausente: ${choice.code}`);
  }
});

test("full: 'Meus processos' nao e o foco de quem nao tem processo", () => {
  const html = render({ name: "Maria" });
  assert.ok(!html.includes("Meus processos"), "a lista vazia nao pode liderar a tela");
});

test("full: a ajuda e visivel e comeca pelos videos", () => {
  const html = render({ name: "Maria" });
  assert.ok(html.includes('href="/ajuda#videos"'), "link de videos ausente");
  assert.ok(
    html.indexOf('href="/ajuda#videos"') < html.indexOf('href="/ajuda#suporte"'),
    "video vem antes do suporte — ajuda nao e fila de atendimento",
  );
});

test("compact: quem ja tem processo nao recebe a pergunta de novo", () => {
  const html = render({ name: "Maria", variant: "compact" });
  assert.ok(!html.includes(CLIENT_START_QUESTION));
  for (const { label } of Object.values(CLIENT_PROCESS_LABELS)) {
    assert.ok(!html.includes(label), `compact nao deve listar processo: ${label}`);
  }
});

test("as opcoes derivam da regra de disponibilidade, sem lista propria", () => {
  const choices = clientProcessChoices();
  assert.equal(choices.length, Object.keys(CLIENT_PROCESS_LABELS).length);
  for (const choice of choices) {
    assert.equal(choice.available, isProcessAvailable(choice.code), choice.code);
    // href e cta andam juntos: sem rota nao existe botao (docs/63 §6.2).
    assert.equal(choice.href === null, choice.cta === null, choice.code);
    assert.equal(choice.available, choice.href !== null, choice.code);
  }
});

test("o que da para fazer agora vem primeiro", () => {
  const disponiveis = clientProcessChoices().map((c) => c.available);
  assert.deepEqual(disponiveis, [...disponiveis].sort((a, b) => Number(b) - Number(a)));
});

test("as opcoes NAO prometem automacao, aprovacao, deferimento nem prazo", () => {
  const texto = clientProcessChoices()
    .flatMap((c) => [c.label, c.blurb, c.note ?? "", c.cta ?? ""])
    .join("\n")
    .toLowerCase();
  const proibidos = [
    "automaticamente",
    "garantimos",
    "será aprovado",
    "será deferido",
    "aprovação garantida",
    "em até",
    "prazo de",
    "resolvemos tudo",
    "cuidamos de tudo",
  ];
  for (const termo of proibidos) {
    assert.ok(!texto.includes(termo), `texto proibido encontrado: "${termo}"`);
  }
});

/* -------------------------------------------------------------------------
   Dashboard — travas de FONTE (a pagina exige auth+banco, nao renderiza aqui).
   ------------------------------------------------------------------------- */

const DASHBOARD = "src/app/(user)/dashboard/page.tsx";

test("dashboard: quem tem processo continua com 'Meus processos' e o botao de novo", () => {
  const src = readFileSync(DASHBOARD, "utf8");
  assert.match(src, /<h1[^>]*>Meus processos<\/h1>/, "titulo da lista removido");
  assert.ok(src.includes("Nova solicitação"), "botao de novo processo removido");
  assert.ok(src.includes("clientVisibleStatusLabel"), "status simples removido da lista");
  assert.ok(src.includes("process.code"), "numero interno removido da lista");
});

test("dashboard: a lista vazia nao manda usar um botao que o ramo esconde", () => {
  const src = readFileSync(DASHBOARD, "utf8");
  assert.ok(
    !src.includes("Comece criando uma Guia de Tráfego em"),
    "copy da lista vazia aponta para um botao que so existe no outro ramo",
  );
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
