/**
 * Prontidao para automacao (checklist pre-execucao) — testes do dominio puro.
 * Sem OCR, sem IA, sem rede, sem banco: recebe um retrato e devolve a leitura.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  deriveAutomationReadiness,
  type AutomationReadinessSnapshot,
  type DestinationFields,
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

/** Documento persistido minimo para a avaliacao. */
function doc(
  type: DocumentType,
  status: DocumentStatus,
  rejectionReason: string | null = null,
): IntakeDocument {
  return { type, status, createdAt: new Date("2026-01-01T10:00:00Z"), rejectionReason };
}

/** Retrato "tudo pronto" — cada teste sobrescreve so o que quer quebrar. */
function readySnapshot(
  overrides: Partial<AutomationReadinessSnapshot> = {},
): AutomationReadinessSnapshot {
  return {
    processTypeCode: GUIA_TRAFEGO_PROCESS_CODE,
    destination: DESTINO_COMPLETO,
    hasFirearmPce: true,
    // Obrigatorio (identificacao) e recomendado (declaracao) aprovados => sem
    // bloqueio nem alerta de documento.
    documents: [
      doc("IDENTIFICACAO_PESSOAL", "APROVADO"),
      doc("DECLARACAO_DESTINO_EVENTO", "APROVADO"),
    ],
    suggestions: [],
    paymentStatus: "PAGO",
    ...overrides,
  };
}

function codes(items: ReadonlyArray<{ code: string }>): string[] {
  return items.map((item) => item.code);
}

test("processo sem destino bloqueia com DESTINO_AUSENTE", () => {
  const result = deriveAutomationReadiness(readySnapshot({ destination: null }));
  assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO");
  assert.ok(codes(result.blockers).includes("DESTINO_AUSENTE"));
});

test("destino incompleto lista exatamente o campo que falta", () => {
  const semNumero: DestinationFields = { ...DESTINO_COMPLETO, number: "  " };
  const result = deriveAutomationReadiness(readySnapshot({ destination: semNumero }));
  assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO");
  assert.deepEqual(
    codes(result.blockers).filter((code) => code.startsWith("DESTINO_")),
    ["DESTINO_NUMERO_AUSENTE"],
  );
});

test("sem armamento/PCE bloqueia com PCE_AUSENTE", () => {
  const result = deriveAutomationReadiness(readySnapshot({ hasFirearmPce: false }));
  assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO");
  assert.ok(codes(result.blockers).includes("PCE_AUSENTE"));
});

test("documento obrigatorio ausente bloqueia", () => {
  // So a declaracao (recomendada) foi enviada; a identificacao (obrigatoria) nao.
  const result = deriveAutomationReadiness(
    readySnapshot({ documents: [doc("DECLARACAO_DESTINO_EVENTO", "APROVADO")] }),
  );
  assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO");
  assert.ok(codes(result.blockers).includes("DOC_IDENTIFICACAO_PESSOAL_AUSENTE"));
});

test("documento obrigatorio enviado mas nao aprovado bloqueia", () => {
  for (const status of ["ENVIADO", "EM_ANALISE"] as const) {
    const result = deriveAutomationReadiness(
      readySnapshot({ documents: [doc("IDENTIFICACAO_PESSOAL", status)] }),
    );
    assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO", status);
    assert.ok(
      codes(result.blockers).includes("DOC_IDENTIFICACAO_PESSOAL_NAO_APROVADO"),
      `status ${status}`,
    );
  }
});

test("documento obrigatorio rejeitado bloqueia", () => {
  const result = deriveAutomationReadiness(
    readySnapshot({ documents: [doc("IDENTIFICACAO_PESSOAL", "REJEITADO", "ilegivel")] }),
  );
  assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO");
  assert.ok(codes(result.blockers).includes("DOC_IDENTIFICACAO_PESSOAL_REJEITADO"));
});

test("documento obrigatorio aprovado nao bloqueia e vira concluido", () => {
  const result = deriveAutomationReadiness(readySnapshot());
  assert.ok(!codes(result.blockers).some((code) => code.startsWith("DOC_IDENTIFICACAO_PESSOAL")));
  assert.ok(codes(result.completed).includes("DOC_IDENTIFICACAO_PESSOAL_APROVADO"));
});

