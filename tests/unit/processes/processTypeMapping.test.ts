/**
 * Reconciliacao catalogo <-> persistencia do tipo de processo — testes puros.
 * Sem OCR, sem IA, sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PERSISTED_PROCESS_TYPE_CODES,
  catalogCodeFromPersistedProcessTypeCode,
  isKnownPersistedProcessTypeCode,
  isPersistedCodeForLaunchCatalog,
  persistedProcessTypeCodeFromCatalogCode,
} from "../../../src/server/processes/processTypeMapping";
import { LAUNCH_PROCESS_CODES } from "../../../src/server/processes/processCatalog";
import { getCurrentPersistedProcessCatalogCode } from "../../../src/server/automation/processReadinessRequirements";

test("Guia: persistido GUIA_TRAFEGO_PF_CAC <-> catalogo GUIA_TRAFEGO", () => {
  assert.equal(catalogCodeFromPersistedProcessTypeCode("GUIA_TRAFEGO_PF_CAC"), "GUIA_TRAFEGO");
  assert.equal(persistedProcessTypeCodeFromCatalogCode("GUIA_TRAFEGO"), "GUIA_TRAFEGO_PF_CAC");
});

test("CR/Autorizacao/CRAF mapeiam ida e volta (identidade)", () => {
  for (const code of ["CONCESSAO_CR", "AUTORIZACAO_COMPRA", "EMISSAO_CRAF"] as const) {
    assert.equal(catalogCodeFromPersistedProcessTypeCode(code), code);
    assert.equal(persistedProcessTypeCodeFromCatalogCode(code), code);
  }
});

test("ida e volta e consistente para todo codigo de catalogo", () => {
  for (const catalogCode of LAUNCH_PROCESS_CODES) {
    const persisted = persistedProcessTypeCodeFromCatalogCode(catalogCode);
    assert.ok(persisted, `${catalogCode} tem persistido`);
    assert.equal(catalogCodeFromPersistedProcessTypeCode(persisted!), catalogCode);
  }
});

test("ida e volta e consistente para todo codigo persistido", () => {
  for (const persisted of PERSISTED_PROCESS_TYPE_CODES) {
    const catalog = catalogCodeFromPersistedProcessTypeCode(persisted);
    assert.ok(catalog, `${persisted} tem catalogo`);
    assert.equal(persistedProcessTypeCodeFromCatalogCode(catalog!), persisted);
  }
});

test("codigo desconhecido retorna undefined, sem quebrar", () => {
  assert.equal(catalogCodeFromPersistedProcessTypeCode("NAO_EXISTE"), undefined);
  assert.equal(catalogCodeFromPersistedProcessTypeCode(""), undefined);
  // O code de catalogo puro (sem sufixo) NAO e um code persistido valido.
  assert.equal(catalogCodeFromPersistedProcessTypeCode("GUIA_TRAFEGO"), undefined);
  assert.equal(persistedProcessTypeCodeFromCatalogCode("NAO_EXISTE"), undefined);
  assert.equal(persistedProcessTypeCodeFromCatalogCode("GUIA_TRAFEGO_PF_CAC"), undefined);
});

test("isKnownPersistedProcessTypeCode / isPersistedCodeForLaunchCatalog", () => {
  assert.equal(isKnownPersistedProcessTypeCode("GUIA_TRAFEGO_PF_CAC"), true);
  assert.equal(isKnownPersistedProcessTypeCode("CONCESSAO_CR"), true);
  assert.equal(isKnownPersistedProcessTypeCode("GUIA_TRAFEGO"), false);
  assert.equal(isKnownPersistedProcessTypeCode("NAO_EXISTE"), false);
  assert.equal(isKnownPersistedProcessTypeCode(null), false);
  assert.equal(isKnownPersistedProcessTypeCode(123), false);
  // Hoje as duas guardas coincidem.
  for (const code of PERSISTED_PROCESS_TYPE_CODES) {
    assert.equal(isPersistedCodeForLaunchCatalog(code), true);
  }
  assert.equal(isPersistedCodeForLaunchCatalog("NAO_EXISTE"), false);
});

test("getCurrentPersistedProcessCatalogCode usa o code persistido quando informado", () => {
  assert.equal(getCurrentPersistedProcessCatalogCode("GUIA_TRAFEGO_PF_CAC"), "GUIA_TRAFEGO");
  assert.equal(getCurrentPersistedProcessCatalogCode("CONCESSAO_CR"), "CONCESSAO_CR");
  assert.equal(getCurrentPersistedProcessCatalogCode("EMISSAO_CRAF"), "EMISSAO_CRAF");
});

test("getCurrentPersistedProcessCatalogCode: fallback temporario para Guia", () => {
  assert.equal(getCurrentPersistedProcessCatalogCode(), "GUIA_TRAFEGO");
  assert.equal(getCurrentPersistedProcessCatalogCode(null), "GUIA_TRAFEGO");
  assert.equal(getCurrentPersistedProcessCatalogCode(""), "GUIA_TRAFEGO");
  assert.equal(getCurrentPersistedProcessCatalogCode("CODIGO_DESCONHECIDO"), "GUIA_TRAFEGO");
});

/** Trava estatica: o mapeamento e PURO e nao muda o code da Guia. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o mapeamento e puro (sem Prisma/IO/rede) e preserva o code da Guia", () => {
  const code = codeOnly(readFileSync("src/server/processes/processTypeMapping.ts", "utf8"));
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, "sem rede");
  assert.doesNotMatch(code, /https?:\/\//, "sem URL externa");
  // O code persistido da Guia continua exatamente GUIA_TRAFEGO_PF_CAC.
  assert.match(code, /"GUIA_TRAFEGO_PF_CAC"/);
});
