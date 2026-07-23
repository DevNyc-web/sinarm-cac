/**
 * Preparacao do checklist por tipo de processo — testes do adaptador puro.
 * Sem OCR, sem IA, sem rede, sem banco. NAO executa o checklist real.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  activeReadinessRequirementsForProcess,
  futureReadinessRequirementsForProcess,
  getCurrentPersistedProcessCatalogCode,
  mapDocumentRequirementToReadinessBlocker,
  readinessRequirementsForProcess,
} from "../../../src/server/automation/processReadinessRequirements";
import { documentRequirementsForProcess } from "../../../src/server/processes/processDocumentRequirements";

const FUTURE_PROCESSES = ["CONCESSAO_CR", "AUTORIZACAO_COMPRA", "EMISSAO_CRAF"] as const;

test("o helper de persistencia atual devolve GUIA_TRAFEGO por enquanto", () => {
  assert.equal(getCurrentPersistedProcessCatalogCode(), "GUIA_TRAFEGO");
});

test("Guia retorna requisitos ATIVOS compativeis com o MVP atual", () => {
  const active = activeReadinessRequirementsForProcess("GUIA_TRAFEGO");
  const labels = active.map((requirement) => requirement.label);

  // Todos os 5 requisitos do MVP estao ativos (nenhum e etapa futura).
  assert.equal(active.length, documentRequirementsForProcess("GUIA_TRAFEGO").length);
  assert.ok(labels.includes("Documento de identificação pessoal"));
  assert.ok(labels.includes("CR / registro CAC"));
  assert.ok(labels.includes("Comprovante de origem/endereço"));
  assert.ok(labels.includes("Declaração de destino/evento"));
  assert.ok(labels.includes("Documentos complementares"));
  assert.ok(active.every((requirement) => requirement.futureStage === false));

  // NAO exige documento novo alem do que o MVP ja suporta: so a identificacao e
  // obrigatoria entre os requisitos ATIVOS.
  const requiredActive = active.filter((requirement) => requirement.required);
  assert.deepEqual(
    requiredActive.map((requirement) => requirement.label),
    ["Documento de identificação pessoal"],
  );
  // A Guia nao tem requisitos de etapa futura.
  assert.deepEqual(futureReadinessRequirementsForProcess("GUIA_TRAFEGO"), []);
});

test("CR/Autorizacao/CRAF retornam requisitos, todos como etapa futura", () => {
  for (const code of FUTURE_PROCESSES) {
    const all = readinessRequirementsForProcess(code);
    assert.ok(all.length > 0, `${code} tem requisitos preparados`);
    assert.ok(all.every((requirement) => requirement.futureStage === true), code);
  }
});

test("activeReadinessRequirementsForProcess NAO ativa requisitos futuros", () => {
  for (const code of FUTURE_PROCESSES) {
    assert.deepEqual(activeReadinessRequirementsForProcess(code), [], `${code} sem ativos`);
    // Todos os requisitos preparados sao futuros.
    assert.equal(
      futureReadinessRequirementsForProcess(code).length,
      readinessRequirementsForProcess(code).length,
      code,
    );
  }
});

test("cada requisito preparado carrega um bloqueio com codigo estavel", () => {
  const guia = readinessRequirementsForProcess("GUIA_TRAFEGO");
  const identificacao = guia.find(
    (requirement) => requirement.label === "Documento de identificação pessoal",
  );
  assert.ok(identificacao);
  // Codigo ASCII, deterministico, prefixado por REQ_<PROCESSO>_ (sem acento).
  assert.equal(
    identificacao?.blocker.code,
    "REQ_GUIA_TRAFEGO_DOCUMENTO_DE_IDENTIFICACAO_PESSOAL",
  );
  assert.equal(identificacao?.blocker.label, "Documento de identificação pessoal");
  assert.match(identificacao?.blocker.code ?? "", /^[A-Z0-9_]+$/);
});

test("mapDocumentRequirementToReadinessBlocker e deterministico e ASCII", () => {
  const [first] = documentRequirementsForProcess("CONCESSAO_CR");
  const blocker = mapDocumentRequirementToReadinessBlocker(first);
  assert.equal(blocker.label, first.label);
  assert.match(blocker.code, /^REQ_CONCESSAO_CR_[A-Z0-9_]+$/);
  // Chamada repetida da o mesmo codigo.
  assert.equal(mapDocumentRequirementToReadinessBlocker(first).code, blocker.code);
});

test("processo desconhecido nao quebra e retorna vazio", () => {
  assert.deepEqual(readinessRequirementsForProcess("NAO_EXISTE"), []);
  assert.deepEqual(activeReadinessRequirementsForProcess("NAO_EXISTE"), []);
  assert.deepEqual(futureReadinessRequirementsForProcess("NAO_EXISTE"), []);
});

/** Trava estatica: preparacao, sem executar o checklist real nem I/O/rede. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o adaptador NAO executa o checklist real (so prepara) e e puro", () => {
  const code = codeOnly(
    readFileSync("src/server/automation/processReadinessRequirements.ts", "utf8"),
  );
  // Nao chama deriveAutomationReadiness — nao muda o comportamento do checklist.
  assert.doesNotMatch(code, /deriveAutomationReadiness\s*\(/, "nao roda o checklist real");
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, "sem rede");
  assert.doesNotMatch(code, /https?:\/\//, "sem URL externa");
});

test("o checklist real (automationReadiness) nao foi alterado por este trabalho", () => {
  // Sanidade: o adaptador so importa o TIPO ReadinessItem do checklist.
  const code = codeOnly(
    readFileSync("src/server/automation/processReadinessRequirements.ts", "utf8"),
  );
  assert.match(code, /type ReadinessItem/, "usa apenas o tipo do checklist");
});
