/**
 * Numero interno do processo (`CAC-YYYY-NNNNNN`) — docs/62.
 *
 * Primeira cobertura do gerador de `Process.code`: ate este PR a geracao nao
 * tinha teste algum (o `GT-DEV-...` anterior nunca foi exercitado).
 *
 * SEM POSTGRES: o CI roda sem banco (`.github/workflows/ci.yml`), entao a
 * sequence real nunca e tocada aqui. A formatacao e testada pela funcao pura;
 * a leitura do `nextval` e testada com um stub minimo em `globalThis.prisma`
 * — mesmo mecanismo do `tests/unit/services/testPrisma.ts`, sem depender dele
 * (aquele fake nao conhece `$queryRaw`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { formatProcessCode, generateProcessCode } from "../../../src/server/processes/processCode";

/** Instala um Prisma minimo cujo `$queryRaw` devolve o valor pedido. */
function installSequenceStub(value: bigint | null): { calls: number } {
  const state = { calls: 0 };
  (globalThis as unknown as { prisma?: unknown }).prisma = {
    $queryRaw: async () => {
      state.calls += 1;
      return value === null ? [] : [{ n: value }];
    },
  };
  return state;
}

test("formata CAC-YYYY-NNNNNN com zeros a esquerda", () => {
  assert.equal(formatProcessCode(1, 2026), "CAC-2026-000001");
  assert.equal(formatProcessCode(2, 2026), "CAC-2026-000002");
  assert.equal(formatProcessCode(42, 2026), "CAC-2026-000042");
  assert.equal(formatProcessCode(999999, 2026), "CAC-2026-999999");
});

test("o ano e rotulo: a sequencia NAO reinicia na virada", () => {
  // docs/62 §4.3 — o terceiro processo continua sendo o 3, mesmo em 2027.
  assert.equal(formatProcessCode(3, 2027), "CAC-2027-000003");
});

test("estouro de 6 digitos cresce, nao quebra nem trunca", () => {
  // docs/62 §4.1 deixou o comportamento em aberto; `padStart` so completa.
  assert.equal(formatProcessCode(1000000, 2027), "CAC-2027-1000000");
  assert.equal(formatProcessCode(12345678, 2030), "CAC-2030-12345678");
});

test("aceita bigint sem perder precisao", () => {
  // `nextval` volta como bigint no Prisma; `Number` perderia precisao acima de
  // 2^53. `String(bigint)` nao perde.
  assert.equal(formatProcessCode(9007199254740993n, 2026), "CAC-2026-9007199254740993");
});

test("generateProcessCode usa o nextval da sequence", async () => {
  const stub = installSequenceStub(7n);
  const code = await generateProcessCode();

  assert.equal(stub.calls, 1);
  assert.equal(code, `CAC-${new Date().getUTCFullYear()}-000007`);
});

test("generateProcessCode usa o ano UTC, nao o local", async () => {
  installSequenceStub(1n);
  const code = await generateProcessCode();

  // Casa com `createdAt`, que o Prisma grava em UTC (docs/62 §5 do plano).
  assert.match(code, new RegExp(`^CAC-${new Date().getUTCFullYear()}-`));
});

test("duas chamadas seguem a sequencia, sem repetir", async () => {
  let next = 10n;
  (globalThis as unknown as { prisma?: unknown }).prisma = {
    $queryRaw: async () => [{ n: next++ }],
  };

  const first = await generateProcessCode();
  const second = await generateProcessCode();

  assert.notEqual(first, second);
  assert.ok(first.endsWith("000010"), first);
  assert.ok(second.endsWith("000011"), second);
});

test("sequence sem retorno falha em vez de inventar codigo", async () => {
  installSequenceStub(null);
  await assert.rejects(generateProcessCode(), /db:migrate/);
});

test("novo codigo NAO usa GT-DEV nem randomUUID", async () => {
  installSequenceStub(1n);
  const code = await generateProcessCode();
  assert.ok(!code.includes("GT-DEV"), code);

  // O gerador antigo saiu do service — nenhum caminho novo volta a ele.
  const service = readFileSync("src/server/services/createGuiaTrafegoDraft.ts", "utf8");
  assert.ok(!service.includes("GT-DEV"), "createGuiaTrafegoDraft ainda cita GT-DEV");
  assert.ok(!service.includes("randomUUID"), "createGuiaTrafegoDraft ainda usa randomUUID");
  assert.match(service, /code: await generateProcessCode\(\)/);
});

test("busca admin continua sem validar formato (GT-DEV segue encontravel)", () => {
  // docs/62 §5.5/§8.2 — nenhuma regex/validacao pode rejeitar codigo antigo.
  const repository = readFileSync("src/server/repositories/processRepository.ts", "utf8");
  assert.match(repository, /code: filters\.code \? \{ contains: filters\.code, mode: "insensitive" \}/);
});
