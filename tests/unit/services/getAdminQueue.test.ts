/**
 * Filtro "Revisão financeira" na fila admin — docs/55.
 *
 * `needsFinanceReview` nao e coluna do banco: o filtro acontece EM MEMORIA,
 * depois do mapa de `getAdminQueue` (ver comentario no proprio arquivo).
 * Este arquivo prova o comportamento fim-a-fim com o fake Prisma: sem
 * filtro mostra tudo, com filtro so mostra quem tem o sinal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import { getAdminQueue } from "../../../src/server/services/getAdminQueue";

let db: FakePrisma = installFakePrisma();

test.beforeEach(() => {
  db = installFakePrisma();
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

function seedProcess(overrides: Record<string, unknown>) {
  return db.process.seed({
    code: "GT-0000",
    userId: "user-dono",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    operationalStatus: "PAGO_EM_FILA",
    internalStatus: "PAGO_EM_FILA",
    priority: "NORMAL",
    assignedToMockUserId: null,
    processType: { name: "Guia de Tráfego" },
    destination: null,
    payments: [],
    documents: [],
    statusEvents: [],
    checklistItems: [],
    ...overrides,
  });
}

test("sem filtro: mostra tanto o processo cancelado com pagamento quanto o ativo", async () => {
  seedProcess({
    code: "GT-CANCELADO-PAGO",
    internalStatus: "CANCELADO_OPERACIONAL",
    payments: [{ status: "PAGO", createdAt: new Date() }],
  });
  seedProcess({ code: "GT-ATIVO", internalStatus: "PAGO_EM_FILA" });

  const rows = await getAdminQueue({});
  assert.equal(rows.length, 2);
});

test("filtro 'Revisão financeira' ativo: so mostra rows com needsFinanceReview = true", async () => {
  seedProcess({
    code: "GT-CANCELADO-PAGO",
    internalStatus: "CANCELADO_OPERACIONAL",
    payments: [{ status: "PAGO", createdAt: new Date() }],
  });
  seedProcess({ code: "GT-ATIVO-PAGO", internalStatus: "PAGO_EM_FILA", payments: [{ status: "PAGO", createdAt: new Date() }] });
  seedProcess({
    code: "GT-CANCELADO-SEM-PAGAMENTO",
    internalStatus: "CANCELADO_OPERACIONAL",
    payments: [],
  });

  const rows = await getAdminQueue({ needsFinanceReview: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, "GT-CANCELADO-PAGO");
  assert.equal(rows[0].needsFinanceReview, true);
});

test("filtro 'Revisão financeira' desligado (false/undefined): comporta-se como sem filtro", async () => {
  seedProcess({
    code: "GT-CANCELADO-PAGO",
    internalStatus: "CANCELADO_OPERACIONAL",
    payments: [{ status: "PAGO", createdAt: new Date() }],
  });
  seedProcess({ code: "GT-ATIVO" });

  const comFalse = await getAdminQueue({ needsFinanceReview: false });
  const semFiltro = await getAdminQueue({});
  assert.equal(comFalse.length, 2);
  assert.equal(semFiltro.length, 2);
});

test("processo ativo com pagamento PAGO nao aparece no filtro (needsFinanceReview exige cancelamento real)", async () => {
  seedProcess({ code: "GT-ATIVO-PAGO", payments: [{ status: "PAGO", createdAt: new Date() }] });

  const rows = await getAdminQueue({ needsFinanceReview: true });
  assert.equal(rows.length, 0);
});

test("docs/59: expoe valor pago e data de pagamento — mesma fonte ja usada no detalhe admin", async () => {
  const paidAt = new Date("2026-02-01T12:00:00Z");
  seedProcess({
    code: "GT-CANCELADO-PAGO",
    internalStatus: "CANCELADO_OPERACIONAL",
    payments: [{ status: "PAGO", amountCents: 10_000, paidAt, createdAt: new Date() }],
  });

  const rows = await getAdminQueue({ needsFinanceReview: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].paymentAmountCents, 10_000);
  assert.equal(rows[0].paymentPaidAt?.toISOString(), paidAt.toISOString());
});

test("docs/59: valor/data de pagamento ficam null quando o processo nao tem pagamento", async () => {
  seedProcess({ code: "GT-SEM-PAGAMENTO", payments: [] });

  const rows = await getAdminQueue({});
  assert.equal(rows[0].paymentAmountCents, null);
  assert.equal(rows[0].paymentPaidAt, null);
});

test("o filtro nao altera PaymentStatus nem cria nenhuma linha nova", async () => {
  const seeded = seedProcess({
    code: "GT-CANCELADO-PAGO",
    internalStatus: "CANCELADO_OPERACIONAL",
    payments: [{ status: "PAGO", createdAt: new Date() }],
  });

  await getAdminQueue({ needsFinanceReview: true });

  assert.equal(db.process.rows.length, 1);
  const paymentsAfter = (db.findProcess(seeded.id as string)?.payments as { status: string }[]) ?? [];
  assert.deepEqual(
    paymentsAfter.map((p) => p.status),
    ["PAGO"],
  );
});

/* -------------------------------------- estrutural: UI/wiring/seguranca */

test("getAdminQueue.ts: filtro so ocorre em memoria, nunca no where do repositorio", () => {
  const source = readFileSync("src/server/services/getAdminQueue.ts", "utf8");
  assert.match(
    source,
    /filters\.needsFinanceReview \? mapped\.filter\(\(row\) => row\.needsFinanceReview\) : mapped/,
  );
  assert.doesNotMatch(source, /paymentAdapter|mercadopago/i);
});

test("admin queue: campo do filtro usa o mesmo param lido pela pagina", () => {
  const source = readFileSync("src/app/(admin)/admin/processos/page.tsx", "utf8");
  assert.match(source, /name="revisaoFinanceira"/);
  assert.match(source, /params\.revisaoFinanceira === "1"/);
  assert.match(source, /needsFinanceReview: financeReviewFilter \|\| undefined/);
});

test("admin queue: nenhum botao/action de reembolso foi criado junto do filtro", () => {
  const source = readFileSync("src/app/(admin)/admin/processos/page.tsx", "utf8");
  assert.doesNotMatch(source, /registerRefund/i);
  assert.doesNotMatch(source, />\s*Reembolsar\s*</);
});

test("cliente (src/app/(user)) nao ganhou nenhuma mencao ao filtro de revisao financeira", () => {
  const dashboard = readFileSync("src/app/(user)/dashboard/page.tsx", "utf8");
  assert.doesNotMatch(dashboard, /revisaoFinanceira|needsFinanceReview/i);
});
