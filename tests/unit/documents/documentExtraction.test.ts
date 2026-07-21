/**
 * Fundacao de documentos — testes do CONTRATO de extracao (sem OCR real).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXTRACTABLE_FIELDS,
  EXTRACTION_STATES,
  EXTRACTION_STATE_LABELS,
  demoExtractionExample,
  emptyExtraction,
} from "../../../src/server/documents/documentExtractionTypes";

test("estados de extração cobrem o ciclo pedido", () => {
  for (const s of [
    "NAO_INICIADA",
    "PENDENTE",
    "EXTRAIDA",
    "PRECISA_REVISAO",
    "CONFIRMADA",
    "FALHOU",
  ] as const) {
    assert.ok(EXTRACTION_STATES.includes(s), `falta estado ${s}`);
    assert.equal(typeof EXTRACTION_STATE_LABELS[s], "string");
  }
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
