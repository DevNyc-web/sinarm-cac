/**
 * Catalogo dos processos de lancamento — testes do dominio puro.
 * Sem OCR, sem IA, sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  EASE_ORDER,
  LAUNCH_PROCESS_CODES,
  LOGICAL_ORDER,
  applicantDocumentsOf,
  dependenciesOf,
  getProcessDefinition,
  gruFeeCentsOf,
  isLaunchProcessCode,
  listProcessesByEase,
  listProcessesInLogicalOrder,
  prerequisiteChainOf,
  systemGeneratedDocumentsOf,
} from "../../../src/server/processes/processCatalog";

test("existem exatamente 4 processos", () => {
  assert.equal(LAUNCH_PROCESS_CODES.length, 4);
  assert.deepEqual(
    [...LAUNCH_PROCESS_CODES],
    ["CONCESSAO_CR", "AUTORIZACAO_COMPRA", "EMISSAO_CRAF", "GUIA_TRAFEGO"],
  );
});

test("as taxas de GRU estao corretas (em centavos)", () => {
  assert.equal(gruFeeCentsOf("CONCESSAO_CR"), 10_000);
  assert.equal(gruFeeCentsOf("AUTORIZACAO_COMPRA"), 2_500);
  assert.equal(gruFeeCentsOf("EMISSAO_CRAF"), 8_800);
  assert.equal(gruFeeCentsOf("GUIA_TRAFEGO"), 2_000);
});

test("a ordem logica (dependencia do cliente) esta correta", () => {
  assert.deepEqual(
    [...LOGICAL_ORDER],
    ["CONCESSAO_CR", "AUTORIZACAO_COMPRA", "EMISSAO_CRAF", "GUIA_TRAFEGO"],
  );
  assert.deepEqual(
    listProcessesInLogicalOrder().map((process) => process.code),
    ["CONCESSAO_CR", "AUTORIZACAO_COMPRA", "EMISSAO_CRAF", "GUIA_TRAFEGO"],
  );
});

test("a ordem por facilidade de automacao esta correta", () => {
  assert.deepEqual(
    [...EASE_ORDER],
    ["GUIA_TRAFEGO", "EMISSAO_CRAF", "CONCESSAO_CR", "AUTORIZACAO_COMPRA"],
  );
  assert.deepEqual(
    listProcessesByEase().map((process) => process.code),
    ["GUIA_TRAFEGO", "EMISSAO_CRAF", "CONCESSAO_CR", "AUTORIZACAO_COMPRA"],
  );
});

test("dependencia da Guia de Trafego e o CRAF", () => {
  assert.deepEqual([...dependenciesOf("GUIA_TRAFEGO")], ["EMISSAO_CRAF"]);
});

test("dependencia do CRAF e a Autorizacao de Compra", () => {
  assert.deepEqual([...dependenciesOf("EMISSAO_CRAF")], ["AUTORIZACAO_COMPRA"]);
});

test("dependencia da Autorizacao de Compra e a Concessao de CR", () => {
  assert.deepEqual([...dependenciesOf("AUTORIZACAO_COMPRA")], ["CONCESSAO_CR"]);
});

test("a Concessao de CR nao depende de nenhum processo anterior", () => {
  assert.deepEqual([...dependenciesOf("CONCESSAO_CR")], []);
});

test("cadeia completa de pre-requisitos da Guia respeita a ordem logica", () => {
  assert.deepEqual(prerequisiteChainOf("GUIA_TRAFEGO"), [
    "CONCESSAO_CR",
    "AUTORIZACAO_COMPRA",
    "EMISSAO_CRAF",
  ]);
  assert.deepEqual(prerequisiteChainOf("CONCESSAO_CR"), []);
});

test("Concessao de CR exige cadastro inicial; Guia nao exige", () => {
  assert.equal(getProcessDefinition("CONCESSAO_CR")?.requiresInitialRegistration, true);
  assert.equal(getProcessDefinition("GUIA_TRAFEGO")?.requiresInitialRegistration, false);
  assert.equal(getProcessDefinition("AUTORIZACAO_COMPRA")?.requiresInitialRegistration, false);
  assert.equal(getProcessDefinition("EMISSAO_CRAF")?.requiresInitialRegistration, false);
});

test("Concessao de CR contem documentos enviados pelo solicitante", () => {
  const docs = applicantDocumentsOf("CONCESSAO_CR");
  assert.equal(docs.length, 12);
  assert.ok(docs.includes("RG"));
  assert.ok(docs.includes("Laudo psicológico válido"));
  assert.ok(docs.includes("Declaração de Comprometimento ao Clube"));
});

test("Concessao de CR contem documentos geraveis pelo sistema", () => {
  const docs = systemGeneratedDocumentsOf("CONCESSAO_CR");
  assert.equal(docs.length, 5);
  assert.ok(docs.includes("Antecedente eleitoral"));
  assert.ok(docs.includes("Antecedente federal"));
});

test("os requisitos principais dos demais processos estao presentes", () => {
  assert.ok(getProcessDefinition("AUTORIZACAO_COMPRA")?.keyRequirements.includes("Escolha de atividade"));
  assert.ok(getProcessDefinition("EMISSAO_CRAF")?.keyRequirements.includes("Nota fiscal de aquisição"));
  assert.ok(getProcessDefinition("GUIA_TRAFEGO")?.keyRequirements.includes("Endereço de destino"));
});

test("busca por tipo desconhecido retorna undefined (erro controlado)", () => {
  assert.equal(getProcessDefinition("NAO_EXISTE"), undefined);
  assert.equal(getProcessDefinition(""), undefined);
  assert.equal(isLaunchProcessCode("NAO_EXISTE"), false);
  assert.equal(isLaunchProcessCode("GUIA_TRAFEGO"), true);
  // Helpers derivados sao tolerantes ao desconhecido.
  assert.equal(gruFeeCentsOf("NAO_EXISTE"), undefined);
  assert.deepEqual([...dependenciesOf("NAO_EXISTE")], []);
  assert.deepEqual([...applicantDocumentsOf("NAO_EXISTE")], []);
});

test("cada definicao e consistente com seu proprio codigo", () => {
  for (const code of LAUNCH_PROCESS_CODES) {
    const definition = getProcessDefinition(code);
    assert.ok(definition, `definicao de ${code}`);
    assert.equal(definition?.code, code);
    assert.ok((definition?.gruFeeCents ?? 0) > 0, `${code} tem taxa > 0`);
    assert.ok((definition?.name.length ?? 0) > 0, `${code} tem nome`);
  }
});

/** Trava estatica: o catalogo e PURO. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o catalogo nao acessa banco, rede, OCR nem IA", () => {
  const code = codeOnly(readFileSync("src/server/processes/processCatalog.ts", "utf8"));
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "e puro, sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, "nao faz requisicao");
  assert.doesNotMatch(code, /https?:\/\//, "nao tem URL externa");
  assert.doesNotMatch(
    code,
    /(?:import|require)[^;\n]*["'][^"']*(?:tesseract|ocr|openai|anthropic|vision)/i,
    "nao importa OCR/IA",
  );
});
