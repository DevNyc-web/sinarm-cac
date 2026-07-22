/**
 * Conferencia de dados extraidos (mock/dev) — testes das funcoes puras.
 * Sem OCR, sem IA, sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildExtractionReview,
  reviewForDocument,
  toProcessFieldSuggestions,
  type ReviewDocument,
} from "../../../src/server/documents/documentExtractionReview";
import {
  isObviouslyFictitious,
  mockFieldsFor,
} from "../../../src/server/documents/documentExtractionMock";
import {
  CONFIDENCE_LEVELS,
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  needsReview,
} from "../../../src/server/documents/documentExtractionStatus";
import { DOCUMENT_KINDS } from "../../../src/server/documents/documentTypes";

function doc(partial: Partial<ReviewDocument> & Pick<ReviewDocument, "type">): ReviewDocument {
  return {
    id: "doc-1",
    originalFileName: "fake.pdf",
    status: "ENVIADO",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    rejectionReason: null,
    ...partial,
  };
}

test("status de conferência cobre os estados pedidos", () => {
  for (const s of [
    "NAO_INICIADA",
    "EXTRAIDA_MOCK",
    "PRECISA_REVISAO",
    "CONFIRMADA",
    "REJEITADA",
  ] as const) {
    assert.ok(REVIEW_STATUSES.includes(s), `falta status ${s}`);
    assert.equal(typeof REVIEW_STATUS_LABELS[s], "string");
  }
});

test("níveis de confiança são alta/média/baixa e só baixa exige revisão", () => {
  assert.deepEqual([...CONFIDENCE_LEVELS], ["ALTA", "MEDIA", "BAIXA"]);
  assert.equal(needsReview("BAIXA"), true);
  assert.equal(needsReview("ALTA"), false);
  assert.equal(needsReview("MEDIA"), false);
});

test("todo tipo de documento tem campos esperados definidos", () => {
  for (const kind of DOCUMENT_KINDS) {
    const fields = mockFieldsFor(kind);
    assert.ok(fields.length > 0, `${kind} deve ter campos`);
    for (const field of fields) {
      assert.ok(field.key.length > 0);
      assert.ok(field.label.length > 0);
      assert.ok(CONFIDENCE_LEVELS.includes(field.confidence));
    }
  }
});

test("campos previstos por tipo estão presentes", () => {
  const keys = (kind: Parameters<typeof mockFieldsFor>[0]) =>
    mockFieldsFor(kind).map((f) => f.key);

  assert.deepEqual(keys("IDENTIFICACAO_PESSOAL"), ["nome", "cpf", "rg", "dataNascimento"]);
  assert.deepEqual(keys("CR_REGISTRO_CAC"), ["numeroRegistro", "validade", "categoriaAtividade"]);
  assert.deepEqual(keys("COMPROVANTE_ORIGEM_ENDERECO"), ["uf", "cidade", "logradouro", "numero"]);
  assert.deepEqual(keys("DECLARACAO_DESTINO_EVENTO"), [
    "nomeLocalEvento",
    "uf",
    "cidade",
    "logradouro",
    "numero",
  ]);
  assert.deepEqual(keys("COMPLEMENTAR"), ["descricao", "observacoes"]);
});

test("todo valor de demonstração se identifica como exemplo/fictício", () => {
  for (const kind of DOCUMENT_KINDS) {
    for (const field of mockFieldsFor(kind)) {
      assert.ok(
        isObviouslyFictitious(field.value),
        `${kind}.${field.key} deve deixar claro que é exemplo: "${field.value}"`,
      );
    }
  }
});

test("sem documento enviado, não há conferência alguma", () => {
  assert.deepEqual(buildExtractionReview([]), []);
});

test("conferência só aparece para documento enviado", () => {
  const reviews = buildExtractionReview([doc({ type: "CR_REGISTRO_CAC" })]);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].kind, "CR_REGISTRO_CAC");
  assert.ok(reviews[0].fields.length > 0);
});

test("status da conferência é derivado do status do documento", () => {
  assert.equal(reviewForDocument(doc({ type: "IDENTIFICACAO_PESSOAL", status: "REJEITADO" })).status, "REJEITADA");
  assert.equal(reviewForDocument(doc({ type: "IDENTIFICACAO_PESSOAL", status: "APROVADO" })).status, "CONFIRMADA");
  assert.equal(reviewForDocument(doc({ type: "IDENTIFICACAO_PESSOAL", status: "PENDENTE" })).status, "NAO_INICIADA");
  // Identificacao tem um campo de confianca baixa => precisa de revisao.
  assert.equal(reviewForDocument(doc({ type: "IDENTIFICACAO_PESSOAL", status: "ENVIADO" })).status, "PRECISA_REVISAO");
  // Origem/endereco nao tem campo baixo => fica so como demonstracao a conferir.
  assert.equal(reviewForDocument(doc({ type: "COMPROVANTE_ORIGEM_ENDERECO", status: "ENVIADO" })).status, "EXTRAIDA_MOCK");
});

test("nenhum campo nasce confirmado (não há persistência de conferência)", () => {
  for (const kind of DOCUMENT_KINDS) {
    const type = kind === "COMPLEMENTAR" ? "OUTRO" : kind;
    const review = reviewForDocument(doc({ type, status: "APROVADO" }));
    for (const field of review.fields) {
      assert.equal(field.confirmed, false, `${kind}.${field.key} não pode nascer confirmado`);
    }
  }
});

test("conferência lista o documento mais recente primeiro", () => {
  const reviews = buildExtractionReview([
    doc({ id: "antigo", type: "IDENTIFICACAO_PESSOAL", createdAt: new Date("2026-01-01T10:00:00Z") }),
    doc({ id: "novo", type: "CR_REGISTRO_CAC", createdAt: new Date("2026-01-02T10:00:00Z") }),
  ]);
  assert.equal(reviews[0].documentId, "novo");
  assert.equal(reviews[1].documentId, "antigo");
});

test("sugestões futuras só saem de documento confirmado pela equipe", () => {
  const naoConfirmado = buildExtractionReview([
    doc({ type: "DECLARACAO_DESTINO_EVENTO", status: "ENVIADO" }),
  ]);
  assert.deepEqual(toProcessFieldSuggestions(naoConfirmado), []);

  const confirmado = buildExtractionReview([
    doc({ type: "DECLARACAO_DESTINO_EVENTO", status: "APROVADO" }),
  ]);
  const suggestions = toProcessFieldSuggestions(confirmado);
  assert.ok(suggestions.length > 0);
  for (const s of suggestions) {
    assert.equal(s.target, "DESTINO");
    // Invariante do preenchimento assistido: nada se aplica sozinho.
    assert.equal(s.requiresHumanConfirmation, true);
    assert.ok(isObviouslyFictitious(s.value));
  }
});

test("documento complementar nunca vira sugestão de campo do processo", () => {
  const reviews = buildExtractionReview([doc({ type: "OUTRO", status: "APROVADO" })]);
  assert.equal(reviews[0].kind, "COMPLEMENTAR");
  assert.deepEqual(toProcessFieldSuggestions(reviews), []);
});

/**
 * Trava estatica: os modulos de conferencia nao podem ganhar rede, OCR ou IA
 * sem alguem derrubar este teste de proposito. Comentarios sao ignorados —
 * os arquivos DECLARAM "sem OCR/IA" em prosa.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("nenhum módulo de conferência chama rede, OCR ou IA", () => {
  const files = [
    "src/server/documents/documentExtractionReview.ts",
    "src/server/documents/documentExtractionMock.ts",
    "src/server/documents/documentExtractionStatus.ts",
    "src/components/documents/DocumentExtractionReviewPanel.tsx",
  ];
  // Interessa EXECUCAO, nao mencao: a UI legitimamente escreve "não há OCR nem
  // IA" como aviso ao usuario. Entao checamos chamadas, URLs e dependencias.
  for (const file of files) {
    const code = codeOnly(readFileSync(file, "utf8"));
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, `${file} nao faz requisicao`);
    assert.doesNotMatch(code, /https?:\/\//, `${file} nao tem URL externa`);
    assert.doesNotMatch(
      code,
      /(?:import|require)[^;\n]*["'][^"']*(?:tesseract|ocr|openai|anthropic|vision)/i,
      `${file} nao importa biblioteca de OCR/IA`,
    );
    assert.doesNotMatch(code, /node:fs|node:child_process/, `${file} nao le arquivo nem executa`);
  }
});

test("as funções são puras: mesma entrada, mesma saída, sem I/O", () => {
  const input = [doc({ type: "IDENTIFICACAO_PESSOAL", status: "APROVADO" })];
  assert.deepEqual(buildExtractionReview(input), buildExtractionReview(input));
  // Entrada nao e mutada (a ordenacao nao pode reordenar o array do chamador).
  const original = [
    doc({ id: "a", type: "IDENTIFICACAO_PESSOAL", createdAt: new Date("2026-01-01T10:00:00Z") }),
    doc({ id: "b", type: "CR_REGISTRO_CAC", createdAt: new Date("2026-01-02T10:00:00Z") }),
  ];
  buildExtractionReview(original);
  assert.deepEqual(original.map((d) => d.id), ["a", "b"]);
});
