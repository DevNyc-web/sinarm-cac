/**
 * Fila de automacao (agrupamento por prontidao) — testes do dominio puro.
 * Sem OCR, sem IA, sem rede, sem banco: classifica um resultado de checklist.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AUTOMATION_QUEUE_CATEGORIES,
  blockerCategory,
  classifyReadiness,
  groupByCategory,
} from "../../../src/server/automation/automationQueue";
import {
  deriveAutomationReadiness,
  type AutomationReadiness,
  type AutomationReadinessSnapshot,
  type DestinationFields,
  type ReadinessItem,
} from "../../../src/server/automation/automationReadiness";
import { GUIA_TRAFEGO_PROCESS_CODE } from "../../../src/server/documents/documentRequirements";
import {
  buildExtractionReview,
  type ReviewDocument,
} from "../../../src/server/documents/documentExtractionReview";
import {
  buildFieldSuggestions,
  type ProcessCurrentValues,
} from "../../../src/server/documents/documentFieldSuggestions";
import type { IntakeDocument } from "../../../src/server/documents/documentIntake";
import type { DocumentType, DocumentStatus } from "@prisma/client";

const DESTINO_COMPLETO: DestinationFields = {
  eventName: "Clube de Tiro (exemplo)",
  uf: "SP",
  city: "São Paulo",
  street: "Rua de Exemplo",
  number: "100",
};

function doc(type: DocumentType, status: DocumentStatus): IntakeDocument {
  return { type, status, createdAt: new Date("2026-01-01T10:00:00Z"), rejectionReason: null };
}

/** Retrato "tudo pronto"; cada teste quebra so o que precisa. */
function readySnapshot(
  overrides: Partial<AutomationReadinessSnapshot> = {},
): AutomationReadinessSnapshot {
  return {
    processTypeCode: GUIA_TRAFEGO_PROCESS_CODE,
    destination: DESTINO_COMPLETO,
    hasFirearmPce: true,
    documents: [
      doc("IDENTIFICACAO_PESSOAL", "APROVADO"),
      doc("DECLARACAO_DESTINO_EVENTO", "APROVADO"),
    ],
    suggestions: [],
    paymentStatus: "PAGO",
    ...overrides,
  };
}

function categoryOf(overrides: Partial<AutomationReadinessSnapshot>) {
  return classifyReadiness(deriveAutomationReadiness(readySnapshot(overrides))).category;
}

/** Sugestoes destino.* aplicaveis pendentes (declaracao aprovada, destino difere). */
function pendingSuggestions() {
  const review: ReviewDocument = {
    id: "doc-decl",
    originalFileName: "",
    type: "DECLARACAO_DESTINO_EVENTO",
    status: "APROVADO",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    rejectionReason: null,
  };
  const current: ProcessCurrentValues = { destination: DESTINO_COMPLETO };
  return buildFieldSuggestions(buildExtractionReview([review]), current);
}

test("processo pronto entra em PRONTO_PARA_AUTOMACAO", () => {
  const classification = classifyReadiness(deriveAutomationReadiness(readySnapshot()));
  assert.equal(classification.category, "PRONTO_PARA_AUTOMACAO");
  assert.equal(classification.ready, true);
  assert.equal(classification.mainBlocker, null);
  assert.equal(classification.blockerCount, 0);
});

test("bloqueio de documento entra em NAO_PRONTO_DOCUMENTOS", () => {
  // So a declaracao foi enviada; a identificacao (obrigatoria) falta.
  assert.equal(
    categoryOf({ documents: [doc("DECLARACAO_DESTINO_EVENTO", "APROVADO")] }),
    "NAO_PRONTO_DOCUMENTOS",
  );
});

test("bloqueio de destino entra em NAO_PRONTO_DESTINO", () => {
  assert.equal(categoryOf({ destination: null }), "NAO_PRONTO_DESTINO");
  assert.equal(
    categoryOf({ destination: { ...DESTINO_COMPLETO, city: "" } }),
    "NAO_PRONTO_DESTINO",
  );
});

test("bloqueio de pagamento entra em NAO_PRONTO_PAGAMENTO", () => {
  assert.equal(categoryOf({ paymentStatus: null }), "NAO_PRONTO_PAGAMENTO");
  assert.equal(categoryOf({ paymentStatus: "PENDENTE" }), "NAO_PRONTO_PAGAMENTO");
});

test("sugestao pendente entra em NAO_PRONTO_SUGESTOES", () => {
  const suggestions = pendingSuggestions();
  assert.ok(suggestions.length > 0, "a fixture precisa gerar sugestoes");
  assert.equal(categoryOf({ suggestions }), "NAO_PRONTO_SUGESTOES");
});

test("ausencia de PCE entra em NAO_PRONTO_PCE", () => {
  assert.equal(categoryOf({ hasFirearmPce: false }), "NAO_PRONTO_PCE");
});

