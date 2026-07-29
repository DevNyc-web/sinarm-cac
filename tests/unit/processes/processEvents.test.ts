/**
 * processEventRepository — trilha de eventos APPEND-ONLY (docs/12 §3.5).
 *
 * Foco: a auditoria TIPADA aditiva da Fase 1 (docs/44 §8) — `recordOperationalEvent`
 * passou a aceitar `fromStatus`/`toStatus` OPCIONAIS.
 *
 * O que estes testes protegem, nesta ordem de importancia:
 *
 * 1. Omitir os campos novos grava exatamente o que se gravava antes deles
 *    existirem. Se isto quebrar, os 11 call sites atuais mudaram de
 *    comportamento sem ninguem pedir.
 * 2. Meia transicao e valida. Informar so um lado NAO pode fazer o repositorio
 *    preencher o outro — auditoria inventada e pior que auditoria ausente.
 * 3. Nao existe mapeamento `OperationalStatus` -> `InternalStatus`. Nenhum teste
 *    aqui semeia um estado operacional esperando que um interno apareca.
 *
 * Banco: fake via `globalThis.prisma` (`testPrisma.ts`). Sem Postgres, sem rede.
 * LIMITE HONESTO: prova o contrato do repositorio, nao constraints do Postgres.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installFakePrisma, type FakePrisma } from "../services/testPrisma";

process.env.DATABASE_URL ??= "postgresql://fake:fake@localhost:5432/fake";

import {
  recordOperationalEvent,
  recordStatusEvent,
} from "../../../src/server/repositories/processEventRepository";

let db: FakePrisma = installFakePrisma();

const PROCESS_ID = "test-evento-processo";
const ATOR = { actorMockUserId: "user-admin", actorRole: "ADMIN" } as const;

beforeEach(() => {
  db = installFakePrisma();
});

function eventoUnico(): Record<string, unknown> {
  assert.equal(db.processStatusEvent.rows.length, 1, "esperava exatamente um evento");
  return db.processStatusEvent.rows[0] as Record<string, unknown>;
}

test("sem fromStatus/toStatus: preserva rotulos e deixa os tipados nulos", async () => {
  await recordOperationalEvent({
    processId: PROCESS_ID,
    kind: "PRIORIDADE",
    fromValue: "Normal",
    toValue: "Urgente",
    ...ATOR,
  });

  const evento = eventoUnico();
  assert.equal(evento.fromValue, "Normal");
  assert.equal(evento.toValue, "Urgente");
  assert.equal(evento.kind, "PRIORIDADE");
  // `null`, nao `undefined`: e o mesmo criterio de `fromValue`, e e o que a
  // coluna nullable guarda hoje nos 11 call sites que nao passam nada.
  assert.equal(evento.fromStatus, null);
  assert.equal(evento.toStatus, null);
});

test("sem rotulos nem tipados: evento continua valido, tudo nulo", async () => {
  await recordOperationalEvent({ processId: PROCESS_ID, kind: "NOTA", ...ATOR });

  const evento = eventoUnico();
  assert.equal(evento.fromValue, null);
  assert.equal(evento.toValue, null);
  assert.equal(evento.fromStatus, null);
  assert.equal(evento.toStatus, null);
});

test("com fromStatus/toStatus: grava os enums E preserva os rotulos", async () => {
  await recordOperationalEvent({
    processId: PROCESS_ID,
    kind: "STATUS_OPERACIONAL",
    fromValue: "Rascunho",
    toValue: "Aguardando pagamento",
    fromStatus: "RASCUNHO",
    toStatus: "AGUARDANDO_PAGAMENTO",
    ...ATOR,
  });

  const evento = eventoUnico();
  assert.equal(evento.fromStatus, "RASCUNHO");
  assert.equal(evento.toStatus, "AGUARDANDO_PAGAMENTO");
  // Os rotulos NAO sao substituidos pelos tipados: a trilha atual continua
  // legivel para quem ja consome `fromValue`/`toValue`.
  assert.equal(evento.fromValue, "Rascunho");
  assert.equal(evento.toValue, "Aguardando pagamento");
});

test("so toStatus: grava o informado e NAO inventa fromStatus", async () => {
  await recordOperationalEvent({
    processId: PROCESS_ID,
    kind: "STATUS_OPERACIONAL",
    toStatus: "PAGO_EM_FILA",
    ...ATOR,
  });

  const evento = eventoUnico();
  assert.equal(evento.toStatus, "PAGO_EM_FILA");
  assert.equal(evento.fromStatus, null);
});

test("so fromStatus: grava o informado e NAO inventa toStatus", async () => {
  await recordOperationalEvent({
    processId: PROCESS_ID,
    kind: "STATUS_OPERACIONAL",
    fromStatus: "RASCUNHO",
    ...ATOR,
  });

  const evento = eventoUnico();
  assert.equal(evento.fromStatus, "RASCUNHO");
  assert.equal(evento.toStatus, null);
});

test("null explicito e equivalente a omitir", async () => {
  await recordOperationalEvent({
    processId: PROCESS_ID,
    kind: "RESPONSAVEL",
    fromStatus: null,
    toStatus: null,
    ...ATOR,
  });

  const evento = eventoUnico();
  assert.equal(evento.fromStatus, null);
  assert.equal(evento.toStatus, null);
});

test("recordStatusEvent segue inalterado: grava a transicao tipada", async () => {
  await recordStatusEvent({
    processId: PROCESS_ID,
    fromStatus: "AGUARDANDO_PAGAMENTO",
    toStatus: "PAGO_EM_FILA",
    ...ATOR,
    note: "Pagamento confirmado",
  });

  const evento = eventoUnico();
  assert.equal(evento.fromStatus, "AGUARDANDO_PAGAMENTO");
  assert.equal(evento.toStatus, "PAGO_EM_FILA");
  assert.equal(evento.note, "Pagamento confirmado");
  // O caminho do `confirmPixPayment` nao passa `kind` — o default do schema
  // (`STATUS_INTERNO`) e quem responde por ele.
  assert.equal(evento.kind, undefined);
});

test("trilha e append-only: eventos se acumulam, nao se sobrescrevem", async () => {
  await recordOperationalEvent({ processId: PROCESS_ID, kind: "NOTA", ...ATOR });
  await recordOperationalEvent({
    processId: PROCESS_ID,
    kind: "STATUS_OPERACIONAL",
    toStatus: "PAGO_EM_FILA",
    ...ATOR,
  });

  assert.equal(db.processStatusEvent.rows.length, 2);
  const [primeiro, segundo] = db.processStatusEvent.rows as Record<string, unknown>[];
  assert.equal(primeiro.toStatus, null);
  assert.equal(segundo.toStatus, "PAGO_EM_FILA");
});

test("evento nao carrega PII: so id de processo, ator, rotulo curto e nota", async () => {
  await recordOperationalEvent({
    processId: PROCESS_ID,
    kind: "STATUS_OPERACIONAL",
    fromValue: "Rascunho",
    toValue: "Pago / em fila",
    toStatus: "PAGO_EM_FILA",
    ...ATOR,
  });

  const chaves = Object.keys(eventoUnico()).sort();
  // Se um campo novo entrar no evento, este teste falha de proposito: campo novo
  // na trilha e decisao de PII, nao detalhe de implementacao.
  assert.deepEqual(chaves, [
    "actorMockUserId",
    "actorRole",
    "createdAt",
    "fromStatus",
    "fromValue",
    "id",
    "kind",
    "note",
    "processId",
    "toStatus",
    "toValue",
  ]);
});
