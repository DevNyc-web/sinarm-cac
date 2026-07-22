/**
 * Fundacao de documentos — testes dos TIPOS de documento.
 * node:test + node:assert via tsx (sem dependencia nova).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABELS,
  fromPrismaDocumentType,
  isDocumentKind,
  toPrismaDocumentType,
} from "../../../src/server/documents/documentTypes";

test("Guia de Trafego expõe os tipos de documento esperados", () => {
  assert.ok(DOCUMENT_KINDS.includes("IDENTIFICACAO_PESSOAL"));
  assert.ok(DOCUMENT_KINDS.includes("CR_REGISTRO_CAC"));
  assert.ok(DOCUMENT_KINDS.includes("COMPROVANTE_ORIGEM_ENDERECO"));
  assert.ok(DOCUMENT_KINDS.includes("DECLARACAO_DESTINO_EVENTO"));
  assert.ok(DOCUMENT_KINDS.includes("COMPLEMENTAR"));
});

test("todo tipo de documento tem rótulo amigável", () => {
  for (const kind of DOCUMENT_KINDS) {
    const label = DOCUMENT_KIND_LABELS[kind];
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0);
  }
});

test("cada tipo esperado tem valor próprio no enum Prisma", () => {
  assert.equal(toPrismaDocumentType("IDENTIFICACAO_PESSOAL"), "IDENTIFICACAO_PESSOAL");
  assert.equal(toPrismaDocumentType("CR_REGISTRO_CAC"), "CR_REGISTRO_CAC");
  assert.equal(toPrismaDocumentType("COMPROVANTE_ORIGEM_ENDERECO"), "COMPROVANTE_ORIGEM_ENDERECO");
  assert.equal(toPrismaDocumentType("DECLARACAO_DESTINO_EVENTO"), "DECLARACAO_DESTINO_EVENTO");
  // Unico tipo sem valor dedicado: persiste no generico ja existente.
  assert.equal(toPrismaDocumentType("COMPLEMENTAR"), "OUTRO");
});

test("tipos persistidos não colidem entre si", () => {
  const persisted = DOCUMENT_KINDS.map(toPrismaDocumentType);
  assert.equal(new Set(persisted).size, persisted.length, "cada tipo grava um valor distinto");
});

test("ida e volta domínio ↔ Prisma preserva o tipo", () => {
  for (const kind of DOCUMENT_KINDS) {
    assert.equal(fromPrismaDocumentType(toPrismaDocumentType(kind)), kind);
  }
});

test("valor de formulário é validado antes de virar tipo", () => {
  assert.equal(isDocumentKind("CR_REGISTRO_CAC"), true);
  assert.equal(isDocumentKind("OUTRO"), false, "OUTRO é valor Prisma, não tipo de domínio");
  assert.equal(isDocumentKind("QUALQUER_COISA"), false);
  assert.equal(isDocumentKind(null), false);
  assert.equal(isDocumentKind(42), false);
});
