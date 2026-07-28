/**
 * Jornada inicial do cliente — conteudo e travas de conformidade.
 *
 * Como em `helpContent.test.ts`, o valor destes testes e impedir regressao de
 * TEXTO: promessa de automacao, aprovacao, deferimento ou prazo (docs/24 §14).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  getOnboardingStep,
  greetingFor,
  OFFICIAL_STEPS_NOTICE,
  ONBOARDING_STEPS,
  TRUST_NOTES,
  WELCOME_TITLE,
} from "../../../src/server/support/clientOnboarding";

/** Todo o texto de UI do modulo, para varredura. */
function allText(): string {
  return [
    ...ONBOARDING_STEPS.flatMap((s) => [s.title, s.body, s.action ?? ""]),
    ...TRUST_NOTES,
    OFFICIAL_STEPS_NOTICE,
    WELCOME_TITLE,
  ]
    .join("\n")
    .toLowerCase();
}

test("os 4 passos existem, com id unico e texto preenchido", () => {
  assert.equal(ONBOARDING_STEPS.length, 4);
  const ids = ONBOARDING_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "ids devem ser unicos");
  for (const step of ONBOARDING_STEPS) {
    assert.ok(step.title.trim().length > 0, `${step.id}: titulo vazio`);
    assert.ok(step.body.trim().length > 0, `${step.id}: corpo vazio`);
  }
});

test("passo desconhecido retorna undefined", () => {
  assert.equal(getOnboardingStep("nao-existe"), undefined);
});

test("href e action andam juntos — nunca link sem rotulo nem rotulo sem link", () => {
  for (const step of ONBOARDING_STEPS) {
    assert.equal(
      step.href === null,
      step.action === null,
      `${step.id}: href e action precisam ser ambos nulos ou ambos preenchidos`,
    );
  }
});

test("todo href e rota INTERNA — nada de link externo na area logada", () => {
  for (const step of ONBOARDING_STEPS) {
    if (step.href === null) continue;
    assert.ok(step.href.startsWith("/"), `${step.id}: href deve ser interno`);
    assert.doesNotMatch(step.href, /^https?:/, `${step.id}: sem URL absoluta`);
  }
});

test("as 5 frases de confianca estao presentes", () => {
  const esperadas = [
    "Sua conta permite acompanhar seus pedidos em um só lugar.",
    "Não somos órgão público.",
    "Não pedimos senha Gov.br.",
    "Quando uma etapa oficial exigir Gov.br, você acessará o ambiente oficial.",
    "O acompanhamento no nosso painel mostra o status operacional do atendimento.",
  ];
  for (const frase of esperadas) {
    assert.ok(TRUST_NOTES.includes(frase), `frase ausente: ${frase}`);
  }
});

test("o aviso de etapas oficiais diz que elas ocorrem FORA deste site", () => {
  assert.match(OFFICIAL_STEPS_NOTICE.toLowerCase(), /fora deste site/);
});

test("a saudacao usa o primeiro nome e nao flexiona genero", () => {
  assert.equal(greetingFor("Maria Silva Souza"), "Olá, Maria");
  assert.equal(greetingFor("  João  "), "Olá, João");
  assert.equal(greetingFor(""), "Olá");
  assert.equal(greetingFor("   "), "Olá");
  // "Bem-vindo"/"Bem-vinda" erraria com metade das pessoas.
  assert.doesNotMatch(greetingFor("Alex"), /bem-vind[oa]/i);
  assert.doesNotMatch(WELCOME_TITLE, /bem-vind[oa]/i);
});

test("o conteudo NAO promete automacao, aprovacao, deferimento nem prazo", () => {
  const texto = allText();
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

test("o conteudo nao se apresenta como orgao publico", () => {
  const texto = allText();
  for (const termo of ["canal oficial", "somos o órgão", "em nome da polícia"]) {
    assert.ok(!texto.includes(termo), `texto proibido: "${termo}"`);
  }
});

/** Trava estatica: conteudo puro, sem banco/rede/automacao. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("clientOnboarding e modulo puro", () => {
  const code = codeOnly(readFileSync("src/server/support/clientOnboarding.ts", "utf8"));
  assert.doesNotMatch(code, /@prisma\/client|getPrisma/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
  assert.doesNotMatch(code, /process\.env/, "sem env");
  assert.doesNotMatch(code, /phase9|PHASE9|automationQueue/i, "sem automacao/Fase 9");
});
