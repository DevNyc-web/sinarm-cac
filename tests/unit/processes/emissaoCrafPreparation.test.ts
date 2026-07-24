/**
 * Preparacao (inerte) da Emissao de CRAF — testes do descritor puro.
 * Sem OCR, sem IA, sem rede, sem banco, sem PII. NAO libera fluxo real.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  getEmissaoCrafPreparation,
  type CrafFieldSpec,
} from "../../../src/server/processes/emissaoCrafPreparation";
import { gruFeeCentsOf } from "../../../src/server/processes/processCatalog";
import { documentRequirementsForProcess } from "../../../src/server/processes/processDocumentRequirements";

const prep = getEmissaoCrafPreparation();

test("identidade e taxa vem do catalogo", () => {
  assert.equal(prep.catalogCode, "EMISSAO_CRAF");
  assert.equal(prep.name, "Emissão de CRAF");
  assert.equal(prep.gruFeeCents, 8800);
  assert.equal(prep.gruFeeCents, gruFeeCentsOf("EMISSAO_CRAF"));
});

test("depende da Autorizacao de Compra e continua bloqueada", () => {
  assert.ok(prep.dependsOn.includes("AUTORIZACAO_COMPRA"));
  assert.equal(prep.available, false);
  assert.equal(prep.canCreate, false);
});

test("service tem servico, atividade e PCE padrao esperados", () => {
  assert.equal(prep.service.service, "Registrar Arma com Emissão de CRAF");
  assert.equal(prep.service.defaultActivity, "Tiro Desportivo - Atirador Desportivo");
  assert.equal(prep.service.defaultPceType, "Arma de Fogo");
});

test("requirements REUSAM os do dominio e incluem a Nota fiscal", () => {
  const domain = documentRequirementsForProcess("EMISSAO_CRAF");
  assert.deepEqual(prep.requirements, domain);
  assert.equal(prep.requirements.length, 5);
  assert.ok(prep.requirements.some((r) => r.label === "Nota fiscal de aquisição"));
});

test("TODOS os requirements permanecem futureStage:true (nenhum ativo)", () => {
  assert.ok(prep.requirements.length > 0);
  assert.ok(prep.requirements.every((r) => r.futureStage === true));
});

test("authorizationData tem os 4 campos esperados, sem value/options", () => {
  const keys = prep.authorizationData.map((f) => f.key);
  assert.deepEqual(keys, ["numero_autorizacao", "sfpc", "data_autorizacao", "data_validade"]);

  const allowedKeys = ["key", "label", "futureStage", "note"];
  for (const f of prep.authorizationData as CrafFieldSpec[]) {
    assert.equal(f.futureStage, true);
    assert.ok(!("value" in f), `campo ${f.key} nao deve ter 'value'`);
    assert.ok(!("options" in f), `campo ${f.key} nao deve ter 'options'`);
    for (const prop of Object.keys(f)) {
      assert.ok(allowedKeys.includes(prop), `campo ${f.key}: propriedade inesperada '${prop}'`);
    }
  }
});

test("pceReference e so nota de reaproveitamento, sem remodelar os 21 campos", () => {
  assert.ok(prep.pceReference);
  assert.match(prep.pceReference.note, /reaproveitad/i);
  assert.match(prep.pceReference.note, /Autorização de Compra/);
  // So a nota — nenhuma estrutura de campos de Arma de Fogo foi duplicada.
  assert.deepEqual(Object.keys(prep.pceReference), ["note"]);
  const ref = prep.pceReference as unknown as Record<string, unknown>;
  assert.ok(!("fields" in ref) && !("pcePreparation" in ref) && !("paths" in ref));
  // Labels exclusivos do PCE de Arma de Fogo nao aparecem no descritor do CRAF.
  const serialized = JSON.stringify(prep);
  assert.ok(!serialized.includes("Alma do cano"));
  assert.ok(!serialized.includes("Sentido das raias"));
});

/** Trava estatica: dominio puro/inerte — sem I/O, rede, criacao, UI, opcoes ou credencial. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o modulo e puro/inerte e NAO importa o modulo da Autorizacao", () => {
  const code = codeOnly(
    readFileSync("src/server/processes/emissaoCrafPreparation.ts", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client|\bprisma\b/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede/URL externa");
  assert.doesNotMatch(code, /\bcreate\(|\bupdate\(|\bupsert\(|\bdelete\(/, "sem escrita");
  assert.doesNotMatch(code, /\baction\b|\bform\b/i, "sem action/form");
  assert.doesNotMatch(code, /\bpassword\b|\bsenha\b|\btoken\b|\bcookie\b/i, "sem credencial");
  assert.doesNotMatch(code, /\boptions\b/, "sem listas de opcoes");
  // Nao acopla ao modulo da Autorizacao (PCE e so referencia).
  assert.doesNotMatch(code, /getAutorizacaoCompraPreparation|autorizacaoCompraPreparation/, "sem import da Autorizacao");
});
