/**
 * Fundacao de documentos — testes dos TIPOS de documento.
 * node:test + node:assert via tsx (sem dependencia nova).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABELS,
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

test("ponte de persistência mapeia para o enum Prisma sem alterar schema", () => {
  assert.equal(toPrismaDocumentType("IDENTIFICACAO_PESSOAL"), "IDENTIFICACAO_PESSOAL");
  assert.equal(toPrismaDocumentType("CR_REGISTRO_CAC"), "OUTRO");
  assert.equal(toPrismaDocumentType("DECLARACAO_DESTINO_EVENTO"), "OUTRO");
  assert.equal(toPrismaDocumentType("COMPLEMENTAR"), "OUTRO");
});
