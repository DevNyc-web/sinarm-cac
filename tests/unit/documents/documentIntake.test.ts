/**
 * Modulo de documentos — testes da derivacao de estado por documento esperado.
 * Funcao pura: sem banco, sem OCR/IA, sem rede.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveRequirementState,
  type IntakeDocument,
} from "../../../src/server/documents/documentIntake";
import { guiaTrafegoRequirements } from "../../../src/server/documents/documentRequirements";

function doc(partial: Partial<IntakeDocument> & Pick<IntakeDocument, "type">): IntakeDocument {
  return {
    status: "ENVIADO",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    rejectionReason: null,
    ...partial,
  };
}

test("sem documentos, todo requisito fica pendente", () => {
  for (const req of guiaTrafegoRequirements()) {
    const result = resolveRequirementState(req.kind, []);
    assert.equal(result.state, "PENDENTE");
    assert.equal(result.pending, true);
  }
});

test("documento enviado marca apenas o requisito do próprio tipo", () => {
  const documents = [doc({ type: "CR_REGISTRO_CAC" })];

  const cr = resolveRequirementState("CR_REGISTRO_CAC", documents);
  assert.equal(cr.state, "ENVIADO");
  assert.equal(cr.pending, false);

  // Os outros cards continuam pendentes — nada de status vazando entre tipos.
  assert.equal(resolveRequirementState("IDENTIFICACAO_PESSOAL", documents).state, "PENDENTE");
  assert.equal(resolveRequirementState("DECLARACAO_DESTINO_EVENTO", documents).state, "PENDENTE");
});

test("cada tipo esperado é reconhecido quando anexado", () => {
  for (const req of guiaTrafegoRequirements()) {
    const documents = [
      doc({ type: req.kind === "COMPLEMENTAR" ? "OUTRO" : req.kind, status: "APROVADO" }),
    ];
    const result = resolveRequirementState(req.kind, documents);
    assert.equal(result.state, "APROVADO", `${req.kind} deve refletir o arquivo anexado`);
    assert.equal(result.pending, false);
  }
});

test("rejeição expõe o motivo; outros estados não", () => {
  const rejeitado = resolveRequirementState("IDENTIFICACAO_PESSOAL", [
    doc({
      type: "IDENTIFICACAO_PESSOAL",
      status: "REJEITADO",
      rejectionReason: "Imagem ilegível",
    }),
  ]);
  assert.equal(rejeitado.state, "REJEITADO");
  assert.equal(rejeitado.rejection, "Imagem ilegível");
  assert.equal(rejeitado.pending, false, "rejeitado oferece Substituir, não Anexar");

  const aprovado = resolveRequirementState("IDENTIFICACAO_PESSOAL", [
    doc({ type: "IDENTIFICACAO_PESSOAL", status: "APROVADO", rejectionReason: "sobra antiga" }),
  ]);
  assert.equal(aprovado.rejection, null);
});

test("substituição: vale o arquivo mais recente", () => {
  const documents = [
    doc({
      type: "IDENTIFICACAO_PESSOAL",
      status: "REJEITADO",
      rejectionReason: "Imagem ilegível",
      createdAt: new Date("2026-01-01T10:00:00Z"),
    }),
    doc({
      type: "IDENTIFICACAO_PESSOAL",
      status: "ENVIADO",
      createdAt: new Date("2026-01-02T10:00:00Z"),
    }),
  ];
  const result = resolveRequirementState("IDENTIFICACAO_PESSOAL", documents);
  assert.equal(result.state, "ENVIADO");
  assert.equal(result.rejection, null);
});
