/**
 * `operationalSignals.ts` — fechamento do processo (docs/52).
 *
 * `cancelProcess` (docs/51) move `internalStatus` para `CANCELADO_OPERACIONAL`
 * SEM alterar `operationalStatus` (sem `alsoSet`, de proposito). Antes deste
 * PR, `isClosed`/`deriveSignals`/`deriveReadiness`/`deriveSla`/`derivePendings`
 * so liam `operationalStatus`, entao um processo cancelado de verdade
 * continuava com sinalizadores/prontidao/SLA de processo ATIVO — a lacuna
 * registrada em docs/52 §2/§3.10. Este arquivo cobre a correcao: `isClosed`
 * passa a olhar tambem `internalStatus`, e as quatro funcoes derivadas (mais
 * `deriveOperationalIndicators`) herdam o fechamento.
 *
 * O que este arquivo NAO testa: `CANCELADO_DEV` em si (ja e regressao coberta
 * aqui so para provar que continua igual) e `cancelProcess`/`statusDivergence`/
 * `operationalStatusProjection`/`clientVisibleStatusLabel` em profundidade —
 * cada um tem sua propria suite; aqui so uma checagem estrutural rapida de que
 * nenhum deles foi tocado por engano.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type InternalStatus, type OperationalStatus } from "@prisma/client";
import {
  deriveOperationalIndicators,
  deriveSignals,
  deriveReadiness,
  deriveSla,
  derivePendings,
  isClosed,
  type ProcessSnapshot,
} from "../../../src/server/processes/operationalSignals";

/** Retrato "ativo tipico": documento aprovado, pagamento pago, tudo em dia — nenhum sinal pendente por si so. */
function activeSnapshot(overrides: Partial<ProcessSnapshot> = {}): ProcessSnapshot {
  return {
    operationalStatus: "PAGO_EM_FILA",
    internalStatus: "PAGO_EM_FILA",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    lastEventAt: new Date("2026-01-01T00:00:00Z"),
    hasDestination: true,
    documentStatus: "APROVADO",
    paymentStatus: "PAGO",
    checkedRevisionCount: 999,
    checkedGruCount: 999,
    hasAssignee: true,
    ...overrides,
  };
}

const NOW = new Date("2026-08-02T12:00:00Z");

/* ------------------------------------------------------- 1. isClosed */

test("isClosed: false para operationalStatus/internalStatus ativos comuns", () => {
  assert.equal(isClosed("PAGO_EM_FILA", "PAGO_EM_FILA"), false);
  assert.equal(isClosed("RASCUNHO", "RASCUNHO"), false);
});

test("isClosed: true para CANCELADO_DEV (operationalStatus), regressao inalterada", () => {
  // internalStatus deliberadamente ATIVO — CANCELADO_DEV sozinho ja fechava antes deste PR.
  assert.equal(isClosed("CANCELADO_DEV", "PAGO_EM_FILA"), true);
});

test("isClosed: true para CANCELADO_OPERACIONAL (internalStatus), correcao deste PR", () => {
  // operationalStatus deliberadamente ATIVO — e exatamente o caso real do cancelProcess
  // (sem alsoSet, operationalStatus preservado do que era antes de cancelar).
  const operationalStatusPreservado: OperationalStatus = "PAGO_EM_FILA";
  assert.equal(isClosed(operationalStatusPreservado, "CANCELADO_OPERACIONAL"), true);
});

test("isClosed: true quando os dois motivos de fechamento coincidem", () => {
  assert.equal(isClosed("CANCELADO_DEV", "CANCELADO_OPERACIONAL"), true);
});

/* -------------------------------------------------- 2. deriveSignals */

test("deriveSignals: [] para CANCELADO_OPERACIONAL mesmo com operationalStatus/campos 'ativos'", () => {
  const snapshot = activeSnapshot({
    internalStatus: "CANCELADO_OPERACIONAL",
    documentStatus: null,
    paymentStatus: null,
    hasDestination: false,
    checkedRevisionCount: 0,
    checkedGruCount: 0,
  });
  assert.deepEqual(deriveSignals(snapshot), []);
});

test("deriveSignals: [] para CANCELADO_DEV, comportamento anterior preservado", () => {
  const snapshot = activeSnapshot({ operationalStatus: "CANCELADO_DEV" });
  assert.deepEqual(deriveSignals(snapshot), []);
});

test("deriveSignals: snapshot ativo comum ainda gera sinais normalmente (nao-regressao)", () => {
  const snapshot = activeSnapshot({ documentStatus: "PENDENTE" });
  assert.ok(deriveSignals(snapshot).includes("DOCUMENTO_PENDENTE"));
});

/* ------------------------------------------------ 3. deriveReadiness */

test("deriveReadiness: CANCELADO_OPERACIONAL nunca fica PRONTO_PARA_PROTOCOLO_MANUAL nem QUASE_PRONTO", () => {
  // Mesmo com TODOS os demais criterios satisfeitos, o fechamento bloqueia o nivel —
  // processo cancelado nao deve parecer "quase pronto" nem "pronto" para ninguem.
  const snapshot = activeSnapshot({ internalStatus: "CANCELADO_OPERACIONAL" });
  const readiness = deriveReadiness(snapshot);
  assert.equal(readiness.level, "NAO_PRONTO");
  const semBloqueio = readiness.criteria.find((c) => c.label === "Sem bloqueios ativos");
  assert.equal(semBloqueio?.met, false);
});

