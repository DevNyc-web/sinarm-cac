/**
 * createPixPayment — testes COMPORTAMENTAIS (sem Postgres, sem rede).
 *
 * Banco: fake via `globalThis.prisma` (ver `testPrisma.ts`).
 * Provider: o FAKE real do projeto (default `PAYMENT_PROVIDER=fake`), que nao
 * abre conexao alguma. Nada de Mercado Pago aqui — o sandbox exigiria token e
 * rede, e ambos estao fora deste PR.
 *
 * LIMITE HONESTO: prova a logica do service, nao constraints do Postgres.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";

// `getEnv()` valida DATABASE_URL (Zod, min 1) e e alcancado por
// getPaymentProvider(). Valor sintetico: o cliente real nunca e construido,
// entao esta string jamais vira conexao.
process.env.DATABASE_URL ??= "postgresql://fake:fake@localhost:5432/fake";
process.env.PAYMENT_PROVIDER = "fake";

import { createPixPayment } from "../../../src/server/services/createPixPayment";
import { SERVICE_TOTAL_CENTS } from "../../../src/server/processes/pricing";

let db: FakePrisma = installFakePrisma();

const DONO = { id: "user-dono", name: "Dona", email: "dona@example.com", role: "USER" } as const;
const OUTRO = { id: "user-outro", name: "Outro", email: "o@example.com", role: "USER" } as const;

const PROCESS_ID = "test-pix-process";

function semearProcesso(overrides: Record<string, unknown> = {}) {
  return db.process.seed({
    id: PROCESS_ID,
    userId: DONO.id,
    code: "GT-9001",
    internalStatus: "RASCUNHO",
    ...overrides,
  });
}

beforeEach(() => {
  db = installFakePrisma();
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ------------------------------------------------------------------- valor --- */

test("cria a cobranca com o total centralizado do pricing", async () => {
  semearProcesso();
  const result = await createPixPayment(DONO, PROCESS_ID);

  assert.deepEqual(result, { ok: true });
  assert.equal(db.payment.rows.length, 1);
  assert.equal(db.payment.rows[0].amountCents, SERVICE_TOTAL_CENTS);
});

test("o valor NAO pode ser influenciado pelo chamador", () => {
  // Trava de assinatura: o service so aceita ator e processo. Se um dia
  // aparecer um terceiro parametro de valor, isto quebra.
  assert.equal(createPixPayment.length, 2, "createPixPayment(actor, processId)");
});

test("a cobranca nasce em BRL com o provider registrado", async () => {
  semearProcesso();
  await createPixPayment(DONO, PROCESS_ID);

  const [pagamento] = db.payment.rows;
  assert.equal(pagamento.currency, "BRL");
  assert.equal(pagamento.provider, "fake");
  assert.equal(pagamento.processId, PROCESS_ID);
});

/* ------------------------------------------------------------- propriedade --- */

test("nao cria cobranca para processo de outro usuario", async () => {
  semearProcesso();
  const result = await createPixPayment(OUTRO, PROCESS_ID);

  assert.deepEqual(result, { ok: false, error: "Processo nao encontrado." });
  assert.equal(db.payment.rows.length, 0);
});

test("processo inexistente e recusado", async () => {
  const result = await createPixPayment(DONO, "nao-existe");
  assert.equal(result.ok, false);
  assert.equal(db.payment.rows.length, 0);
});

/* --------------------------------------------------------- status elegivel --- */

test("aceita RASCUNHO e AGUARDANDO_PAGAMENTO", async () => {
  for (const status of ["RASCUNHO", "AGUARDANDO_PAGAMENTO"]) {
    db = installFakePrisma();
    semearProcesso({ internalStatus: status });
    const result = await createPixPayment(DONO, PROCESS_ID);
    assert.equal(result.ok, true, `${status} deveria permitir cobranca`);
  }
});

test("recusa processo que nao esta aguardando pagamento", async () => {
  for (const status of ["PAGO_EM_FILA", "CONCLUIDO", "CANCELADO_REEMBOLSADO"]) {
    db = installFakePrisma();
    semearProcesso({ internalStatus: status });
    const result = await createPixPayment(DONO, PROCESS_ID);

    assert.equal(result.ok, false, `${status} nao deveria gerar cobranca`);
    assert.equal(db.payment.rows.length, 0);
  }
});

/* ------------------------------------------------------- cobranca duplicada --- */

test("reaproveita cobranca ativa em vez de duplicar", async () => {
  semearProcesso();
  await createPixPayment(DONO, PROCESS_ID);
  assert.equal(db.payment.rows.length, 1);

  const result = await createPixPayment(DONO, PROCESS_ID);
  assert.deepEqual(result, { ok: true });
  assert.equal(db.payment.rows.length, 1, "a segunda chamada nao cria outra cobranca");
});

test("cobranca expirada nao conta como ativa", async () => {
  semearProcesso();
  db.payment.seed({
    processId: PROCESS_ID,
    status: "AGUARDANDO_PAGAMENTO",
    amountCents: SERVICE_TOTAL_CENTS,
    provider: "fake",
    expiresAt: new Date(Date.now() - 60_000),
  });

  await createPixPayment(DONO, PROCESS_ID);
  assert.equal(db.payment.rows.length, 2, "expirada nao bloqueia nova cobranca");
});

/* -------------------------------------------------------- provider ficticio --- */

test("o payload do provider fake e explicitamente nao pagavel", async () => {
  semearProcesso();
  await createPixPayment(DONO, PROCESS_ID);

  const [pagamento] = db.payment.rows;
  assert.match(String(pagamento.pixCopyPaste), /NAO-PAGAVEL/);
  assert.match(String(pagamento.pixQrCode), /PIX-FICTICIO-DEV/);
  assert.equal(pagamento.status, "AGUARDANDO_PAGAMENTO", "a carga anexada move o status");
  assert.match(String(pagamento.providerPaymentId), /^FAKE-/);
});

test("a cobranca fake nasce com expiracao definida", async () => {
  semearProcesso();
  await createPixPayment(DONO, PROCESS_ID);
  assert.ok(db.payment.rows[0].expiresAt instanceof Date);
});

/* ------------------------------------------------------------------- escopo --- */

test("o service nao chama rede nem toca Gov.br/SINARM", () => {
  const code = readFileSync("src/server/services/createPixPayment.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede no service");
  assert.doesNotMatch(code, /gov\.?br|sinarm/i, "sem Gov.br/SINARM");
  assert.doesNotMatch(code, /phase9|PHASE9/i, "sem Fase 9");
});
