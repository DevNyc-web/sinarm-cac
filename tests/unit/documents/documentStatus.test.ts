/**
 * Fundacao de documentos — testes dos STATUS de documento.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DOCUMENT_STATES,
  DOCUMENT_STATE_LABELS,
  fromPrismaDocumentStatus,
  isPersistedState,
} from "../../../src/server/documents/documentStatus";

test("estados de documento incluem os amigáveis pedidos", () => {
  for (const s of [
    "PENDENTE",
    "ENVIADO",
    "EM_ANALISE",
    "APROVADO",
    "REJEITADO",
    "SUBSTITUIR",
    "DISPENSADO",
  ] as const) {
    assert.ok(DOCUMENT_STATES.includes(s), `falta estado ${s}`);
  }
});

test("todo estado tem rótulo amigável", () => {
  for (const s of DOCUMENT_STATES) {
    assert.equal(typeof DOCUMENT_STATE_LABELS[s], "string");
    assert.ok(DOCUMENT_STATE_LABELS[s].length > 0);
  }
  assert.equal(DOCUMENT_STATE_LABELS.SUBSTITUIR, "Enviar nova versão");
  assert.equal(DOCUMENT_STATE_LABELS.DISPENSADO, "Dispensado");
});

test("SUBSTITUIR e DISPENSADO NÃO são persistidos (sem mudança de schema)", () => {
  assert.equal(isPersistedState("PENDENTE"), true);
  assert.equal(isPersistedState("APROVADO"), true);
  assert.equal(isPersistedState("SUBSTITUIR"), false);
  assert.equal(isPersistedState("DISPENSADO"), false);
});

test("status persistido do Prisma converte para estado de domínio", () => {
  assert.equal(fromPrismaDocumentStatus("APROVADO"), "APROVADO");
  assert.equal(fromPrismaDocumentStatus("REJEITADO"), "REJEITADO");
});
