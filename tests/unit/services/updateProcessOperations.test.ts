/**
 * updateProcessOperations — testes COMPORTAMENTAIS (sem Postgres).
 *
 * Foco: `changeOperationalStatus`, a porta MANUAL/admin (docs/46 §3.5). A
 * Fase 5g migrou 3 dos 9 valores para a porta canonica
 * (`transitionInternalStatus`) — RASCUNHO, AGUARDANDO_PAGAMENTO, PAGO_EM_FILA,
 * os unicos com InternalStatus homonimo (docs/46 §6). Os outros 6 continuam
 * no caminho legado de sempre: so `operationalStatus`/`userFacingStatus`, sem
 * tocar `internalStatus`, com o evento OPERACIONAL de sempre (kind
 * `STATUS_OPERACIONAL`, rotulo em `fromValue`/`toValue`).
 *
 * `assignProcess`/`changePriority` nao mudaram nesta fase — nao tem teste
 * dedicado aqui de proposito, para o arquivo ficar focado no que a Fase 5g
 * realmente tocou.
 *
 * Banco: fake via `globalThis.prisma` (ver `testPrisma.ts`).
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import { changeOperationalStatus } from "../../../src/server/services/updateProcessOperations";

let db: FakePrisma = installFakePrisma();

const ADMIN = { id: "mock-admin", name: "Admin", email: "admin@example.com", role: "ADMIN" } as const;

const PROCESS_ID = "test-change-operational-status";

function semearProcesso(overrides: Record<string, unknown> = {}) {
  return db.process.seed({ id: PROCESS_ID, userId: "user-dono", ...overrides });
}

beforeEach(() => {
  db = installFakePrisma();
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ---------------------------------------------------------- entrada/guardas --- */

test("recusa valor fora do enum OperationalStatus", async () => {
  semearProcesso();
  const result = await changeOperationalStatus(ADMIN, PROCESS_ID, "NAO_EXISTE");
  assert.deepEqual(result, { ok: false, error: "Status operacional invalido." });
});

test("processo inexistente e recusado", async () => {
  const result = await changeOperationalStatus(ADMIN, "nao-existe", "RASCUNHO");
  assert.equal(result.ok, false);
});

test("mesmo valor e no-op: nao chama a porta canonica nem grava evento", async () => {
  semearProcesso({ operationalStatus: "PAGO_EM_FILA", internalStatus: "PAGO_EM_FILA" });
  const result = await changeOperationalStatus(ADMIN, PROCESS_ID, "PAGO_EM_FILA");
  assert.deepEqual(result, { ok: true });
  assert.equal(db.processStatusEvent.rows.length, 0, "no-op nao deveria gravar evento");
});

/* --------------------------------------- Fase 5g: os 3 valores MIGRADOS --- */

const SEGUROS = [
  { operational: "RASCUNHO", internal: "RASCUNHO", userFacing: "RECEBIDO" },
  { operational: "AGUARDANDO_PAGAMENTO", internal: "AGUARDANDO_PAGAMENTO", userFacing: "RECEBIDO" },
  { operational: "PAGO_EM_FILA", internal: "PAGO_EM_FILA", userFacing: "PAGAMENTO_CONFIRMADO" },
] as const;

for (const { operational, internal, userFacing } of SEGUROS) {
  test(`${operational}: usa a porta canonica, internalStatus vai para ${internal}`, async () => {
    const processo = semearProcesso({ operationalStatus: "DOCUMENTO_ENVIADO", internalStatus: "RASCUNHO" });
    const result = await changeOperationalStatus(ADMIN, PROCESS_ID, operational);
    assert.equal(result.ok, true);
    assert.equal(processo.internalStatus, internal);
  });

  test(`${operational}: operationalStatus final e IDENTICO ao valor escolhido (mesmo efeito de sempre)`, async () => {
    const processo = semearProcesso({ operationalStatus: "DOCUMENTO_ENVIADO", internalStatus: "RASCUNHO" });
    await changeOperationalStatus(ADMIN, PROCESS_ID, operational);
    assert.equal(processo.operationalStatus, operational);
  });

  test(`${operational}: userFacingStatus segue o mesmo mapeamento de antes`, async () => {
    const processo = semearProcesso({ operationalStatus: "DOCUMENTO_ENVIADO", internalStatus: "RASCUNHO" });
    await changeOperationalStatus(ADMIN, PROCESS_ID, operational);
    assert.equal(processo.userFacingStatus, userFacing);
  });

  test(`${operational}: registra EXATAMENTE um evento TIPADO (fromStatus/toStatus), sem evento operacional`, async () => {
    semearProcesso({ operationalStatus: "DOCUMENTO_ENVIADO", internalStatus: "RASCUNHO" });
    await changeOperationalStatus(ADMIN, PROCESS_ID, operational);

    assert.equal(db.processStatusEvent.rows.length, 1, "so um evento por transicao");
    const [evento] = db.processStatusEvent.rows;
    assert.equal(evento.processId, PROCESS_ID);
    assert.equal(evento.fromStatus, "RASCUNHO", "fromStatus vem do internalStatus ANTERIOR, lido no banco");
    assert.equal(evento.toStatus, internal);
    assert.equal(evento.actorMockUserId, ADMIN.id);
    assert.equal(evento.actorRole, ADMIN.role);
    assert.notEqual(evento.kind, "STATUS_OPERACIONAL", "evento tipado nao usa o kind legado");
  });
}

