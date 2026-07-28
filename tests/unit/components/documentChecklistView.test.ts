/**
 * Checklist de documentos fora do pedido — testes de RENDER (read-only).
 *
 * Render puro via renderToStaticMarkup (sem JSX no teste: usamos createElement
 * para nao depender do transform). Sem DOM, sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentChecklistView } from "../../../src/components/documents/DocumentChecklistView";
import {
  DOCUMENT_STATE_LABELS,
  PERSISTED_DOCUMENT_STATES,
} from "../../../src/server/documents/documentStatus";
import {
  REQUIREMENT_TIER_LABELS,
  guiaTrafegoRequirements,
} from "../../../src/server/documents/documentRequirements";
import {
  CHECKLIST_INTRO,
  CHECKLIST_SECURITY_NOTES,
  CHECKLIST_TITLE,
  CHECKLIST_UPLOAD_NOTICE,
} from "../../../src/server/support/documentChecklistNotices";

// tsconfig usa `jsx: preserve` (o runtime automatico e injetado pelo Next). Sob o
// tsx/esbuild o transform e classico e o componente referencia o identificador
// global `React` no momento do render — expomos aqui, so para o teste.
(globalThis as unknown as { React: typeof React }).React = React;

function render(): string {
  return renderToStaticMarkup(createElement(DocumentChecklistView));
}

const CHECKLIST_SOURCE = "src/components/documents/DocumentChecklistView.tsx";

test("renderiza titulo e chamada da tela", () => {
  const html = render();
  assert.ok(html.includes(CHECKLIST_TITLE));
  assert.ok(html.includes("solicitação adicional"));
});

test("lista TODOS os documentos vindos de guiaTrafegoRequirements", () => {
  const html = render();
  const requirements = guiaTrafegoRequirements();
  assert.ok(requirements.length > 0, "o cenario precisa existir para o teste valer");
  for (const req of requirements) {
    assert.ok(html.includes(req.title), `documento ausente: ${req.title}`);
    assert.ok(html.includes(req.help), `ajuda ausente: ${req.title}`);
  }
});

test("mostra o grau de exigencia de cada item (sem inventar rotulo)", () => {
  const html = render();
  for (const req of guiaTrafegoRequirements()) {
    assert.ok(
      html.includes(REQUIREMENT_TIER_LABELS[req.tier]),
      `tier ausente: ${REQUIREMENT_TIER_LABELS[req.tier]}`,
    );
  }
});

test("a legenda usa os estados persistidos do dominio", () => {
  const html = render();
  for (const state of PERSISTED_DOCUMENT_STATES) {
    assert.ok(html.includes(DOCUMENT_STATE_LABELS[state]), `estado ausente: ${state}`);
  }
});

test("mostra todos os avisos de seguranca", () => {
  const html = render();
  for (const note of CHECKLIST_SECURITY_NOTES) {
    assert.ok(html.includes(note), `aviso ausente: ${note}`);
  }
});

test("explica que o envio acontece dentro do pedido", () => {
  const html = render();
  assert.ok(html.includes(CHECKLIST_UPLOAD_NOTICE));
  assert.ok(html.includes('href="/processos/novo"'));
});

test("aponta para a central de ajuda", () => {
  assert.ok(render().includes('href="/ajuda"'));
});

test("e SOMENTE LEITURA — sem formulario, input de arquivo ou botao de envio", () => {
  const html = render();
  assert.ok(!html.includes("<form"), "a tela nao pode ter formulario");
  assert.ok(!html.includes("<input"), "a tela nao pode ter input");
  assert.ok(!html.includes('type="file"'), "a tela nao pode receber arquivo");
});

test("NAO cria fonte paralela: os titulos nao estao escritos no componente", () => {
  const source = readFileSync(CHECKLIST_SOURCE, "utf8");
  assert.ok(source.includes("guiaTrafegoRequirements()"), "deve consumir a fonte existente");
  for (const req of guiaTrafegoRequirements()) {
    assert.ok(!source.includes(req.title), `titulo chumbado no componente: ${req.title}`);
  }
});

test("o conteudo NAO promete automacao, aprovacao, deferimento nem prazo", () => {
  const html = render();
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
    assert.ok(!html.includes(termo), `texto proibido encontrado: "${termo}"`);
  }
});

/** Trava estatica: tela de leitura — sem banco, storage, upload, Fase 9 ou rede. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("a tela nao toca Prisma, storage, upload, review, pagamento, Fase 9 nem rede", () => {
  const code = codeOnly(readFileSync(CHECKLIST_SOURCE, "utf8"));
  assert.doesNotMatch(code, /@prisma\/client|getPrisma|Repository/, "sem Prisma");
  assert.doesNotMatch(code, /getStorageAdapter|storage-local/, "sem storage");
  assert.doesNotMatch(code, /uploadProcessDocument|reviewProcessDocument/, "sem upload/review");
  assert.doesNotMatch(code, /createPixPayment|confirmPixPayment/, "sem pagamento");
  assert.doesNotMatch(code, /phase9|PHASE9/i, "sem Fase 9");
  assert.doesNotMatch(code, /automationQueue|submitToAutomationQueue/, "sem automacao");
  assert.doesNotMatch(code, /gov\.?br|sinarm/i, "sem integracao Gov.br/SINARM no codigo");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
});

test("o dashboard aponta para /dashboard/documentos", () => {
  const dashboard = readFileSync("src/app/(user)/dashboard/page.tsx", "utf8");
  assert.ok(dashboard.includes('href="/dashboard/documentos"'), "falta o link no dashboard");
  assert.ok(dashboard.includes("Ver checklist"), "falta a acao do card");
});

test("o card de documentos nao empurra a lista de quem ja tem pedidos", () => {
  const dashboard = readFileSync("src/app/(user)/dashboard/page.tsx", "utf8");
  // Mesmo criterio do ClientStartPanel: orientacao antes da lista so para quem
  // esta comecando. Render incondicional acima da lista seria regressao.
  assert.ok(
    dashboard.includes("semPedidos ? documentosCard : null"),
    "quem nao tem pedido deve ver o card antes da lista",
  );
  assert.ok(
    dashboard.includes("semPedidos ? null : documentosCard"),
    "quem ja tem pedido deve ver o card depois da lista",
  );
  const declaracao = dashboard.indexOf("const documentosCard");
  const lista = dashboard.indexOf("processes.map(");
  const depoisDaLista = dashboard.indexOf("semPedidos ? null : documentosCard");
  assert.ok(declaracao !== -1, "o card deve ser declarado uma vez");
  assert.ok(lista !== -1 && depoisDaLista > lista, "o segundo render fica abaixo da lista");
});

test("a rota /dashboard/documentos exige usuario logado e nao consulta o banco", () => {
  const page = codeOnly(readFileSync("src/app/(user)/dashboard/documentos/page.tsx", "utf8"));
  assert.match(page, /requireUser\(\)/, "a rota precisa exigir sessao");
  assert.doesNotMatch(page, /Repository|getPrisma/, "a rota nao deve consultar o banco");
});
