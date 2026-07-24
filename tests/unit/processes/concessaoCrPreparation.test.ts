/**
 * Preparacao (inerte) da Concessao de CR — testes do descritor de dominio puro.
 * Sem OCR, sem IA, sem rede, sem banco. NAO libera criacao real de CR.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getConcessaoCrPreparation } from "../../../src/server/processes/concessaoCrPreparation";
import {
  dependenciesOf,
  getProcessDefinition,
  gruFeeCentsOf,
} from "../../../src/server/processes/processCatalog";
import {
  applicantRequirementsForProcess,
  systemGeneratedRequirementsForProcess,
} from "../../../src/server/processes/processDocumentRequirements";

test("catalogCode e CONCESSAO_CR e name vem do catalogo", () => {
  const prep = getConcessaoCrPreparation();
  assert.equal(prep.catalogCode, "CONCESSAO_CR");
  assert.equal(prep.name, getProcessDefinition("CONCESSAO_CR")?.name);
});

test("gruFeeCents e dependsOn batem com o catalogo", () => {
  const prep = getConcessaoCrPreparation();
  assert.equal(prep.gruFeeCents, gruFeeCentsOf("CONCESSAO_CR"));
  assert.deepEqual(prep.dependsOn, dependenciesOf("CONCESSAO_CR"));
});

test("CR continua bloqueada: available e canCreate sao false", () => {
  const prep = getConcessaoCrPreparation();
  assert.equal(prep.available, false);
  assert.equal(prep.canCreate, false);
});

test("requisitos reutilizam os helpers existentes (solicitante e sistema)", () => {
  const prep = getConcessaoCrPreparation();
  assert.deepEqual(prep.applicantRequirements, applicantRequirementsForProcess("CONCESSAO_CR"));
  assert.deepEqual(
    prep.systemGeneratedRequirements,
    systemGeneratedRequirementsForProcess("CONCESSAO_CR"),
  );
  // Sanidade: ha requisitos preparados dos dois lados.
  assert.ok(prep.applicantRequirements.length > 0);
  assert.ok(prep.systemGeneratedRequirements.length > 0);
});

test("TODOS os requisitos de CR permanecem futureStage:true (nenhum ativo)", () => {
  const prep = getConcessaoCrPreparation();
  const all = [...prep.applicantRequirements, ...prep.systemGeneratedRequirements];
  assert.ok(all.length > 0);
  assert.ok(all.every((requirement) => requirement.futureStage === true));
  assert.equal(all.filter((requirement) => requirement.futureStage === false).length, 0);
});

test("o descritor nao inventa campos novos (so o contrato esperado)", () => {
  const prep = getConcessaoCrPreparation();
  assert.deepEqual(
    Object.keys(prep).sort(),
    [
      "applicantRequirements",
      "available",
      "canCreate",
      "catalogCode",
      "dependsOn",
      "gruFeeCents",
      "name",
      "systemGeneratedRequirements",
    ].sort(),
  );
});

/** Trava estatica: dominio puro/inerte — sem I/O, sem rede, sem criacao. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o modulo e puro e inerte (sem Prisma/rede/criacao/UI)", () => {
  const code = codeOnly(
    readFileSync("src/server/processes/concessaoCrPreparation.ts", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client|\bprisma\b/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede/URL externa");
  assert.doesNotMatch(code, /\bcreate\(|\bupdate\(|\bupsert\(|\bdelete\(/, "sem escrita/persistencia");
  assert.doesNotMatch(code, /\baction\b|\bform\b/i, "sem action/form");
});