test("os 3 valores seguros passam a chamar transitionInternalStatus — fromStatus reflete o internalStatus real, nao o operationalStatus", async () => {
  // Prova que o `fromStatus` do evento tipado vem de onde a porta canonica
  // sempre leu (o internalStatus ATUAL no banco), nao de uma suposicao feita
  // aqui: semeia um processo com operationalStatus e internalStatus
  // deliberadamente DIFERENTES para que a confusao ficasse visivel se houvesse.
  const processo = semearProcesso({
    operationalStatus: "EM_REVISAO_OPERACIONAL",
    internalStatus: "DOCUMENTO_VALIDADO",
  });
  await changeOperationalStatus(ADMIN, PROCESS_ID, "PAGO_EM_FILA");
  assert.equal(processo.internalStatus, "PAGO_EM_FILA");
  const [evento] = db.processStatusEvent.rows;
  assert.equal(evento.fromStatus, "DOCUMENTO_VALIDADO");
  assert.equal(evento.toStatus, "PAGO_EM_FILA");
});

/* -------------------------------------------- Fase 5g: os 6 valores LEGADOS --- */

const LEGADOS = [
  "DOCUMENTO_ENVIADO",
  "DOCUMENTO_APROVADO",
  "EM_REVISAO_OPERACIONAL",
  "PRONTO_PARA_PROTOCOLO_MANUAL",
  "BLOQUEADO",
  "CANCELADO_DEV",
] as const;

for (const legado of LEGADOS) {
  test(`${legado}: NAO toca internalStatus — continua legado nesta fase`, async () => {
    const processo = semearProcesso({ operationalStatus: "RASCUNHO", internalStatus: "RASCUNHO" });
    const result = await changeOperationalStatus(ADMIN, PROCESS_ID, legado);
    assert.equal(result.ok, true);
    assert.equal(processo.internalStatus, "RASCUNHO", `${legado} nao deveria mexer em internalStatus`);
    assert.equal(processo.operationalStatus, legado);
  });

  test(`${legado}: continua gravando o evento OPERACIONAL de sempre (kind STATUS_OPERACIONAL), sem evento tipado`, async () => {
    semearProcesso({ operationalStatus: "RASCUNHO", internalStatus: "RASCUNHO" });
    await changeOperationalStatus(ADMIN, PROCESS_ID, legado);

    assert.equal(db.processStatusEvent.rows.length, 1, "so um evento por transicao");
    const [evento] = db.processStatusEvent.rows;
    assert.equal(evento.kind, "STATUS_OPERACIONAL");
    assert.equal(evento.actorMockUserId, ADMIN.id);
    assert.equal(evento.actorRole, ADMIN.role);
    // Rotulo, nao enum: exatamente o comportamento de antes da Fase 5g.
    assert.equal(typeof evento.fromValue, "string");
    assert.equal(typeof evento.toValue, "string");
    assert.equal(evento.fromStatus, null, "evento legado nao afirma internalStatus nenhum");
    assert.equal(evento.toStatus, null);
  });
}

test("BLOQUEADO: nao mapeia para BLOQUEADO_INSTABILIDADE, EXCECAO_* nem BLOQUEADO_OPERACIONAL — fica fora da porta canonica", async () => {
  const processo = semearProcesso({ operationalStatus: "DOCUMENTO_ENVIADO", internalStatus: "RASCUNHO" });
  await changeOperationalStatus(ADMIN, PROCESS_ID, "BLOQUEADO");
  assert.equal(processo.operationalStatus, "BLOQUEADO");
  assert.equal(processo.internalStatus, "RASCUNHO", "BLOQUEADO nao pode mover internalStatus");
  assert.equal(db.processStatusEvent.rows.length, 1);
  assert.equal(db.processStatusEvent.rows[0].kind, "STATUS_OPERACIONAL");
});

test("PRONTO_PARA_PROTOCOLO_MANUAL: preserva a nota de protocolo manual no evento legado", async () => {
  semearProcesso({ operationalStatus: "RASCUNHO", internalStatus: "RASCUNHO" });
  await changeOperationalStatus(ADMIN, PROCESS_ID, "PRONTO_PARA_PROTOCOLO_MANUAL");
  const [evento] = db.processStatusEvent.rows;
  assert.match(String(evento.note), /MANUAL/);
});

test("DOCUMENTO_ENVIADO/DOCUMENTO_APROVADO: tem candidato canonico mas NAO migram nesta porta (decisao fora da Fase 5g)", async () => {
  for (const valor of ["DOCUMENTO_ENVIADO", "DOCUMENTO_APROVADO"] as const) {
    db = installFakePrisma();
    const processo = semearProcesso({ operationalStatus: "RASCUNHO", internalStatus: "RASCUNHO" });
    await changeOperationalStatus(ADMIN, PROCESS_ID, valor);
    assert.equal(processo.internalStatus, "RASCUNHO", `${valor} nao deveria mover internalStatus nesta fase`);
  }
});
