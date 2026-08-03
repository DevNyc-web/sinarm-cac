/**
 * confirmPixPayment — testes COMPORTAMENTAIS (sem Postgres, sem provider real).
 *
 * Banco: fake via `globalThis.prisma` (ver `testPrisma.ts`).
 *
 * NAO HA VALIDACAO DE VALOR neste service, hoje: ele confirma pelo par
 * (eventId, providerPaymentId) sem comparar `amountCents`. Os testes abaixo
 * REGISTRAM esse comportamento atual em vez de exigir a regra — adicionar a
 * checagem seria mudanca de regra de negocio, fora do escopo deste PR.
 *
 * IDEMPOTENCIA: o service tem duas guardas em memoria (evento ja visto,
 * pagamento ja PAGO). A terceira guarda real e o UNIQUE de `webhookEventId` no
 * Postgres, que o fake NAO reproduz — sob concorrencia, so o banco decide.
 *
 * LIMITE HONESTO: prova a logica do service, nao constraints do Postgres.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import { confirmPixPayment } from "../../../src/server/services/confirmPixPayment";

let db: FakePrisma = installFakePrisma();

const PROCESS_ID = "test-confirm-process";
const PROVIDER_PAYMENT_ID = "FAKE-abc-123";
const EVENT_ID = "evt-001";

function semear(
  paymentOverrides: Record<string, unknown> = {},
  processOverrides: Record<string, unknown> = {},
) {
  const processo = db.process.seed({
    id: PROCESS_ID,
    internalStatus: "AGUARDANDO_PAGAMENTO",
    operationalStatus: "AGUARDANDO_PAGAMENTO",
    userFacingStatus: "RECEBIDO",
    ...processOverrides,
  });
  const pagamento = db.payment.seed({
    processId: PROCESS_ID,
    provider: "fake",
    amountCents: 10_000,
    status: "AGUARDANDO_PAGAMENTO",
    providerPaymentId: PROVIDER_PAYMENT_ID,
    ...paymentOverrides,
  });
  return { processo, pagamento };
}

beforeEach(() => {
  db = installFakePrisma();
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* -------------------------------------------------------------- confirmacao --- */

test("confirma pagamento pendente", async () => {
  const { pagamento } = semear();
  const result = await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

  assert.deepEqual(result, { ok: true, alreadyProcessed: false });
  assert.equal(pagamento.status, "PAGO");
  assert.ok(pagamento.paidAt instanceof Date);
  assert.equal(pagamento.webhookEventId, EVENT_ID, "o evento fica gravado para idempotencia");
});

test("aceita tanto AGUARDANDO_PAGAMENTO quanto PENDENTE", async () => {
  for (const status of ["AGUARDANDO_PAGAMENTO", "PENDENTE"]) {
    db = installFakePrisma();
    const { pagamento } = semear({ status });
    const result = await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

    assert.equal(result.ok, true, `${status} deveria confirmar`);
    assert.equal(pagamento.status, "PAGO");
  }
});

test("move as tres visoes de status juntas", async () => {
  const { processo } = semear();
  await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

  assert.equal(processo.internalStatus, "PAGO_EM_FILA");
  assert.equal(processo.operationalStatus, "PAGO_EM_FILA");
  assert.equal(processo.userFacingStatus, "PAGAMENTO_CONFIRMADO");
});

test("registra o evento de status com o ator SYSTEM", async () => {
  semear();
  await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

  assert.equal(db.processStatusEvent.rows.length, 1);
  const [evento] = db.processStatusEvent.rows;
  assert.equal(evento.processId, PROCESS_ID);
  assert.equal(evento.toStatus, "PAGO_EM_FILA");
  assert.equal(evento.fromStatus, "AGUARDANDO_PAGAMENTO");
  assert.equal(evento.actorRole, "SYSTEM");
  assert.equal(evento.actorMockUserId, "webhook");
});

test("a nota do evento nao despeja o eventId inteiro", async () => {
  const eventoLongo = `evt-${"x".repeat(200)}`;
  semear();
  await confirmPixPayment(eventoLongo, PROVIDER_PAYMENT_ID);

  const nota = String(db.processStatusEvent.rows[0].note);
  assert.ok(nota.length < 80, `nota longa demais: ${nota.length}`);
  assert.ok(!nota.includes(eventoLongo), "o eventId e truncado");
});

/* ------------------------------------------------------------ idempotencia --- */

test("o MESMO evento entregue duas vezes nao reprocessa", async () => {
  const { pagamento } = semear();
  const primeira = await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);
  const segunda = await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

  assert.deepEqual(primeira, { ok: true, alreadyProcessed: false });
  assert.deepEqual(segunda, { ok: true, alreadyProcessed: true });
  assert.equal(pagamento.status, "PAGO");
  assert.equal(db.processStatusEvent.rows.length, 1, "o historico nao pode duplicar");
});

test("pagamento ja PAGO por outro evento vira no-op", async () => {
  semear({ status: "PAGO", webhookEventId: "evt-anterior" });
  const result = await confirmPixPayment("evt-novo", PROVIDER_PAYMENT_ID);

  assert.deepEqual(result, { ok: true, alreadyProcessed: true });
  assert.equal(db.processStatusEvent.rows.length, 0, "nada de novo no historico");
});

/* ---------------------------------------- guarda de processo fechado (docs/57) --- */

