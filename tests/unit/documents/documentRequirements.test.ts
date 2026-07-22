/**
 * Fundacao de documentos — testes dos REQUISITOS por processo.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GUIA_TRAFEGO_PROCESS_CODE,
  REQUIREMENT_TIER_LABELS,
  documentRequirementsFor,
  guiaTrafegoRequirements,
} from "../../../src/server/documents/documentRequirements";
import {
  isDocumentKind,
  toPrismaDocumentType,
} from "../../../src/server/documents/documentTypes";

test("requisitos de Guia de Tráfego retornam pelo código do processo", () => {
  const byCode = documentRequirementsFor(GUIA_TRAFEGO_PROCESS_CODE);
  assert.ok(byCode.length > 0);
  assert.deepEqual(byCode, guiaTrafegoRequirements());
});

test("identificação é o único obrigatório do MVP; demais não são obrigatórios", () => {
  const reqs = guiaTrafegoRequirements();
  const ident = reqs.find((r) => r.kind === "IDENTIFICACAO_PESSOAL");
  assert.ok(ident);
  assert.equal(ident?.tier, "OBRIGATORIO_MVP");

  const obrigatorios = reqs.filter((r) => r.tier === "OBRIGATORIO_MVP");
  assert.equal(obrigatorios.length, 1, "só a identificação é obrigatória no MVP");
  // separação de tiers: existe ao menos um 'a confirmar'
  assert.ok(reqs.some((r) => r.tier === "PENDENTE_VALIDACAO"));
});

test("todo requisito tem título, ajuda e tier com rótulo", () => {
  for (const req of guiaTrafegoRequirements()) {
    assert.ok(req.title.length > 0);
    assert.ok(req.help.length > 0);
    assert.equal(typeof REQUIREMENT_TIER_LABELS[req.tier], "string");
  }
});

test("todo requisito é anexável: tipo válido e persistível", () => {
  for (const req of guiaTrafegoRequirements()) {
    assert.ok(isDocumentKind(req.kind), `${req.kind} deve ser um tipo de domínio válido`);
    // Nao basta ser valido: precisa ter destino no enum Prisma para o upload gravar.
    assert.ok(toPrismaDocumentType(req.kind).length > 0);
  }
});

test("cada requisito ocupa um tipo persistido distinto", () => {
  const types = guiaTrafegoRequirements().map((req) => toPrismaDocumentType(req.kind));
  assert.equal(new Set(types).size, types.length, "dois cards não podem gravar o mesmo tipo");
});

test("código de processo desconhecido retorna lista vazia", () => {
  assert.deepEqual(documentRequirementsFor("PROCESSO_INEXISTENTE"), []);
});