test("bloqueios multiplos escolhem a categoria principal por precedencia fixa", () => {
  // Tudo quebrado ao mesmo tempo: destino tem a maior precedencia.
  const classification = classifyReadiness(
    deriveAutomationReadiness(
      readySnapshot({
        destination: null,
        hasFirearmPce: false,
        documents: [],
        suggestions: pendingSuggestions(),
        paymentStatus: null,
      }),
    ),
  );
  assert.equal(classification.category, "NAO_PRONTO_DESTINO");
  assert.ok(classification.mainBlocker?.code.startsWith("DESTINO_"));
  assert.ok(classification.blockerCount >= 5, "conta todos os bloqueios, nao so o principal");
});

/** Constroi um resultado de checklist com blockers arbitrarios (para precedencia). */
function readinessWith(blockerCodes: string[]): AutomationReadiness {
  const blockers: ReadinessItem[] = blockerCodes.map((code) => ({ code, label: code }));
  return {
    status: blockers.length === 0 ? "PRONTO_PARA_AUTOMACAO" : "NAO_PRONTO_PARA_AUTOMACAO",
    label: "x",
    blockers,
    warnings: [],
    completed: [],
  };
}

test("precedencia: PCE vence documento; documento vence pagamento", () => {
  assert.equal(
    classifyReadiness(readinessWith(["PAGAMENTO_PENDENTE", "PCE_AUSENTE"])).category,
    "NAO_PRONTO_PCE",
  );
  assert.equal(
    classifyReadiness(readinessWith(["PAGAMENTO_PENDENTE", "DOC_IDENTIFICACAO_PESSOAL_AUSENTE"]))
      .category,
    "NAO_PRONTO_DOCUMENTOS",
  );
  assert.equal(
    classifyReadiness(readinessWith(["PAGAMENTO_PENDENTE", "SUGESTAO_DESTINO_PENDENTE"])).category,
    "NAO_PRONTO_SUGESTOES",
  );
});

test("bloqueio de codigo desconhecido cai em BLOQUEADO_OUTROS", () => {
  assert.equal(blockerCategory("ALGO_INESPERADO"), null);
  const classification = classifyReadiness(readinessWith(["ALGO_INESPERADO"]));
  assert.equal(classification.category, "BLOQUEADO_OUTROS");
  assert.equal(classification.mainBlocker?.code, "ALGO_INESPERADO");
});

test("mapa de categorias de bloqueio cobre cada prefixo conhecido", () => {
  assert.equal(blockerCategory("DESTINO_AUSENTE"), "NAO_PRONTO_DESTINO");
  assert.equal(blockerCategory("DESTINO_NUMERO_AUSENTE"), "NAO_PRONTO_DESTINO");
  assert.equal(blockerCategory("PCE_AUSENTE"), "NAO_PRONTO_PCE");
  assert.equal(blockerCategory("DOC_IDENTIFICACAO_PESSOAL_REJEITADO"), "NAO_PRONTO_DOCUMENTOS");
  assert.equal(blockerCategory("SUGESTAO_DESTINO_PENDENTE"), "NAO_PRONTO_SUGESTOES");
  assert.equal(blockerCategory("PAGAMENTO_PENDENTE"), "NAO_PRONTO_PAGAMENTO");
});

test("groupByCategory mantem as 7 categorias na ordem canonica e filtra certo", () => {
  const rows = [
    { id: "a", category: "PRONTO_PARA_AUTOMACAO" as const },
    { id: "b", category: "NAO_PRONTO_DOCUMENTOS" as const },
    { id: "c", category: "NAO_PRONTO_DOCUMENTOS" as const },
  ];
  const groups = groupByCategory(rows);
  assert.deepEqual(
    groups.map((group) => group.category),
    [...AUTOMATION_QUEUE_CATEGORIES],
  );
  assert.equal(groups[0].rows.length, 1);
  assert.equal(groups.find((g) => g.category === "NAO_PRONTO_DOCUMENTOS")?.rows.length, 2);
  assert.equal(groups.find((g) => g.category === "NAO_PRONTO_PAGAMENTO")?.rows.length, 0);
});

/** Trava estatica: o dominio da fila e PURO. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o dominio da fila nao acessa banco, rede, OCR nem IA", () => {
  const code = codeOnly(readFileSync("src/server/automation/automationQueue.ts", "utf8"));
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "e puro, sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, "nao faz requisicao");
  assert.doesNotMatch(code, /https?:\/\//, "nao tem URL externa");
  assert.doesNotMatch(
    code,
    /(?:import|require)[^;\n]*["'][^"']*(?:tesseract|ocr|openai|anthropic|vision)/i,
    "nao importa OCR/IA",
  );
});