test("bloqueia confirmacao quando internalStatus = CANCELADO_OPERACIONAL (cancelamento real)", async () => {
  const { pagamento, processo } = semear(
    {},
    { internalStatus: "CANCELADO_OPERACIONAL", operationalStatus: "PAGO_EM_FILA" },
  );
  const result = await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

  assert.deepEqual(result, {
    ok: false,
    error: "Nao e possivel confirmar pagamento de um processo encerrado.",
  });
  assert.equal(pagamento.status, "AGUARDANDO_PAGAMENTO", "PaymentStatus nao muda");
  assert.equal(processo.internalStatus, "CANCELADO_OPERACIONAL", "processo nao reativa");
  assert.equal(db.processStatusEvent.rows.length, 0, "nenhum evento de transicao e criado");
});

test("bloqueia confirmacao quando operationalStatus = CANCELADO_DEV (fechamento tecnico), mesma guarda isClosed", async () => {
  const { pagamento, processo } = semear(
    {},
    { operationalStatus: "CANCELADO_DEV", internalStatus: "AGUARDANDO_PAGAMENTO" },
  );
  const result = await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

  assert.equal(result.ok, false);
  assert.equal(pagamento.status, "AGUARDANDO_PAGAMENTO", "PaymentStatus nao muda");
  assert.equal(processo.internalStatus, "AGUARDANDO_PAGAMENTO", "internalStatus nao muda");
  assert.equal(db.processStatusEvent.rows.length, 0, "nenhum evento e criado");
});

test("processo ABERTO continua confirmando normalmente (nao-regressao da guarda nova)", async () => {
  const { pagamento, processo } = semear();
  const result = await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

  assert.equal(result.ok, true);
  assert.equal(pagamento.status, "PAGO");
  assert.equal(processo.internalStatus, "PAGO_EM_FILA");
});

test("a guarda roda ANTES de markPaid: pagamento fica exatamente como estava, nao so 'nao PAGO'", async () => {
  const { pagamento } = semear(
    { status: "PENDENTE" },
    { internalStatus: "CANCELADO_OPERACIONAL" },
  );
  await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

  assert.equal(pagamento.status, "PENDENTE", "status original preservado, nao so 'diferente de PAGO'");
  assert.equal(pagamento.paidAt, null, "paidAt nunca e setado");
  assert.equal(pagamento.webhookEventId, null, "webhookEventId nunca e gravado — reprocessar continuaria bloqueado");
});

test("reusa isClosed de operationalSignals.ts — nao reescreve a checagem de estado fechado", () => {
  const code = readFileSync("src/server/services/confirmPixPayment.ts", "utf8");
  assert.match(code, /import \{ isClosed \} from "@\/server\/processes\/operationalSignals"/);
  assert.match(
    code,
    /isClosed\(payment\.process\.operationalStatus, payment\.process\.internalStatus\)/,
  );
});

/* ------------------------------------------------------------------ guardas --- */

test("eventId ou providerPaymentId vazios sao rejeitados", async () => {
  semear();
  for (const [evento, provider] of [
    ["", PROVIDER_PAYMENT_ID],
    [EVENT_ID, ""],
    ["   ", PROVIDER_PAYMENT_ID],
    [EVENT_ID, "   "],
  ]) {
    const result = await confirmPixPayment(evento, provider);
    assert.equal(result.ok, false, `("${evento}","${provider}") deveria falhar`);
  }
  assert.equal(db.processStatusEvent.rows.length, 0);
});

test("pagamento inexistente falha de forma segura", async () => {
  const result = await confirmPixPayment(EVENT_ID, "nao-existe");
  assert.deepEqual(result, { ok: false, error: "Pagamento nao encontrado." });
});

test("estado inelegivel nao e confirmado", async () => {
  for (const status of ["FALHOU", "EXPIRADO", "CANCELADO"]) {
    db = installFakePrisma();
    const { pagamento } = semear({ status });
    const result = await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

    assert.equal(result.ok, false, `${status} nao deveria confirmar`);
    assert.equal(pagamento.status, status, "o status original permanece");
  }
});

/* ------------------------------ comportamento ATUAL registrado (sem mudar) --- */

test("COMPORTAMENTO ATUAL: nao ha conferencia de valor na confirmacao", async () => {
  // Registro honesto: um evento confirma o pagamento independentemente de
  // `amountCents`. Se um dia essa regra existir, este teste deve ser trocado
  // por um que exija a recusa — hoje exigi-la seria inventar regra.
  const { pagamento } = semear({ amountCents: 1 });
  const result = await confirmPixPayment(EVENT_ID, PROVIDER_PAYMENT_ID);

  assert.equal(result.ok, true);
  assert.equal(pagamento.status, "PAGO");
  assert.equal(pagamento.amountCents, 1, "o valor divergente e mantido, nao corrigido");
});

/* ------------------------------------------------------------------- escopo --- */

test("simulatePaymentApprovedAction (cliente) continua chamando confirmPixPayment sem alteracao — herda a guarda automaticamente", () => {
  const code = readFileSync("src/app/(user)/processos/[id]/actions.ts", "utf8");
  assert.match(code, /confirmPixPayment\(`SIM-\$\{payment\.id\}`, payment\.providerPaymentId\)/);
});

test("o service nao chama provider, rede nem Gov.br/SINARM", () => {
  const code = readFileSync("src/server/services/confirmPixPayment.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.doesNotMatch(code, /getPaymentProvider|mercadoPago/, "confirmacao nao chama PSP");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
  assert.doesNotMatch(code, /gov\.?br|sinarm/i, "sem Gov.br/SINARM");
  assert.doesNotMatch(code, /phase9|PHASE9/i, "sem Fase 9");
});
