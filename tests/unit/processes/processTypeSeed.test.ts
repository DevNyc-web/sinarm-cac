/**
 * Seed dos tipos de processo (dados derivados) — testes de coerencia.
 * Sem OCR, sem IA, sem rede, sem banco. NAO roda o seed nem toca Postgres.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FUTURE_PROCESS_TYPE_SEED } from "../../../src/server/processes/processTypeSeed";
import { getProcessDefinition } from "../../../src/server/processes/processCatalog";
import { catalogCodeFromPersistedProcessTypeCode } from "../../../src/server/processes/processTypeMapping";
import { AVAILABLE_PROCESS_CODES } from "../../../src/server/processes/processAvailability";

const FUTURE_CODES = ["CONCESSAO_CR", "AUTORIZACAO_COMPRA", "EMISSAO_CRAF"] as const;

test("o seed futuro tem exatamente os 3 tipos, com codigos persistidos esperados", () => {
  assert.equal(FUTURE_PROCESS_TYPE_SEED.length, 3);
  assert.deepEqual(
    FUTURE_PROCESS_TYPE_SEED.map((entry) => entry.code).sort(),
    [...FUTURE_CODES].sort(),
  );
});

test("todos os tipos futuros sao active:false", () => {
  for (const entry of FUTURE_PROCESS_TYPE_SEED) {
    assert.equal(entry.active, false, entry.code);
  }
});

test("a Guia NAO entra no seed futuro (registro proprio, inalterado)", () => {
  // Nem o code persistido da Guia...
  assert.ok(!FUTURE_PROCESS_TYPE_SEED.some((entry) => entry.code === "GUIA_TRAFEGO_PF_CAC"));
  // ...nem o processo de catalogo GUIA_TRAFEGO aparecem entre os futuros.
  assert.ok(
    !FUTURE_PROCESS_TYPE_SEED.some(
      (entry) => catalogCodeFromPersistedProcessTypeCode(entry.code) === "GUIA_TRAFEGO",
    ),
  );
});

test("nome e taxa de cada tipo futuro batem com o catalogo", () => {
  for (const entry of FUTURE_PROCESS_TYPE_SEED) {
    const catalogCode = catalogCodeFromPersistedProcessTypeCode(entry.code);
    assert.ok(catalogCode, `${entry.code} reconcilia com o catalogo`);
    const definition = getProcessDefinition(catalogCode!);
    assert.ok(definition);
    assert.equal(entry.name, definition!.name, `${entry.code}: nome`);
    assert.equal(entry.baseFeeCents, definition!.gruFeeCents, `${entry.code}: taxa`);
  }
});

test("as taxas dos tipos futuros sao as esperadas", () => {
  const byCode = Object.fromEntries(FUTURE_PROCESS_TYPE_SEED.map((e) => [e.code, e.baseFeeCents]));
  assert.equal(byCode.CONCESSAO_CR, 10_000);
  assert.equal(byCode.AUTORIZACAO_COMPRA, 2_500);
  assert.equal(byCode.EMISSAO_CRAF, 8_800);
});

test("processAvailability continua liberando SOMENTE a Guia de Trafego", () => {
  assert.deepEqual([...AVAILABLE_PROCESS_CODES], ["GUIA_TRAFEGO"]);
});

/** Remove comentarios para as travas estaticas nao casarem com texto de doc. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("prisma/seed.ts mantem a Guia inalterada (code, active e taxa)", () => {
  const seed = codeOnly(readFileSync("prisma/seed.ts", "utf8"));
  // Registro da Guia continua explicito e igual.
  assert.match(seed, /code: "GUIA_TRAFEGO_PF_CAC"/);
  assert.match(seed, /baseFeeCents: 2000/);
  assert.match(seed, /active: true/);
  // Nao renomeou a Guia.
  assert.match(seed, /name: "Guia de Trafego \(Pessoa Fisica - CAC\)"/);
});

test("prisma/seed.ts semeia os futuros por upsert idempotente derivado do dominio", () => {
  const seed = codeOnly(readFileSync("prisma/seed.ts", "utf8"));
  assert.match(seed, /FUTURE_PROCESS_TYPE_SEED/, "usa os dados derivados do dominio");
  assert.match(seed, /for \(const type of FUTURE_PROCESS_TYPE_SEED\)/, "itera os futuros");
  assert.match(seed, /upsert\(\{/, "usa upsert (idempotente)");
  assert.match(seed, /where: \{ code: type\.code \}/, "chave unica por code");
});
