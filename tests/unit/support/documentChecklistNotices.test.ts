/**
 * Microcopy da tela de checklist de documentos — testes de CONTEUDO.
 *
 * Garante que a tela avisa sobre golpe (senha/token Gov.br), nao promete
 * resultado e NAO cria uma segunda lista de documentos. Modulo puro: sem DOM,
 * sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CHECKLIST_INTRO,
  CHECKLIST_SECURITY_NOTES,
  CHECKLIST_STATE_LEGEND_INTRO,
  CHECKLIST_TITLE,
  CHECKLIST_UPLOAD_NOTICE,
} from "../../../src/server/support/documentChecklistNotices";
import { OFFICIAL_STEPS_NOTICE } from "../../../src/server/support/clientOnboarding";
import { guiaTrafegoRequirements } from "../../../src/server/documents/documentRequirements";

function allText(): string {
  return [
    CHECKLIST_TITLE,
    CHECKLIST_INTRO,
    CHECKLIST_UPLOAD_NOTICE,
    CHECKLIST_STATE_LEGEND_INTRO,
    ...CHECKLIST_SECURITY_NOTES,
  ].join(" ");
}

test("avisa para nao enviar senha Gov.br", () => {
  assert.ok(CHECKLIST_SECURITY_NOTES.includes("Não envie senha Gov.br."));
});

test("avisa que nunca pedimos codigo, token ou senha Gov.br", () => {
  assert.ok(
    CHECKLIST_SECURITY_NOTES.includes(
      "Nunca pediremos código, token ou senha Gov.br dentro deste site.",
    ),
  );
});

test("deixa claro que a decisao e do orgao competente", () => {
  assert.ok(CHECKLIST_SECURITY_NOTES.includes("A análise e a decisão são do órgão competente."));
});

test("enquadra o checklist como operacional, sem garantir aprovacao", () => {
  assert.ok(
    CHECKLIST_SECURITY_NOTES.includes(
      "Este checklist organiza o atendimento e não garante aprovação.",
    ),
  );
});

test("REUSA o aviso de etapas oficiais em vez de reescreve-lo", () => {
  assert.ok(
    CHECKLIST_SECURITY_NOTES.includes(OFFICIAL_STEPS_NOTICE),
    "o aviso deve ser o mesmo objeto de texto do onboarding",
  );
});

test("a introducao nao afirma lista oficial nem exaustiva", () => {
  const texto = CHECKLIST_INTRO.toLowerCase();
  assert.ok(texto.includes("normalmente"), "precisa relativizar a lista");
  assert.ok(!texto.includes("oficial"), "nao pode se dizer lista oficial");
  assert.ok(!texto.includes("todos os documentos"), "nao pode se dizer exaustiva");
});

test("avisa que pode haver solicitacao adicional", () => {
  assert.ok(CHECKLIST_INTRO.includes("solicitação adicional"));
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

test("o conteudo NAO pede credencial ao cliente", () => {
  // As frases citam senha/token para NEGAR o pedido — o que nao pode existir e
  // uma formulacao imperativa pedindo a credencial.
  const texto = allText().toLowerCase();
  for (const pedido of ["informe sua senha", "digite o código", "envie seu token", "informe o token"]) {
    assert.ok(!texto.includes(pedido), `pedido de credencial encontrado: "${pedido}"`);
  }
});

test("o modulo NAO redefine a lista de documentos", () => {
  const source = readFileSync("src/server/support/documentChecklistNotices.ts", "utf8");
  // A fonte da lista e documentRequirements; aqui so pode haver microcopy.
  for (const titulo of guiaTrafegoRequirements().map((req) => req.title)) {
    assert.ok(!source.includes(titulo), `titulo de documento duplicado na microcopy: ${titulo}`);
  }
});

test("o modulo e puro — sem Prisma, storage, upload ou rede", () => {
  const source = readFileSync("src/server/support/documentChecklistNotices.ts", "utf8");
  assert.doesNotMatch(source, /@prisma\/client|getPrisma|Repository/, "sem Prisma");
  assert.doesNotMatch(source, /getStorageAdapter|storage-local/, "sem storage");
  assert.doesNotMatch(source, /uploadProcessDocument|reviewProcessDocument/, "sem upload/review");
  assert.doesNotMatch(source, /\bfetch\(|https?:\/\//, "sem rede");
});
