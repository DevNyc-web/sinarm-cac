/**
 * Preparacao (inerte) do Cadastro Inicial — testes do descritor de dominio puro.
 * Sem OCR, sem IA, sem rede, sem banco, sem PII real. NAO libera fluxo real.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  getCadastroInicialPreparation,
  type CadastroInicialFieldSpec,
} from "../../../src/server/processes/cadastroInicialPreparation";

const prep = getCadastroInicialPreparation();
const groupByKey = new Map(prep.groups.map((group) => [group.key, group]));
const allFields: CadastroInicialFieldSpec[] = prep.groups.flatMap((group) => [...group.fields]);

function fieldKeys(groupKey: string): string[] {
  return (groupByKey.get(groupKey)?.fields ?? []).map((f) => f.key);
}

test("identidade do descritor: code/name/stage e gates bloqueados", () => {
  assert.equal(prep.code, "CADASTRO_INICIAL");
  assert.equal(prep.name, "Cadastro Inicial");
  assert.equal(prep.stage, "PREPARACAO");
  assert.equal(prep.available, false);
  assert.equal(prep.canCreate, false);
});

test("existem exatamente os 6 grupos esperados", () => {
  assert.deepEqual(
    prep.groups.map((group) => group.key),
    [
      "precondicao_govbr",
      "identidade",
      "eleitoral_profissional",
      "endereco_residencial",
      "segundo_endereco_acervo",
      "termo_aceite",
    ],
  );
});

test("apenas o segundo endereco de acervo e optional:true", () => {
  for (const group of prep.groups) {
    const expected = group.key === "segundo_endereco_acervo";
    assert.equal(group.optional, expected, `optional de ${group.key}`);
  }
});

test("campos de identidade existem", () => {
  const keys = fieldKeys("identidade");
  for (const key of [
    "rg_numero",
    "rg_data_expedicao",
    "rg_orgao_emissor",
    "rg_uf_emissao",
    "data_nascimento",
    "pais",
    "uf_nascimento",
    "cidade_nascimento",
    "nome_mae",
    "nome_pai",
  ]) {
    assert.ok(keys.includes(key), `identidade deve ter ${key}`);
  }
  const identidade = groupByKey.get("identidade");
  assert.ok(identidade?.fields.every((f) => f.source === "DOCUMENTO_IDENTIDADE"));
});

test("campos eleitorais/profissionais existem; outra profissao e opcional", () => {
  const group = groupByKey.get("eleitoral_profissional");
  const keys = fieldKeys("eleitoral_profissional");
  for (const key of ["titulo_eleitor", "profissao", "outra_profissao"]) {
    assert.ok(keys.includes(key), `eleitoral deve ter ${key}`);
  }
  const outra = group?.fields.find((f) => f.key === "outra_profissao");
  assert.equal(outra?.required, false, "outra profissao e opcional");
  assert.ok(group?.fields.every((f) => f.source === "INFORMADO_PELO_SOLICITANTE"));
});

test("endereco residencial: campos existem, complemento opcional, lat/long CONSULTA_FUTURA", () => {
  const group = groupByKey.get("endereco_residencial");
  const keys = fieldKeys("endereco_residencial");
  for (const key of [
    "cep",
    "logradouro",
    "uf",
    "cidade",
    "bairro",
    "numero",
    "complemento",
    "latitude",
    "longitude",
  ]) {
    assert.ok(keys.includes(key), `endereco deve ter ${key}`);
  }
  assert.equal(group?.fields.find((f) => f.key === "complemento")?.required, false);
  assert.equal(group?.fields.find((f) => f.key === "latitude")?.source, "CONSULTA_FUTURA");
  assert.equal(group?.fields.find((f) => f.key === "longitude")?.source, "CONSULTA_FUTURA");
});

test("segundo endereco de acervo: campos existem (inclui comprovante proprio)", () => {
  const keys = fieldKeys("segundo_endereco_acervo");
  for (const key of [
    "comprovante_segundo_endereco",
    "cep",
    "logradouro",
    "uf",
    "cidade",
    "bairro",
    "numero",
    "complemento",
    "latitude",
    "longitude",
  ]) {
    assert.ok(keys.includes(key), `2o endereco deve ter ${key}`);
  }
});

test("termo/aceite existe, obrigatorio", () => {
  const group = groupByKey.get("termo_aceite");
  const aceite = group?.fields.find((f) => f.key === "aceite_termo_responsabilidade");
  assert.ok(aceite, "aceite de termo existe");
  assert.equal(aceite?.required, true);
});

test("foto Gov.br existe como PRECONDICAO_GOVBR (pre-condicao, nao credencial)", () => {
  const group = groupByKey.get("precondicao_govbr");
  const foto = group?.fields.find((f) => f.key === "foto_govbr");
  assert.ok(foto, "foto Gov.br existe");
  assert.equal(foto?.source, "PRECONDICAO_GOVBR");
});

test("TODOS os campos sao futureStage:true (nenhum ativo)", () => {
  assert.ok(allFields.length > 0);
  assert.ok(allFields.every((f) => f.futureStage === true));
});

test("contrato SEM valores reais: nenhum campo tem propriedade de valor", () => {
  const allowedKeys = ["key", "label", "source", "required", "futureStage", "note"];
  for (const f of allFields) {
    assert.ok(!("value" in f), `campo ${f.key} nao deve ter 'value'`);
    for (const prop of Object.keys(f)) {
      assert.ok(allowedKeys.includes(prop), `campo ${f.key}: propriedade inesperada '${prop}'`);
    }
  }
});

/** Trava estatica: dominio puro/inerte — sem I/O, rede, criacao, UI ou credencial. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o modulo e puro e inerte (sem Prisma/rede/criacao/UI/credencial)", () => {
  const code = codeOnly(
    readFileSync("src/server/processes/cadastroInicialPreparation.ts", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client|\bprisma\b/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede/URL externa");
  assert.doesNotMatch(code, /\bcreate\(|\bupdate\(|\bupsert\(|\bdelete\(/, "sem escrita");
  assert.doesNotMatch(code, /\baction\b|\bform\b/i, "sem action/form");
  assert.doesNotMatch(code, /\bpassword\b|\bsenha\b|\btoken\b|\bcookie\b/i, "sem credencial");
});
