/**
 * Data de cancelamento do relatorio financeiro dedicado — docs/59 §6 PR 2.
 *
 * `findEarliestCancellationEventsForProcesses` busca em LOTE (uma unica
 * query `processId IN (...)`) o evento de transicao para
 * `CANCELADO_OPERACIONAL` de cada processo — nunca `Process.updatedAt`,
 * nunca `Payment.paidAt`, nunca uma consulta por linha (N+1).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import { findEarliestCancellationEventsForProcesses } from "../../../src/server/repositories/processRepository";

let db: FakePrisma = installFakePrisma();

test.beforeEach(() => {
  db = installFakePrisma();
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

test("lista vazia de processIds nao consulta o banco — devolve mapa vazio", async () => {
  const mapa = await findEarliestCancellationEventsForProcesses([]);
  assert.equal(mapa.size, 0);
});

test("processo com evento de transicao para CANCELADO_OPERACIONAL entra no mapa", async () => {
  const dataCancelamento = new Date("2026-03-10T12:00:00Z");
  db.processStatusEvent.seed({
    processId: "proc-1",
    toStatus: "CANCELADO_OPERACIONAL",
    createdAt: dataCancelamento,
    actorMockUserId: "admin-1",
    actorRole: "ADMIN",
  });

  const mapa = await findEarliestCancellationEventsForProcesses(["proc-1"]);
  assert.equal(mapa.get("proc-1")?.toISOString(), dataCancelamento.toISOString());
});

test("processo sem evento de CANCELADO_OPERACIONAL nao entra no mapa", () => {
  return findEarliestCancellationEventsForProcesses(["proc-sem-evento"]).then((mapa) => {
    assert.equal(mapa.has("proc-sem-evento"), false);
  });
});

test("eventos de OUTRO toStatus sao ignorados — so CANCELADO_OPERACIONAL conta", async () => {
  db.processStatusEvent.seed({
    processId: "proc-2",
    toStatus: "PAGO_EM_FILA",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    actorMockUserId: "op-1",
    actorRole: "OPERADOR",
  });

  const mapa = await findEarliestCancellationEventsForProcesses(["proc-2"]);
  assert.equal(mapa.has("proc-2"), false);
});

test("com mais de um evento CANCELADO_OPERACIONAL, fica o PRIMEIRO cronologicamente", async () => {
  const primeiro = new Date("2026-02-01T00:00:00Z");
  const segundo = new Date("2026-02-05T00:00:00Z");
  // Seedados fora de ordem de proposito — a funcao deve ordenar, nao confiar
  // na ordem de insercao.
  db.processStatusEvent.seed({
    processId: "proc-3",
    toStatus: "CANCELADO_OPERACIONAL",
    createdAt: segundo,
    actorMockUserId: "admin-1",
    actorRole: "ADMIN",
  });
  db.processStatusEvent.seed({
    processId: "proc-3",
    toStatus: "CANCELADO_OPERACIONAL",
    createdAt: primeiro,
    actorMockUserId: "admin-1",
    actorRole: "ADMIN",
  });

  const mapa = await findEarliestCancellationEventsForProcesses(["proc-3"]);
  assert.equal(mapa.get("proc-3")?.toISOString(), primeiro.toISOString());
});

test("busca em lote: um unico processId IN (...) cobre varios processos, nenhum ficou de fora", async () => {
  const dataA = new Date("2026-04-01T00:00:00Z");
  const dataB = new Date("2026-05-01T00:00:00Z");
  db.processStatusEvent.seed({
    processId: "proc-a",
    toStatus: "CANCELADO_OPERACIONAL",
    createdAt: dataA,
    actorMockUserId: "admin-1",
    actorRole: "ADMIN",
  });
  db.processStatusEvent.seed({
    processId: "proc-b",
    toStatus: "CANCELADO_OPERACIONAL",
    createdAt: dataB,
    actorMockUserId: "admin-1",
    actorRole: "ADMIN",
  });
  db.processStatusEvent.seed({
    processId: "proc-c",
    toStatus: "PAGO_EM_FILA",
    createdAt: new Date(),
    actorMockUserId: "op-1",
    actorRole: "OPERADOR",
  });

  const mapa = await findEarliestCancellationEventsForProcesses(["proc-a", "proc-b", "proc-c"]);
  assert.equal(mapa.size, 2);
  assert.equal(mapa.get("proc-a")?.toISOString(), dataA.toISOString());
  assert.equal(mapa.get("proc-b")?.toISOString(), dataB.toISOString());
  assert.equal(mapa.has("proc-c"), false);
});

/* -------------------------------------- estrutural: fonte/query correta */

test("processRepository.ts: a query filtra por toStatus CANCELADO_OPERACIONAL e ordena createdAt asc", () => {
  const source = readFileSync("src/server/repositories/processRepository.ts", "utf8");
  assert.match(
    source,
    /processId:\s*\{\s*in:\s*\[\.\.\.processIds\]\s*\},\s*toStatus:\s*"CANCELADO_OPERACIONAL"/,
  );

  const inicio = source.indexOf("export async function findEarliestCancellationEventsForProcesses");
  assert.ok(inicio > -1, "funcao nao encontrada");
  const fim = source.indexOf("\n}", inicio);
  const corpo = source.slice(inicio, fim);
  assert.match(corpo, /orderBy:\s*\{\s*createdAt:\s*"asc"\s*\}/);
  assert.doesNotMatch(corpo, /\.updatedAt/, "nao deve ler Process.updatedAt");
  assert.doesNotMatch(corpo, /paidAt/, "nao deve ler Payment.paidAt como fallback");
});
