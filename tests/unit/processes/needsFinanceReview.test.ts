/**
 * Sinal `needsFinanceReview` — docs/54 (item 11 do `docs/51 §4`).
 *
 * Processo cancelado de verdade (`CANCELADO_OPERACIONAL`) com pagamento
 * `PAGO` precisa de revisao financeira MANUAL. Este arquivo prova que o
 * sinal e SO leitura: nenhum `PaymentStatus` muda, nenhum PSP e chamado,
 * nenhuma acao de reembolso existe, e o cliente nunca ve o sinal.
 *
 * Estilo (mesmo de `adminRealCancellationView.test.ts`): funcoes puras
 * testadas diretamente; paginas/actions provadas por leitura de arquivo
 * como texto (Server Component nao roda em `node:test`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  deriveNeedsFinanceReview,
  deriveOperationalIndicators,
  type ProcessSnapshot,
} from "../../../src/server/processes/operationalSignals";

const ADMIN_DETAIL_PAGE = "src/app/(admin)/admin/processos/[id]/page.tsx";
const ADMIN_QUEUE_PAGE = "src/app/(admin)/admin/processos/page.tsx";
const ADMIN_ACTIONS = "src/app/(admin)/admin/processos/[id]/actions.ts";
const GET_ADMIN_QUEUE = "src/server/services/getAdminQueue.ts";
const OPERATIONAL_SIGNALS = "src/server/processes/operationalSignals.ts";

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

/* --------------------------------------------- 1. deriveNeedsFinanceReview */

test("deriveNeedsFinanceReview: true para CANCELADO_OPERACIONAL com pagamento PAGO", () => {
  assert.equal(
    deriveNeedsFinanceReview({ internalStatus: "CANCELADO_OPERACIONAL", paymentStatus: "PAGO" }),
    true,
  );
});

test("deriveNeedsFinanceReview: false para CANCELADO_OPERACIONAL sem pagamento", () => {
  assert.equal(
    deriveNeedsFinanceReview({ internalStatus: "CANCELADO_OPERACIONAL", paymentStatus: null }),
    false,
  );
});

test("deriveNeedsFinanceReview: false para CANCELADO_OPERACIONAL com pagamento nao-PAGO", () => {
  for (const paymentStatus of [
    "PENDENTE",
    "AGUARDANDO_PAGAMENTO",
    "EXPIRADO",
    "CANCELADO",
    "FALHOU",
  ] as const) {
    assert.equal(
      deriveNeedsFinanceReview({ internalStatus: "CANCELADO_OPERACIONAL", paymentStatus }),
      false,
      paymentStatus,
    );
  }
});

test("deriveNeedsFinanceReview: false para processo ATIVO (nao cancelado) mesmo com pagamento PAGO", () => {
  assert.equal(
    deriveNeedsFinanceReview({ internalStatus: "PAGO_EM_FILA", paymentStatus: "PAGO" }),
    false,
  );
});

test("deriveNeedsFinanceReview: false para CANCELADO_DEV (operationalStatus) com pagamento PAGO", () => {
  // CANCELADO_DEV e operationalStatus, nao internalStatus — o sinal so olha
  // internalStatus, entao um processo tecnico/dev (internalStatus ativo
  // qualquer, nunca CANCELADO_OPERACIONAL) nunca aciona o sinal.
  assert.equal(
    deriveNeedsFinanceReview({ internalStatus: "PAGO_EM_FILA", paymentStatus: "PAGO" }),
    false,
  );
});

/* ------------------------------------------- 2. deriveOperationalIndicators */

test("deriveOperationalIndicators: needsFinanceReview reflete o sinal para processo cancelado com pagamento", () => {
  const snapshot = activeSnapshot({ internalStatus: "CANCELADO_OPERACIONAL" });
  assert.equal(deriveOperationalIndicators(snapshot).needsFinanceReview, true);
});

test("deriveOperationalIndicators: needsFinanceReview false para processo ativo comum", () => {
  const snapshot = activeSnapshot();
  assert.equal(deriveOperationalIndicators(snapshot).needsFinanceReview, false);
});

/* --------------------------------------------- 3. nao mexe em pagamento/PSP */