test("sugestao aplicavel pendente de destino bloqueia", () => {
  // Declaracao APROVADA gera sugestoes destination.* PRONTA_PARA_REVISAO; como o
  // destino atual difere do mock, ha sugestao aplicavel pendente.
  const review: ReviewDocument = {
    id: "doc-decl",
    originalFileName: "declaracao.pdf",
    type: "DECLARACAO_DESTINO_EVENTO",
    status: "APROVADO",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    rejectionReason: null,
  };
  const current: ProcessCurrentValues = { destination: DESTINO_COMPLETO };
  const suggestions = buildFieldSuggestions(buildExtractionReview([review]), current);
  assert.ok(suggestions.length > 0, "a fixture precisa gerar sugestoes");

  const result = deriveAutomationReadiness(readySnapshot({ suggestions }));
  assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO");
  assert.ok(codes(result.blockers).includes("SUGESTAO_DESTINO_PENDENTE"));
});

test("pagamento pendente bloqueia; PAGO libera", () => {
  for (const paymentStatus of ["PENDENTE", "AGUARDANDO_PAGAMENTO", null] as const) {
    const result = deriveAutomationReadiness(readySnapshot({ paymentStatus }));
    assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO", `${paymentStatus}`);
    assert.ok(codes(result.blockers).includes("PAGAMENTO_PENDENTE"));
  }
  const pago = deriveAutomationReadiness(readySnapshot());
  assert.ok(codes(pago.completed).includes("PAGAMENTO_CONFIRMADO"));
});

test("processo completo fica PRONTO, sem bloqueios nem alertas", () => {
  const result = deriveAutomationReadiness(readySnapshot());
  assert.equal(result.status, "PRONTO_PARA_AUTOMACAO");
  assert.equal(result.label, "Pronto para automação");
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.completed.length > 0);
});

test("alerta (documento recomendado) NAO bloqueia — status segue PRONTO", () => {
  // Sem a declaracao (recomendada): vira alerta, nunca bloqueio.
  const result = deriveAutomationReadiness(
    readySnapshot({ documents: [doc("IDENTIFICACAO_PESSOAL", "APROVADO")] }),
  );
  assert.equal(result.status, "PRONTO_PARA_AUTOMACAO");
  assert.deepEqual(result.blockers, []);
  assert.ok(
    codes(result.warnings).includes("DOC_DECLARACAO_DESTINO_EVENTO_RECOMENDADO_PENDENTE"),
    "documento recomendado pendente e um alerta",
  );
});

test("qualquer bloqueio muda o status para NAO_PRONTO", () => {
  const result = deriveAutomationReadiness(readySnapshot({ hasFirearmPce: false }));
  assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO");
  assert.ok(result.blockers.length >= 1);
});

test("codigo de processo desconhecido cai na Guia de Trafego (nao esvazia checklist)", () => {
  const result = deriveAutomationReadiness(
    readySnapshot({ processTypeCode: "CODIGO_INEXISTENTE", documents: [] }),
  );
  // Ainda cobra a identificacao obrigatoria da Guia de Trafego.
  assert.ok(codes(result.blockers).includes("DOC_IDENTIFICACAO_PESSOAL_AUSENTE"));
});

/** Trava estatica: o motor de prontidao e PURO. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o dominio de prontidao nao acessa banco, rede, OCR nem IA", () => {
  const code = codeOnly(readFileSync("src/server/automation/automationReadiness.ts", "utf8"));
  assert.doesNotMatch(code, /getPrisma/, "nao le banco");
  assert.doesNotMatch(code, /\.update\(|\.create\(|\.upsert\(/, "nao grava");
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, "nao faz requisicao");
  assert.doesNotMatch(code, /https?:\/\//, "nao tem URL externa");
  assert.doesNotMatch(
    code,
    /(?:import|require)[^;\n]*["'][^"']*(?:tesseract|ocr|openai|anthropic|vision)/i,
    "nao importa OCR/IA",
  );
});
