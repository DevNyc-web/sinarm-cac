/**
 * Fundacao de documentos — testes do CONTRATO de extracao (sem OCR real).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXTRACTABLE_FIELDS,
  EXTRACTION_STATES,
  EXTRACTION_STATE_LABELS,
  NO_EXTRACTION_STATE,
  demoExtractionExample,
  emptyExtraction,
  extractionStateLabel,
} from "../../../src/server/documents/documentExtractionTypes";

test("estados de extração cobrem o ciclo pedido", () => {
  // A partir do PR #47A os estados sao PERSISTIDOS (paridade com o enum Prisma).
  // "Sem tentativa" deixou de ser estado e virou AUSENCIA DE LINHA — por isso
  // NAO_INICIADA saiu daqui e virou marcador de dominio (`NO_EXTRACTION_STATE`).
  for (const s of [
    "PENDENTE",
    "PROCESSANDO",
    "EXTRAIDA",
    "PRECISA_REVISAO",
    "CONFIRMADA",
    "FALHOU",
  ] as const) {
    assert.ok(EXTRACTION_STATES.includes(s), `falta estado ${s}`);
    assert.equal(typeof EXTRACTION_STATE_LABELS[s], "string");
  }
});

test("NAO_INICIADA não é estado persistido", () => {
  assert.ok(!(EXTRACTION_STATES as readonly string[]).includes(NO_EXTRACTION_STATE));
  assert.equal(extractionStateLabel(NO_EXTRACTION_STATE), "Não iniciada");
});

test("campos extraíveis futuros incluem os previstos", () => {
  for (const f of [
    "nome",
    "cpf",
    "rg",
    "endereco",
    "validade",
    "numeroRegistroCR",
    "dadosDocumento",
    "dadosArmaPce",
  ] as const) {
    assert.ok(EXTRACTABLE_FIELDS.includes(f), `falta campo ${f}`);
  }
});

test("extração vazia é o estado honesto de hoje (sem OCR, sem arquivo)", () => {
  const result = emptyExtraction();
  assert.equal(result.status, "NAO_INICIADA");
  assert.deepEqual(result.fields, []);
  assert.match(result.note, /não habilitada/i);
});

test("exemplo de demonstração é puro e não depende de OCR/arquivo real", () => {
  // Chamada síncrona, sem I/O — se dependesse de OCR/rede não retornaria assim.
  const result = demoExtractionExample();
  assert.ok(result.fields.length > 0);
  for (const field of result.fields) {
    assert.equal(typeof field.label, "string");
    assert.ok(field.status === "pendente_conferencia" || field.status === "confirmado");
  }
  assert.match(result.note, /conferidos antes|não habilitada/i);
});