test("deriveReadiness: CANCELADO_DEV mantem o mesmo resultado de antes (regressao)", () => {
  const snapshot = activeSnapshot({ operationalStatus: "CANCELADO_DEV" });
  const readiness = deriveReadiness(snapshot);
  assert.equal(readiness.level, "NAO_PRONTO");
});

test("deriveReadiness: snapshot ativo com tudo em dia ainda fica PRONTO_PARA_PROTOCOLO_MANUAL (nao-regressao)", () => {
  const readiness = deriveReadiness(activeSnapshot());
  assert.equal(readiness.level, "PRONTO_PARA_PROTOCOLO_MANUAL");
});

/* ------------------------------------------------------ 4. deriveSla */

test("deriveSla: null para CANCELADO_OPERACIONAL — nunca 'atrasado' para processo cancelado", () => {
  const snapshot = activeSnapshot({
    internalStatus: "CANCELADO_OPERACIONAL",
    createdAt: new Date("2020-01-01T00:00:00Z"), // bem antigo — venceria facil se nao fosse fechado
  });
  assert.equal(deriveSla(snapshot, NOW), null);
});

test("deriveSla: null para CANCELADO_DEV, regressao inalterada", () => {
  const snapshot = activeSnapshot({
    operationalStatus: "CANCELADO_DEV",
    createdAt: new Date("2020-01-01T00:00:00Z"),
  });
  assert.equal(deriveSla(snapshot, NOW), null);
});

test("deriveSla: snapshot ativo antigo ainda fica ATRASADO normalmente (nao-regressao)", () => {
  const snapshot = activeSnapshot({ createdAt: new Date("2020-01-01T00:00:00Z") });
  assert.equal(deriveSla(snapshot, NOW)?.status, "ATRASADO");
});

/* -------------------------------------------------- 5. derivePendings */

test("derivePendings: [] para CANCELADO_OPERACIONAL mesmo com pendencias 'ativas'", () => {
  const snapshot = activeSnapshot({
    internalStatus: "CANCELADO_OPERACIONAL",
    hasAssignee: false,
    paymentStatus: "PENDENTE",
  });
  assert.deepEqual(derivePendings(snapshot), []);
});

test("derivePendings: [] para CANCELADO_DEV, regressao inalterada", () => {
  const snapshot = activeSnapshot({ operationalStatus: "CANCELADO_DEV", hasAssignee: false });
  assert.deepEqual(derivePendings(snapshot), []);
});

/* ----------------------------------------- 6. deriveOperationalIndicators */

test("deriveOperationalIndicators: processo cancelado (real) fica totalmente inativo de uma vez", () => {
  const snapshot = activeSnapshot({
    internalStatus: "CANCELADO_OPERACIONAL",
    createdAt: new Date("2020-01-01T00:00:00Z"),
    hasAssignee: false,
  });
  const indicators = deriveOperationalIndicators(snapshot, NOW);
  assert.deepEqual(indicators.signals, []);
  assert.equal(indicators.readinessLevel, "NAO_PRONTO");
  assert.equal(indicators.sla, null);
  assert.deepEqual(indicators.pendings, []);
});

test("operationalStatus antigo e preservado no snapshot e NAO reativa o processo", () => {
  // O ponto central do docs/51/docs/52: cancelProcess nao muda operationalStatus.
  // Um snapshot com operationalStatus tao "ativo" quanto se possa imaginar
  // (PAGO_EM_FILA, documento aprovado, pagamento pago) ainda fecha por causa do
  // internalStatus — nada no calculo usa operationalStatus para reabrir.
  const internalStatus: InternalStatus = "CANCELADO_OPERACIONAL";
  const snapshot = activeSnapshot({ internalStatus });
  assert.equal(isClosed(snapshot.operationalStatus, snapshot.internalStatus), true);
  assert.deepEqual(deriveOperationalIndicators(snapshot, NOW).signals, []);
});

/* --------------------------------- 7. checagens cruzadas (nao-regressao) */

test("getAdminQueue: highlighted usa isClosed antes de destacar a fila", () => {
  const source = readFileSync("src/server/services/getAdminQueue.ts", "utf8");
  assert.match(source, /import\s*\{[\s\S]*?isClosed[\s\S]*?\}\s*from\s*"@\/server\/processes\/operationalSignals"/);
  assert.match(
    source,
    /highlighted:\s*\n?\s*!isClosed\(row\.operationalStatus,\s*row\.internalStatus\)/,
    "a flag de destaque da fila deveria excluir processos fechados (docs/52)",
  );
});

test("processRepository: listAdminQueue passa a selecionar internalStatus", () => {
  const source = readFileSync("src/server/repositories/processRepository.ts", "utf8");
  const fnStart = source.indexOf("export function listAdminQueue");
  const fnEnd = source.indexOf("\nexport function", fnStart + 1);
  const fnSource = source.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
  assert.match(fnSource, /internalStatus:\s*true/);
});

test("clientVisibleStatusLabel continua SEM ler internalStatus (docs/45, nao tocado por este PR)", () => {
  const source = readFileSync("src/server/processes/statusLabels.ts", "utf8");
  const fnMatch = source.match(
    /export function clientVisibleStatusLabel\(process:\s*\{([\s\S]*?)\}\):\s*string\s*\{/,
  );
  assert.ok(fnMatch, "assinatura de clientVisibleStatusLabel nao encontrada");
  assert.doesNotMatch(fnMatch![1], /internalStatus/);
});

test("cancelProcess.ts continua sem alsoSet (nao tocado por este PR)", () => {
  const source = readFileSync("src/server/services/cancelProcess.ts", "utf8");
  assert.doesNotMatch(source, /alsoSet\s*:/);
});