test("operationalSignals.ts nao importa payment adapter, PSP nem repositorio de pagamento", () => {
  const source = readFileSync(OPERATIONAL_SIGNALS, "utf8");
  // Checa IMPORT real, nao prosa — comentarios explicando "nenhum PSP e
  // chamado" mencionam a palavra sem criar dependencia nenhuma.
  assert.doesNotMatch(source, /from ["'].*payment/i);
  assert.doesNotMatch(source, /from ["'].*mercadopago/i);
  // Modulo continua puro: sem Prisma, sem I/O (docstring do proprio arquivo ja afirma isso).
  assert.doesNotMatch(source, /PrismaClient|getPrisma\(/);
});

test("getAdminQueue.ts: needsFinanceReview vem de indicators, nada escreve em Payment", () => {
  const source = readFileSync(GET_ADMIN_QUEUE, "utf8");
  assert.match(source, /needsFinanceReview:\s*indicators\.needsFinanceReview/);
  assert.doesNotMatch(source, /payment\.(update|create|delete)/i);
});

/* --------------------------------------------------- 4. nenhuma UI de reembolso */

test("nenhuma action de reembolso (registerRefund) foi criada", () => {
  const source = readFileSync(ADMIN_ACTIONS, "utf8");
  assert.doesNotMatch(source, /registerRefund/i);
});

test("nenhum botao de reembolso foi criado no detalhe nem na fila admin", () => {
  const detailSource = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  const queueSource = readFileSync(ADMIN_QUEUE_PAGE, "utf8");
  for (const source of [detailSource, queueSource]) {
    assert.doesNotMatch(source, /<form[^>]*[Rr]efund/);
    assert.doesNotMatch(source, />\s*Reembolsar\s*</);
    assert.doesNotMatch(source, /registerRefund/i);
  }
});

test("o texto exibido nunca promete reembolso — so sinaliza revisao", () => {
  const detailSource = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  const queueSource = readFileSync(ADMIN_QUEUE_PAGE, "utf8");
  assert.match(detailSource, /Revisão financeira necessária/);
  assert.match(queueSource, /Revisão financeira necessária/);
  for (const source of [detailSource, queueSource]) {
    assert.doesNotMatch(source, /Reembolso devido/i);
    assert.doesNotMatch(source, /reembolso (foi )?aprovado/i);
  }
});

test("admin detail: o aviso de revisao financeira e condicionado a detail.indicators.needsFinanceReview", () => {
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  assert.match(source, /\{detail\.indicators\.needsFinanceReview \? \(/);
});

test("admin queue: o aviso de revisao financeira e condicionado a row.needsFinanceReview", () => {
  const source = readFileSync(ADMIN_QUEUE_PAGE, "utf8");
  assert.match(source, /\{row\.needsFinanceReview \? \(/);
});

/* --------------------------------------------------------- 5. cliente intocado */

test("cliente (src/app/(user)) nao ganhou nenhuma mencao a needsFinanceReview/revisao financeira", () => {
  const dashboard = readFileSync("src/app/(user)/dashboard/page.tsx", "utf8");
  assert.doesNotMatch(dashboard, /needsFinanceReview/i);
  assert.doesNotMatch(dashboard, /[Rr]evisão financeira/);
  assert.doesNotMatch(dashboard, /[Rr]eembolso/);
});

/* ----------------------------------------------- 6. nao-regressao cruzada */

test("PaymentStatus nao ganhou valor novo (schema intocado por este PR)", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const bloco = /enum PaymentStatus \{([\s\S]*?)\}/.exec(schema);
  assert.ok(bloco, "enum PaymentStatus nao encontrado");
  const valores = bloco![1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
  assert.equal(valores.length, 6, "PaymentStatus deveria continuar com 6 valores, sem REEMBOLSADO novo");
  assert.ok(!valores.includes("REEMBOLSADO"));
});

test("cancelProcess.ts continua sem tocar pagamento/PSP (nao alterado por este PR)", () => {
  const source = readFileSync("src/server/services/cancelProcess.ts", "utf8");
  assert.doesNotMatch(source, /paymentRepository|paymentAdapter|alsoSet\s*:/);
});
