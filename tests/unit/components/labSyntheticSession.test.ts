/**
 * Fase 2 — tela do laboratorio de login e handoff sinteticos: testes de RENDER.
 *
 * Render puro via renderToStaticMarkup (sem JSX no teste: `createElement`, para
 * nao depender do transform). Sem DOM, sem rede, sem banco.
 *
 * O COMPORTAMENTO do fluxo e testado em `labSyntheticFlow.test.ts`; aqui o que
 * importa e o que a tela mostra e — principalmente — o que ela NAO pede nem
 * expoe.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LabSyntheticSession } from "../../../src/app/(admin)/admin/lab/sessao-sintetica/LabSyntheticSession";
import {
  LAB_SYNTHETIC_NOTICE,
  applyLabAction,
  initialLabFlowState,
} from "../../../src/server/automation/synthetic/labSyntheticFlow";
import { SYNTHETIC_FAILURE_KINDS } from "../../../src/server/automation/synthetic/sessionLifecycle";

const SOURCE_PATH = "src/app/(admin)/admin/lab/sessao-sintetica/LabSyntheticSession.tsx";
const PAGE_PATH = "src/app/(admin)/admin/lab/sessao-sintetica/page.tsx";

// tsconfig usa `jsx: preserve` (o runtime automatico e injetado pelo Next). Sob
// o tsx/esbuild o transform e classico e o componente referencia o identificador
// global `React` no render — expomos aqui, so para o teste.
(globalThis as unknown as { React: typeof React }).React = React;

function render(): string {
  return renderToStaticMarkup(createElement(LabSyntheticSession));
}

// ------------------------------------------------------------------ aviso

test("mostra o aviso de ambiente sintético", () => {
  const html = render();

  assert.ok(html.includes("Ambiente sintético"));
  assert.ok(html.includes('data-testid="lab-synthetic-notice"'));
  assert.ok(html.includes("Gov.br"), "o aviso precisa negar os portais oficiais");
  assert.ok(html.includes("SINARM"));
});

test("diz explicitamente que não pede dado de acesso", () => {
  const html = render();

  assert.ok(html.includes("sem CPF"));
  assert.ok(html.includes("sem senha"));
});

// ------------------------------------------------- ausencia de credenciais

test("não renderiza nenhum campo de CPF, senha ou credencial", () => {
  const html = render().toLowerCase();

  for (const proibido of [
    'type="password"',
    'name="cpf"',
    'name="senha"',
    'name="password"',
    'name="token"',
    'name="otp"',
    'autocomplete="current-password"',
  ]) {
    assert.equal(html.includes(proibido), false, `a tela não pode ter ${proibido}`);
  }
});

test("o único input é o seletor de falha sintética", () => {
  const html = render();

  assert.equal(html.includes("<input"), false, "nenhum campo de texto");
  assert.ok(html.includes('data-testid="lab-failure-select"'));
});

test("o seletor lista as 10 falhas sintéticas do contrato", () => {
  const html = render();

  for (const kind of SYNTHETIC_FAILURE_KINDS) {
    assert.ok(html.includes(kind), `falha ausente: ${kind}`);
  }
});

// ---------------------------------------------------------- estado inicial

test("abre sem sessão e sem eventos", () => {
  const html = render();

  assert.ok(html.includes('data-testid="lab-session-empty"'));
  assert.ok(html.includes('data-testid="lab-events-empty"'));
  assert.ok(html.includes('data-testid="lab-violations-empty"'));
});

test("oferece os botões do fluxo de login e handoff", () => {
  const html = render();

  for (const testId of [
    "lab-action-login",
    "lab-action-handoff",
    "lab-action-confirm-handoff",
    "lab-action-next-step",
    "lab-action-complete",
    "lab-action-expire",
    "lab-action-fail",
    "lab-action-reset",
  ]) {
    assert.ok(html.includes(`data-testid="${testId}"`), `botão ausente: ${testId}`);
  }
});

test("os rótulos nomeiam login e handoff em linguagem de laboratório", () => {
  const html = render();

  assert.ok(html.includes("Simular login sintético"));
  assert.ok(html.includes("Gerar handoff sintético"));
  assert.ok(html.includes("Confirmar recebimento do handoff"));
  assert.ok(html.includes("Reiniciar laboratório"));
});

// ------------------------------------------------------- handle nunca sai

test("o sessionHandle não aparece no HTML, nem depois do fluxo inteiro", () => {
  // O render inicial não tem sessão; o fluxo é exercitado pelo módulo puro, e o
  // que a tela poderia exibir é exatamente o `labSessionView`.
  const state = [
    { kind: "login" } as const,
    { kind: "handoff" } as const,
    { kind: "confirm-handoff" } as const,
  ].reduce(applyLabAction, initialLabFlowState());

  const exibivel = JSON.stringify(state.events);
  assert.equal(exibivel.includes("sh_lab"), false);
  assert.equal(render().includes("sh_lab"), false);
});

// ------------------------------------------------------- provas estruturais

function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("o componente não replica a máquina de estados", () => {
  const code = sourceCode();

  // Nome de evento, estado ou transição escrito à mão no componente seria a
  // segunda fonte de verdade que o PR existe para evitar.
  for (const forbidden of [
    "synthetic_session_",
    "CLAIMED",
    "IN_PROGRESS",
    "COMPLETED",
    "SYNTHETIC_TRANSITIONS",
    "canTransition",
  ]) {
    assert.equal(code.includes(forbidden), false, `o componente não pode conter ${forbidden}`);
  }
});

test("o componente não faz rede, não persiste e não usa storage", () => {
  const code = sourceCode();

  for (const forbidden of [
    "fetch(",
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "use server",
    "@prisma/client",
    "phase9",
    "gov.br",
    "servicos.pf",
    "http://",
    "https://",
  ]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

test("o componente delega o fluxo ao módulo puro", () => {
  const code = sourceCode();

  assert.ok(code.includes("applyLabAction"));
  assert.ok(code.includes("labSessionView"));
  assert.ok(code.includes("useState"));
});

test("a rota é interna e protegida por perfil", () => {
  const page = readFileSync(PAGE_PATH, "utf8");

  assert.ok(page.includes("requireAdminRole"));
  assert.ok(page.includes('"ADMIN", "OPERADOR"'));
});

test("o aviso exportado é o mesmo que a tela renderiza", () => {
  assert.ok(render().includes(LAB_SYNTHETIC_NOTICE.slice(0, 40)));
});
