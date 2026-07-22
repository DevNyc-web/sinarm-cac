/**
 * Sugestoes de preenchimento (mock/dev) — testes das funcoes puras.
 * Sem OCR, sem IA, sem rede, sem banco. Nada aqui altera processo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PROCESS_FIELD_TARGETS,
  SUGGESTION_AREA_LABELS,
  buildFieldSuggestions,
  groupSuggestionsByArea,
  isTargetAvailableToday,
  type ProcessCurrentValues,
} from "../../../src/server/documents/documentFieldSuggestions";
import {
  buildExtractionReview,
  type ReviewDocument,
} from "../../../src/server/documents/documentExtractionReview";
import { isObviouslyFictitious } from "../../../src/server/documents/documentExtractionMock";

function doc(partial: Partial<ReviewDocument> & Pick<ReviewDocument, "type">): ReviewDocument {
  return {
    id: "doc-1",
    originalFileName: "fake.pdf",
    status: "APROVADO",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    rejectionReason: null,
    ...partial,
  };
}

const DESTINO_ATUAL: ProcessCurrentValues = {
  destination: {
    eventName: "Clube Atual (exemplo)",
    uf: "XX",
    city: "Cidade Atual",
    street: "Rua Atual",
    number: "123",
  },
};

function suggestionsFor(
  type: ReviewDocument["type"],
  status: ReviewDocument["status"] = "APROVADO",
  current: ProcessCurrentValues = {},
) {
  return buildFieldSuggestions(buildExtractionReview([doc({ type, status })]), current);
}

test("sem documentos, não há sugestão alguma", () => {
  assert.deepEqual(buildFieldSuggestions([]), []);
  assert.deepEqual(groupSuggestionsByArea([]), []);
});

test("sugestões só saem de conferência CONFIRMADA", () => {
  for (const status of ["ENVIADO", "EM_ANALISE", "PENDENTE", "REJEITADO"] as const) {
    assert.deepEqual(
      suggestionsFor("DECLARACAO_DESTINO_EVENTO", status),
      [],
      `status ${status} não pode gerar sugestão`,
    );
  }
  assert.ok(suggestionsFor("DECLARACAO_DESTINO_EVENTO", "APROVADO").length > 0);
});

test("toda sugestão exige confirmação humana e nunca se aplica sozinha", () => {
  const types = [
    "IDENTIFICACAO_PESSOAL",
    "CR_REGISTRO_CAC",
    "COMPROVANTE_ORIGEM_ENDERECO",
    "DECLARACAO_DESTINO_EVENTO",
  ] as const;
  for (const type of types) {
    const suggestions = suggestionsFor(type);
    assert.ok(suggestions.length > 0, `${type} deve gerar sugestões`);
    for (const s of suggestions) {
      assert.equal(s.requiresHumanConfirmation, true);
      assert.equal(s.canApplyAutomatically, false);
      assert.ok(s.reason.length > 0);
    }
  }
});

test("todo targetField é um alvo declarado", () => {
  const types = [
    "IDENTIFICACAO_PESSOAL",
    "CR_REGISTRO_CAC",
    "COMPROVANTE_ORIGEM_ENDERECO",
    "DECLARACAO_DESTINO_EVENTO",
  ] as const;
  for (const type of types) {
    for (const s of suggestionsFor(type)) {
      assert.ok(
        (PROCESS_FIELD_TARGETS as readonly string[]).includes(s.targetField),
        `alvo desconhecido: ${s.targetField}`,
      );
    }
  }
});

test("campo sem alvo mapeado não vira sugestão", () => {
  // `dataNascimento` e `categoriaAtividade` não têm campo-alvo previsto.
  const ident = suggestionsFor("IDENTIFICACAO_PESSOAL").map((s) => s.sourceField);
  assert.deepEqual(ident, ["nome", "cpf", "rg"]);
  assert.ok(!ident.includes("dataNascimento"));

  const cac = suggestionsFor("CR_REGISTRO_CAC").map((s) => s.sourceField);
  assert.deepEqual(cac, ["numeroRegistro", "validade"]);
  assert.ok(!cac.includes("categoriaAtividade"));
});

test("documento complementar nunca gera sugestão", () => {
  assert.deepEqual(suggestionsFor("OUTRO"), []);
});

test("só campos de destino existem hoje; o resto é campo futuro", () => {
  for (const target of PROCESS_FIELD_TARGETS) {
    const expected = target.startsWith("destination.");
    assert.equal(isTargetAvailableToday(target), expected, `${target}`);
  }

  for (const s of suggestionsFor("DECLARACAO_DESTINO_EVENTO")) {
    assert.equal(s.status, "PRONTA_PARA_REVISAO");
  }
  for (const type of ["IDENTIFICACAO_PESSOAL", "COMPROVANTE_ORIGEM_ENDERECO", "CR_REGISTRO_CAC"] as const) {
    for (const s of suggestionsFor(type)) {
      assert.equal(s.status, "CAMPO_FUTURO", `${s.targetField} não existe no modelo atual`);
      assert.match(s.reason, /etapa futura/i);
    }
  }
});

test("valor atual só aparece para campo que existe no processo", () => {
  const destino = suggestionsFor("DECLARACAO_DESTINO_EVENTO", "APROVADO", DESTINO_ATUAL);
  const porAlvo = new Map(destino.map((s) => [s.targetField, s.currentValue]));
  assert.equal(porAlvo.get("destination.name"), "Clube Atual (exemplo)");
  assert.equal(porAlvo.get("destination.city"), "Cidade Atual");
  assert.equal(porAlvo.get("destination.number"), "123");

  // Campo futuro nunca inventa valor atual, mesmo com destino preenchido.
  for (const s of suggestionsFor("IDENTIFICACAO_PESSOAL", "APROVADO", DESTINO_ATUAL)) {
    assert.equal(s.currentValue, null);
  }
});

test("sem destino no processo, valor atual é nulo (não inventa)", () => {
  for (const s of suggestionsFor("DECLARACAO_DESTINO_EVENTO", "APROVADO", {})) {
    assert.equal(s.currentValue, null);
  }
});

test("valores sugeridos continuam fictícios", () => {
  const types = [
    "IDENTIFICACAO_PESSOAL",
    "CR_REGISTRO_CAC",
    "COMPROVANTE_ORIGEM_ENDERECO",
    "DECLARACAO_DESTINO_EVENTO",
  ] as const;
  for (const type of types) {
    for (const s of suggestionsFor(type)) {
      assert.ok(isObviouslyFictitious(s.suggestedValue), `${s.targetField}: ${s.suggestedValue}`);
    }
  }
});

test("agrupamento por área é estável e omite área vazia", () => {
  const suggestions = buildFieldSuggestions(
    buildExtractionReview([
      doc({ id: "a", type: "DECLARACAO_DESTINO_EVENTO" }),
      doc({ id: "b", type: "IDENTIFICACAO_PESSOAL" }),
    ]),
  );
  const groups = groupSuggestionsByArea(suggestions);
  assert.deepEqual(groups.map((g) => g.area), ["PESSOAIS", "DESTINO"]);
  for (const group of groups) {
    assert.equal(group.label, SUGGESTION_AREA_LABELS[group.area]);
    assert.ok(group.suggestions.length > 0);
  }
});

test("ids de sugestão são únicos e estáveis", () => {
  const input = buildExtractionReview([
    doc({ id: "doc-a", type: "DECLARACAO_DESTINO_EVENTO" }),
    doc({ id: "doc-b", type: "COMPROVANTE_ORIGEM_ENDERECO" }),
  ]);
  const ids = buildFieldSuggestions(input).map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "ids não podem colidir");
  assert.deepEqual(buildFieldSuggestions(input).map((s) => s.id), ids, "ids são estáveis");
});

test("a função é pura: não muta a entrada nem o processo atual", () => {
  const reviews = buildExtractionReview([doc({ type: "DECLARACAO_DESTINO_EVENTO" })]);
  const snapshotReviews = JSON.stringify(reviews);
  const current: ProcessCurrentValues = JSON.parse(JSON.stringify(DESTINO_ATUAL));
  const snapshotCurrent = JSON.stringify(current);

  buildFieldSuggestions(reviews, current);

  assert.equal(JSON.stringify(reviews), snapshotReviews, "conferência não pode ser mutada");
  assert.equal(JSON.stringify(current), snapshotCurrent, "dados do processo não podem ser mutados");
});

/** Trava estatica: nada de rede, OCR, IA ou escrita no banco neste caminho. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("módulo e painel de sugestões não têm rede, OCR, IA nem escrita", () => {
  const files = [
    "src/server/documents/documentFieldSuggestions.ts",
    "src/components/documents/DocumentFieldSuggestionsPanel.tsx",
  ];
  for (const file of files) {
    const code = codeOnly(readFileSync(file, "utf8"));
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, `${file} nao faz requisicao`);
    assert.doesNotMatch(code, /https?:\/\//, `${file} nao tem URL externa`);
    assert.doesNotMatch(
      code,
      /(?:import|require)[^;\n]*["'][^"']*(?:tesseract|ocr|openai|anthropic|vision)/i,
      `${file} nao importa OCR/IA`,
    );
    // Sugestao nao grava: nada de Prisma/repositorio no caminho.
    assert.doesNotMatch(code, /getPrisma|prisma\.|@prisma\/client/, `${file} nao acessa o banco`);
    assert.doesNotMatch(code, /\.update\(|\.create\(|\.upsert\(/, `${file} nao escreve dados`);
  }
});
