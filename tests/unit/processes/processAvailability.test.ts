/**
 * Disponibilidade dos processos na entrada de novo processo — testes.
 * Dominio PURO + travas estaticas da tela. Sem OCR, IA, rede, banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AVAILABLE_PROCESS_CODES,
  IN_PREPARATION_MESSAGE,
  isProcessAvailable,
  launchProcessEntries,
  processAvailabilityOf,
} from "../../../src/server/processes/processAvailability";
import { LAUNCH_PROCESS_CODES, LOGICAL_ORDER } from "../../../src/server/processes/processCatalog";

test("a entrada lista exatamente os 4 processos do catalogo", () => {
  const entries = launchProcessEntries();
  assert.equal(entries.length, LAUNCH_PROCESS_CODES.length);
  assert.equal(entries.length, 4);
});

test("as entradas seguem a ordem logica do catalogo", () => {
  assert.deepEqual(
    launchProcessEntries().map((entry) => entry.definition.code),
    [...LOGICAL_ORDER],
  );
  // Posicao logica 1-based coerente com a ordem.
  assert.deepEqual(
    launchProcessEntries().map((entry) => entry.logicalOrderPosition),
    [1, 2, 3, 4],
  );
});

test("apenas a Guia de Trafego esta disponivel agora", () => {
  assert.deepEqual([...AVAILABLE_PROCESS_CODES], ["GUIA_TRAFEGO"]);
  assert.equal(isProcessAvailable("GUIA_TRAFEGO"), true);
  assert.equal(processAvailabilityOf("GUIA_TRAFEGO"), "DISPONIVEL");
});

test("CR, Autorizacao de Compra e CRAF ficam em preparacao", () => {
  for (const code of ["CONCESSAO_CR", "AUTORIZACAO_COMPRA", "EMISSAO_CRAF"] as const) {
    assert.equal(isProcessAvailable(code), false, code);
    assert.equal(processAvailabilityOf(code), "EM_PREPARACAO", code);
  }
});

test("cada entrada carrega a disponibilidade coerente com o codigo", () => {
  for (const entry of launchProcessEntries()) {
    const shouldBeAvailable = entry.definition.code === "GUIA_TRAFEGO";
    assert.equal(entry.available, shouldBeAvailable, entry.definition.code);
    assert.equal(
      entry.availability,
      shouldBeAvailable ? "DISPONIVEL" : "EM_PREPARACAO",
      entry.definition.code,
    );
  }
});

test("codigo desconhecido nao quebra e cai em preparacao", () => {
  assert.equal(isProcessAvailable("NAO_EXISTE"), false);
  assert.equal(processAvailabilityOf("NAO_EXISTE"), "EM_PREPARACAO");
});

/** Remove comentarios para as travas estaticas nao casarem com texto de doc. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o dominio de disponibilidade e puro (sem Prisma/IO/rede)", () => {
  const code = codeOnly(
    readFileSync("src/server/processes/processAvailability.ts", "utf8"),
  );
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, "sem rede");
  assert.doesNotMatch(code, /https?:\/\//, "sem URL externa");
});

test("a selecao usa o catalogo (sem lista hardcoded dos 4 processos)", () => {
  const panel = readFileSync("src/components/processes/ProcessTypeSelection.tsx", "utf8");
  assert.match(panel, /launchProcessEntries/, "deriva a lista do dominio/catalogo");
  // A UI nao pode redeclarar os 4 codigos na mao.
  assert.doesNotMatch(panel, /CONCESSAO_CR/, "nao hardcoda os codigos do catalogo");
  assert.doesNotMatch(panel, /EMISSAO_CRAF/, "nao hardcoda os codigos do catalogo");
});

test("os textos obrigatorios estao na selecao", () => {
  const panel = readFileSync("src/components/processes/ProcessTypeSelection.tsx", "utf8");
  assert.match(
    panel,
    /Estamos começando pela Guia de Tráfego e preparando os demais processos do lançamento\./,
  );
  assert.match(
    panel,
    /Os processos seguem a ordem lógica: CR → Autorização de Compra → CRAF → Guia de Tráfego\./,
  );
  assert.match(panel, /A disponibilidade nesta tela não executa nenhuma automação\./);
  // A mensagem "em preparacao" vem da constante do dominio (nao hardcoded na UI).
  assert.equal(IN_PREPARATION_MESSAGE, "Em preparação para o lançamento.");
  assert.match(panel, /\{IN_PREPARATION_MESSAGE\}/);
});

test("o fluxo de criacao real da Guia continua na tela de novo processo", () => {
  const page = codeOnly(readFileSync("src/app/(user)/processos/novo/page.tsx", "utf8"));
  // A selecao entra, mas o formulario real da Guia permanece.
  assert.match(page, /ProcessTypeSelection/, "usa a selecao de processos");
  assert.match(page, /<NovoProcessoForm/, "mantem o formulario da Guia");
  assert.match(page, /createDraftAction|NovoProcessoForm/, "criacao da Guia preservada");
});

test("a selecao mostra o resumo de requisitos derivado do dominio", () => {
  const panel = readFileSync("src/components/processes/ProcessTypeSelection.tsx", "utf8");
  assert.match(panel, /requirementSummaryForProcess/, "usa o helper de resumo do dominio");
  assert.match(panel, /REQUIREMENT_TYPE_LABELS/, "usa os rotulos de tipo do dominio");
  // Nao lista documentos hardcoded no card (resumo por contagem).
  assert.doesNotMatch(
    panel,
    /Laudo psicológico|Nota fiscal|Antecedente eleitoral|Declaração de Segurança/,
    "nao duplica nomes de documentos na UI",
  );
});

test("os textos obrigatorios do resumo estao na selecao", () => {
  const flat = readFileSync("src/components/processes/ProcessTypeSelection.tsx", "utf8").replace(
    /\s+/g,
    " ",
  );
  assert.match(flat, /Os requisitos exibidos são um resumo operacional\./);
  assert.match(flat, /Apenas a Guia de Tráfego está disponível para criação neste momento\./);
  assert.match(flat, /Os demais processos seguem em preparação para o lançamento\./);
  assert.match(flat, /Requisitos preparados para etapa futura\./);
});
