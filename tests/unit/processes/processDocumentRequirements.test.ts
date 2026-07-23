/**
 * Requisitos documentais por processo — testes do dominio puro.
 * Sem OCR, sem IA, sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  REQUIREMENT_TYPES,
  applicantRequirementsForProcess,
  countRequirementsForProcess,
  documentRequirementsForProcess,
  requiredRequirementsForProcess,
  requirementSummaryForProcess,
  systemGeneratedRequirementsForProcess,
} from "../../../src/server/processes/processDocumentRequirements";
import { LAUNCH_PROCESS_CODES } from "../../../src/server/processes/processCatalog";

const labelsOf = (list: ReadonlyArray<{ label: string }>) => list.map((item) => item.label);

test("existem requisitos para os 4 processos do catalogo", () => {
  for (const code of LAUNCH_PROCESS_CODES) {
    assert.ok(countRequirementsForProcess(code) > 0, `${code} tem requisitos`);
  }
});

test("cada requisito referencia o proprio processo", () => {
  for (const code of LAUNCH_PROCESS_CODES) {
    for (const requirement of documentRequirementsForProcess(code)) {
      assert.equal(requirement.processCode, code);
    }
  }
});

test("CR contem os 12 documentos enviados pelo solicitante", () => {
  const applicant = applicantRequirementsForProcess("CONCESSAO_CR");
  assert.equal(applicant.length, 12);
  const labels = labelsOf(applicant);
  assert.ok(labels.includes("RG"));
  assert.ok(labels.includes("Laudo psicológico válido"));
  assert.ok(labels.includes("Declaração de Comprometimento ao Clube"));
  // Todos enviados pelo solicitante sao de etapa futura (fluxo real nao existe).
  assert.ok(applicant.every((requirement) => requirement.futureStage === true));
});

test("CR contem os 5 documentos geraveis pelo sistema", () => {
  const generated = systemGeneratedRequirementsForProcess("CONCESSAO_CR");
  assert.equal(generated.length, 5);
  const labels = labelsOf(generated);
  assert.ok(labels.includes("Antecedente eleitoral"));
  assert.ok(labels.includes("Antecedente federal"));
  assert.ok(generated.every((requirement) => requirement.type === "GERAVEL_PELO_SISTEMA"));
});

test("Guia de Trafego mantem os requisitos atuais do MVP (fluxo real)", () => {
  const guia = documentRequirementsForProcess("GUIA_TRAFEGO");
  const labels = labelsOf(guia);
  assert.ok(labels.includes("Documento de identificação pessoal"));
  assert.ok(labels.includes("CR / registro CAC"));
  assert.ok(labels.includes("Comprovante de origem/endereço"));
  assert.ok(labels.includes("Declaração de destino/evento"));
  assert.ok(labels.includes("Documentos complementares"));
  // Fluxo REAL: nada aqui e etapa futura.
  assert.ok(guia.every((requirement) => requirement.futureStage === false));
  // So a identificacao e obrigatoria (unico anexo observado no MVP).
  const required = labelsOf(requiredRequirementsForProcess("GUIA_TRAFEGO"));
  assert.deepEqual(required, ["Documento de identificação pessoal"]);
});

test("Autorizacao de Compra inclui CR valido e fornecedor/CNPJ", () => {
  const labels = labelsOf(documentRequirementsForProcess("AUTORIZACAO_COMPRA"));
  assert.ok(labels.includes("CR válido"));
  assert.ok(labels.includes("Dados do fornecedor/CNPJ"));
  assert.ok(labels.includes("Justificativa/finalidade da compra"));
});

test("CRAF inclui autorizacao de compra e nota fiscal", () => {
  const labels = labelsOf(documentRequirementsForProcess("EMISSAO_CRAF"));
  assert.ok(labels.includes("Autorização de compra aprovada"));
  assert.ok(labels.includes("Nota fiscal de aquisição"));
});

test("helper de obrigatorios devolve so os requeridos", () => {
  for (const code of LAUNCH_PROCESS_CODES) {
    const required = requiredRequirementsForProcess(code);
    assert.ok(required.every((requirement) => requirement.required === true), code);
    // Todo obrigatorio esta contido no conjunto total.
    const allLabels = labelsOf(documentRequirementsForProcess(code));
    for (const requirement of required) assert.ok(allLabels.includes(requirement.label));
  }
});

test("helper de enviados/geraveis filtra pelo tipo correto", () => {
  const applicant = applicantRequirementsForProcess("CONCESSAO_CR");
  assert.ok(applicant.every((requirement) => requirement.type === "ENVIADO_PELO_SOLICITANTE"));
  const generated = systemGeneratedRequirementsForProcess("CONCESSAO_CR");
  assert.ok(generated.every((requirement) => requirement.type === "GERAVEL_PELO_SISTEMA"));
  // Autorizacao/CRAF/Guia nao tem documentos geraveis pelo sistema.
  assert.equal(systemGeneratedRequirementsForProcess("AUTORIZACAO_COMPRA").length, 0);
  assert.equal(systemGeneratedRequirementsForProcess("GUIA_TRAFEGO").length, 0);
});

test("resumo de requisitos existe para os 4 processos e soma bate com o total", () => {
  for (const code of LAUNCH_PROCESS_CODES) {
    const summary = requirementSummaryForProcess(code);
    assert.equal(summary.total, documentRequirementsForProcess(code).length, code);
    const somaPorTipo = REQUIREMENT_TYPES.reduce((acc, type) => acc + summary.byType[type], 0);
    assert.equal(somaPorTipo, summary.total, `${code}: soma por tipo == total`);
    assert.ok(summary.total > 0, `${code} tem requisitos`);
  }
});

test("resumo do CR conta enviados (12), geraveis (5) e total (17)", () => {
  const summary = requirementSummaryForProcess("CONCESSAO_CR");
  assert.equal(summary.byType.ENVIADO_PELO_SOLICITANTE, 12);
  assert.equal(summary.byType.GERAVEL_PELO_SISTEMA, 5);
  assert.equal(summary.byType.DERIVADO_DO_PROCESSO, 0);
  assert.equal(summary.byType.COMPLEMENTAR, 0);
  assert.equal(summary.total, 17);
  assert.equal(summary.requiredCount, 17);
});

test("resumo de Autorizacao/CRAF/Guia com os tipos esperados", () => {
  const autorizacao = requirementSummaryForProcess("AUTORIZACAO_COMPRA");
  assert.equal(autorizacao.byType.ENVIADO_PELO_SOLICITANTE, 4);
  assert.equal(autorizacao.byType.DERIVADO_DO_PROCESSO, 1);

  const craf = requirementSummaryForProcess("EMISSAO_CRAF");
  assert.equal(craf.byType.ENVIADO_PELO_SOLICITANTE, 4);
  assert.equal(craf.byType.DERIVADO_DO_PROCESSO, 1);

  const guia = requirementSummaryForProcess("GUIA_TRAFEGO");
  assert.equal(guia.byType.ENVIADO_PELO_SOLICITANTE, 4);
  assert.equal(guia.byType.COMPLEMENTAR, 1);
  // So a identificacao e obrigatoria no fluxo real.
  assert.equal(guia.requiredCount, 1);
});

test("resumo do processo desconhecido e zerado, sem quebrar", () => {
  const summary = requirementSummaryForProcess("NAO_EXISTE");
  assert.equal(summary.total, 0);
  assert.equal(summary.requiredCount, 0);
  for (const type of REQUIREMENT_TYPES) assert.equal(summary.byType[type], 0, type);
});

test("processo desconhecido nao quebra e retorna vazio", () => {
  assert.deepEqual([...documentRequirementsForProcess("NAO_EXISTE")], []);
  assert.deepEqual([...requiredRequirementsForProcess("NAO_EXISTE")], []);
  assert.deepEqual([...applicantRequirementsForProcess("NAO_EXISTE")], []);
  assert.deepEqual([...systemGeneratedRequirementsForProcess("NAO_EXISTE")], []);
  assert.equal(countRequirementsForProcess("NAO_EXISTE"), 0);
});

/** Trava estatica: o dominio e PURO. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o dominio de requisitos nao acessa banco, rede, OCR nem IA", () => {
  const code = codeOnly(
    readFileSync("src/server/processes/processDocumentRequirements.ts", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "e puro, sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, "nao faz requisicao");
  assert.doesNotMatch(code, /https?:\/\//, "nao tem URL externa");
  assert.doesNotMatch(
    code,
    /(?:import|require)[^;\n]*["'][^"']*(?:tesseract|ocr|openai|anthropic|vision)/i,
    "nao importa OCR/IA",
  );
});
