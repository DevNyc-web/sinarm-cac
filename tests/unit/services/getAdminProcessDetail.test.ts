/**
 * Detalhe admin — o DTO expõe `processTypeCode` para o resumo de requisitos.
 *
 * Verificacao estatica (sem banco): garante que o campo existe no tipo e e
 * preenchido a partir de `process.processType.code`, sem alterar a query (o
 * `include: { processType: true }` ja traz o code). O valor persistido da Guia
 * (GUIA_TRAFEGO_PF_CAC) e sua reconciliacao sao cobertos em processTypeMapping.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  getCurrentPersistedProcessCatalogCode,
} from "../../../src/server/automation/processReadinessRequirements";

const SOURCE = readFileSync("src/server/services/getAdminProcessDetail.ts", "utf8");

test("o tipo AdminProcessDetail declara processTypeCode: string", () => {
  assert.match(SOURCE, /processTypeCode:\s*string;/);
});

test("o retorno preenche processTypeCode a partir de process.processType.code", () => {
  assert.match(SOURCE, /processTypeCode:\s*process\.processType\.code/);
});

test("o code persistido da Guia reconcilia para o catalogo GUIA_TRAFEGO", () => {
  // O DTO carrega GUIA_TRAFEGO_PF_CAC; o consumidor (resumo) reconcilia p/ catalogo.
  assert.equal(getCurrentPersistedProcessCatalogCode("GUIA_TRAFEGO_PF_CAC"), "GUIA_TRAFEGO");
});
