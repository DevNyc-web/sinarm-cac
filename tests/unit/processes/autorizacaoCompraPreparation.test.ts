/**
 * Preparacao (inerte) da Autorizacao de Compra — testes do descritor puro.
 * Sem OCR, sem IA, sem rede, sem banco, sem PII. NAO libera fluxo real.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  getAutorizacaoCompraPreparation,
  type PceFieldSpec,
} from "../../../src/server/processes/autorizacaoCompraPreparation";
import { gruFeeCentsOf } from "../../../src/server/processes/processCatalog";
import { documentRequirementsForProcess } from "../../../src/server/processes/processDocumentRequirements";

const prep = getAutorizacaoCompraPreparation();
const pathByKey = new Map(prep.pcePreparation.map((path) => [path.key, path]));

function pceKeys(pathKey: string): string[] {
  return (pathByKey.get(pathKey as "ACESSORIO" | "ARMA_DE_FOGO")?.fields ?? []).map((f) => f.key);
}

test("identidade e taxa vem do catalogo", () => {
  assert.equal(prep.catalogCode, "AUTORIZACAO_COMPRA");
  assert.equal(prep.name, "Autorização de Compra");
  assert.equal(prep.gruFeeCents, 2500);
  assert.equal(prep.gruFeeCents, gruFeeCentsOf("AUTORIZACAO_COMPRA"));
});

test("depende da Concessao de CR e continua bloqueada", () => {
  assert.ok(prep.dependsOn.includes("CONCESSAO_CR"));
  assert.equal(prep.available, false);
  assert.equal(prep.canCreate, false);
});

test("service tem servico, atividade e PCE padrao esperados", () => {
  assert.equal(prep.service.service, "Autorizar aquisição de arma de fogo");
  assert.equal(prep.service.defaultActivity, "Tiro Desportivo - Atirador Desportivo");
  assert.equal(prep.service.defaultPceType, "Arma de Fogo");
});

test("requirements REUSAM os 5 do dominio, sem expandir para os 12", () => {
  const domain = documentRequirementsForProcess("AUTORIZACAO_COMPRA");
  assert.deepEqual(prep.requirements, domain);
  assert.equal(prep.requirements.length, domain.length);
  // Sanidade: os 5 atuais (nao os 12 detalhados da memoria).
  assert.equal(prep.requirements.length, 5);
});

test("TODOS os requirements permanecem futureStage:true (nenhum ativo)", () => {
  assert.ok(prep.requirements.length > 0);
  assert.ok(prep.requirements.every((r) => r.futureStage === true));
});

test("pcePreparation contem ACESSORIO e ARMA_DE_FOGO", () => {
  assert.deepEqual(
    prep.pcePreparation.map((p) => p.key),
    ["ACESSORIO", "ARMA_DE_FOGO"],
  );
});

test("campos esperados do caminho ACESSORIO existem", () => {
  const keys = pceKeys("ACESSORIO");
  for (const key of [
    "complemento",
    "descricao_produto",
    "especie",
    "marca",
    "modelo",
    "pais_fabricacao",
    "fornecedor_cnpj",
  ]) {
    assert.ok(keys.includes(key), `ACESSORIO deve ter ${key}`);
  }
});

test("campos esperados do caminho ARMA_DE_FOGO existem", () => {
  const keys = pceKeys("ARMA_DE_FOGO");
  for (const key of [
    "tipo_pce",
    "grupo_pce",
    "complemento",
    "numero_arma",
    "modelo",
    "calibre",
    "especie",
    "marca",
    "grupo_calibre",
    "pais_fabricacao",
    "total_carregadores",
    "capacidade_cartuchos",
    "numero_canos",
    "alma_cano",
    "unidade_comprimento_cano",
    "comprimento_cano",
    "numero_raias",
    "sentido_raias",
    "acabamento",
    "funcionamento",
    "fornecedor_cnpj",
  ]) {
    assert.ok(keys.includes(key), `ARMA_DE_FOGO deve ter ${key}`);
  }
});

test("nenhum field PCE tem value/options e so usa chaves permitidas", () => {
  const allowedKeys = ["key", "label", "futureStage", "note"];
  const allFields: PceFieldSpec[] = prep.pcePreparation.flatMap((p) => [...p.fields]);
  assert.ok(allFields.length > 0);
  for (const f of allFields) {
    assert.ok(!("value" in f), `campo ${f.key} nao deve ter 'value'`);
    assert.ok(!("options" in f), `campo ${f.key} nao deve ter 'options'`);
    assert.equal(f.futureStage, true);
    for (const prop of Object.keys(f)) {
      assert.ok(allowedKeys.includes(prop), `campo ${f.key}: propriedade inesperada '${prop}'`);
    }
  }
});

/** Trava estatica: dominio puro/inerte — sem I/O, rede, criacao, UI ou opcoes hardcoded. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o modulo e puro/inerte e NAO hardcoda listas de opcoes", () => {
  const code = codeOnly(
    readFileSync("src/server/processes/autorizacaoCompraPreparation.ts", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client|\bprisma\b/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede/URL externa");
  assert.doesNotMatch(code, /\bcreate\(|\bupdate\(|\bupsert\(|\bdelete\(/, "sem escrita");
  assert.doesNotMatch(code, /\baction\b|\bform\b/i, "sem action/form");
  assert.doesNotMatch(code, /\bpassword\b|\bsenha\b|\btoken\b|\bcookie\b/i, "sem credencial");
  // Nada de enumeracao de opcoes (marca/calibre/especie): sem propriedade options.
  assert.doesNotMatch(code, /\boptions\b/, "sem listas de opcoes hardcoded");
});
