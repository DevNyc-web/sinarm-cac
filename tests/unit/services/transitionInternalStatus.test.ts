/**
 * transitionInternalStatus — porta canonica de transicao (docs/44 §4, Fase 3a).
 *
 * O que estes testes protegem:
 *
 * 1. `fromStatus` sai do BANCO, nao do chamador. Evento tipado com estado errado
 *    mente numa trilha append-only — pior que evento sem estado.
 * 2. Sem `alsoSet`, nenhuma outra coluna de status e tocada. O helper NAO deriva
 *    `operationalStatus`/`userFacingStatus` de `internalStatus` (Fases 4/5).
 * 3. Processo inexistente nao escreve NADA — nem status, nem evento.
 * 4. Nenhum mapa `OperationalStatus` -> `InternalStatus` existe no modulo.
 *
 * Banco: fake via `globalThis.prisma` (`testPrisma.ts`). Sem Postgres, sem rede.
 * LIMITE HONESTO: prova o contrato do service. A atomicidade entre `update` e
 * evento NAO existe ainda (PR 3b) e nenhum teste aqui finge o contrario.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, type FakePrisma } from "./testPrisma";

process.env.DATABASE_URL ??= "postgresql://fake:fake@localhost:5432/fake";

import { transitionInternalStatus } from "../../../src/server/services/transitionInternalStatus";

let db: FakePrisma = installFakePrisma();

const PROCESS_ID = "test-transicao-processo";
const ATOR = { actorMockUserId: "user-admin", actorRole: "ADMIN" } as const;

beforeEach(() => {
  db = installFakePrisma();
});

function semearProcesso(overrides: Record<string, unknown> = {}) {
  return db.process.seed({
    id: PROCESS_ID,
    userId: "user-dono",
    code: "GT-7001",
    internalStatus: "RASCUNHO",
    operationalStatus: "RASCUNHO",
    userFacingStatus: "RECEBIDO",
    manualExecutionStatus: "EXECUCAO_MANUAL_NAO_INICIADA",
    ...overrides,
  });
}

function processo(): Record<string, unknown> {
  const row = db.process.rows.find((r) => r.id === PROCESS_ID);
  assert.ok(row, "processo semeado desapareceu");
  return row as Record<string, unknown>;
}

function eventoUnico(): Record<string, unknown> {
  assert.equal(db.processStatusEvent.rows.length, 1, "esperava exatamente um evento");
  return db.processStatusEvent.rows[0] as Record<string, unknown>;
}

test("altera internalStatus e devolve a transicao", async () => {
  semearProcesso();

  const r = await transitionInternalStatus({
    processId: PROCESS_ID,
    toStatus: "AGUARDANDO_PAGAMENTO",
    ...ATOR,
  });

  assert.equal(r.ok, true);
  assert.deepEqual(r, { ok: true, fromStatus: "RASCUNHO", toStatus: "AGUARDANDO_PAGAMENTO" });
  assert.equal(processo().internalStatus, "AGUARDANDO_PAGAMENTO");
});

test("registra evento tipado com fromStatus lido do banco", async () => {
  // Estado anterior DIFERENTE do default: se o helper chutasse "RASCUNHO" em vez
  // de ler, este teste falharia — e e o unico jeito de provar isso.
  semearProcesso({ internalStatus: "AGUARDANDO_PAGAMENTO" });

  await transitionInternalStatus({
    processId: PROCESS_ID,
    toStatus: "PAGO_EM_FILA",
    ...ATOR,
    note: "Pagamento confirmado",
  });

  const evento = eventoUnico();
  assert.equal(evento.fromStatus, "AGUARDANDO_PAGAMENTO");
  assert.equal(evento.toStatus, "PAGO_EM_FILA");
  assert.equal(evento.processId, PROCESS_ID);
  assert.equal(evento.actorMockUserId, "user-admin");
  assert.equal(evento.actorRole, "ADMIN");
  assert.equal(evento.note, "Pagamento confirmado");
});

test("alsoSet grava operationalStatus e userFacingStatus", async () => {
  semearProcesso({ internalStatus: "AGUARDANDO_PAGAMENTO" });

  await transitionInternalStatus({
    processId: PROCESS_ID,
    toStatus: "PAGO_EM_FILA",
    alsoSet: { operationalStatus: "PAGO_EM_FILA", userFacingStatus: "PAGAMENTO_CONFIRMADO" },
    ...ATOR,
  });

  const p = processo();
  assert.equal(p.internalStatus, "PAGO_EM_FILA");
  assert.equal(p.operationalStatus, "PAGO_EM_FILA");
  assert.equal(p.userFacingStatus, "PAGAMENTO_CONFIRMADO");
});

test("sem alsoSet, as outras visoes de status ficam INTACTAS", async () => {
  semearProcesso();

  await transitionInternalStatus({ processId: PROCESS_ID, toStatus: "PAGO_EM_FILA", ...ATOR });

  const p = processo();
  assert.equal(p.internalStatus, "PAGO_EM_FILA");
  // O helper NAO deriva: `operationalStatus` seguiria `PAGO_EM_FILA` se houvesse
  // um mapa implicito. Nao ha.
  assert.equal(p.operationalStatus, "RASCUNHO");
  assert.equal(p.userFacingStatus, "RECEBIDO");
  assert.equal(p.manualExecutionStatus, "EXECUCAO_MANUAL_NAO_INICIADA");
});

test("alsoSet parcial toca somente o que foi informado", async () => {
  semearProcesso();

  await transitionInternalStatus({
    processId: PROCESS_ID,
    toStatus: "PAGO_EM_FILA",
    alsoSet: { userFacingStatus: "PAGAMENTO_CONFIRMADO" },
    ...ATOR,
  });

  const p = processo();
  assert.equal(p.userFacingStatus, "PAGAMENTO_CONFIRMADO");
  assert.equal(p.operationalStatus, "RASCUNHO");
});

test("processo inexistente: falha sem escrever status nem evento", async () => {
  semearProcesso();

  const r = await transitionInternalStatus({
    processId: "nao-existe",
    toStatus: "PAGO_EM_FILA",
    ...ATOR,
  });

  assert.equal(r.ok, false);
  assert.equal(db.processStatusEvent.rows.length, 0, "nao pode registrar evento");
  assert.equal(processo().internalStatus, "RASCUNHO", "nao pode tocar outro processo");
});

test("evento nao carrega PII: so ids tecnicos, ator e nota curta", async () => {
  semearProcesso();

  await transitionInternalStatus({
    processId: PROCESS_ID,
    toStatus: "PAGO_EM_FILA",
    ...ATOR,
    note: "Transicao de teste",
  });

  const chaves = Object.keys(eventoUnico()).sort();
  // Campo novo na trilha e decisao de PII, nao detalhe: este teste falha de
  // proposito se algum aparecer.
  //
  // `fromValue`/`toValue` NAO aparecem: sao do registrador OPERACIONAL. A porta
  // canonica usa `recordStatusEvent`, que grava a transicao tipada e nada de
  // rotulo — e essa diferenca e justamente o ponto da Fase 1.
  assert.deepEqual(chaves, [
    "actorMockUserId",
    "actorRole",
    "createdAt",
    "fromStatus",
    "id",
    "note",
    "processId",
    "toStatus",
  ]);
});

test("o modulo nao usa os estados da Fase 2 nem cria mapa operacional", () => {
  const source = readFileSync("src/server/services/transitionInternalStatus.ts", "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

  // Os dois estados da Fase 2 nao tem consumidor legitimo ainda: nao existe ato
  // irreversivel nem sessao de navegador neste codigo.
  assert.ok(!code.includes("AGUARDANDO_CONFIRMACAO_HUMANA"), "sem estado de confirmacao");
  assert.ok(!code.includes("AGUARDANDO_CAPTCHA"), "sem estado de captcha");

  // Nenhum mapa `OperationalStatus` -> `InternalStatus`: os estados que
  // inventariam causa/reembolso/tipo de pausa nao podem aparecer no codigo.
  for (const proibido of ["BLOQUEADO_INSTABILIDADE", "CANCELADO_REEMBOLSADO", "EM_REVISAO_HUMANA"]) {
    assert.ok(!code.includes(proibido), `${proibido}: sem mapa implicito`);
  }

  // Fase 3b INVERTEU esta guarda: antes exigia AUSENCIA de `$transaction`
  // (atomicidade era trabalho de outro PR); agora exige a presenca, senao a
  // promessa de atomicidade do modulo vira comentario sem lastro.
  assert.match(code, /\$transaction\(async \(tx\)/, "a transicao roda em $transaction");
  // O evento tem de receber o MESMO `tx`. Sem isto, a trilha sairia do escopo
  // transacional e a janela status-sem-evento voltaria em silencio.
  assert.match(code, /recordStatusEvent\([\s\S]*?tx,?\s*\)/, "evento gravado com o tx");
});

test("a transicao e ATOMICA: falha no evento reverte o internalStatus", async () => {
  semearProcesso();
  const original = db.processStatusEvent.create.bind(db.processStatusEvent);
  db.processStatusEvent.create = async () => {
    throw new Error("falha simulada ao gravar evento");
  };

  await assert.rejects(
    () => transitionInternalStatus({ processId: PROCESS_ID, toStatus: "PAGO_EM_FILA", ...ATOR }),
    /falha simulada/,
    "o erro tem de propagar, nao ser engolido",
  );

  db.processStatusEvent.create = original;
  assert.equal(processo().internalStatus, "RASCUNHO", "status deveria ter voltado");
  assert.equal(db.processStatusEvent.rows.length, 0, "nenhum evento gravado");
});

test("falha no evento reverte TAMBEM as colunas de alsoSet", async () => {
  semearProcesso();
  db.processStatusEvent.create = async () => {
    throw new Error("falha simulada ao gravar evento");
  };

  await assert.rejects(() =>
    transitionInternalStatus({
      processId: PROCESS_ID,
      toStatus: "PAGO_EM_FILA",
      alsoSet: { operationalStatus: "PAGO_EM_FILA", userFacingStatus: "PAGAMENTO_CONFIRMADO" },
      ...ATOR,
    }),
  );

  const p = processo();
  assert.equal(p.internalStatus, "RASCUNHO");
  // A parte que mais importa: `alsoSet` entrou na MESMA `update`, entao tem de
  // voltar junto. Reverter so o canonico deixaria o processo incoerente.
  assert.equal(p.operationalStatus, "RASCUNHO");
  assert.equal(p.userFacingStatus, "RECEBIDO");
});

test("FakePrisma.$transaction: sucesso NAO restaura o snapshot", async () => {
  semearProcesso();

  const r = await db.$transaction(async (tx) => {
    await tx.process.update({ where: { id: PROCESS_ID }, data: { internalStatus: "PAGO_EM_FILA" } });
    return "pronto";
  });

  assert.equal(r, "pronto", "o retorno do callback tem de chegar a quem chamou");
  assert.equal(processo().internalStatus, "PAGO_EM_FILA", "commit deve persistir");
});

test("FakePrisma.$transaction: rollback restaura TODAS as tabelas", async () => {
  semearProcesso();
  db.payment.seed({ id: "pay-1", processId: PROCESS_ID, status: "PENDENTE", amountCents: 10_000 });

  await assert.rejects(() =>
    db.$transaction(async (tx) => {
      await tx.process.update({
        where: { id: PROCESS_ID },
        data: { internalStatus: "PAGO_EM_FILA" },
      });
      await tx.payment.update({ where: { id: "pay-1" }, data: { status: "PAGO" } });
      await tx.processStatusEvent.create({
        data: { processId: PROCESS_ID, toStatus: "PAGO_EM_FILA", actorMockUserId: "x", actorRole: "Y" },
      });
      throw new Error("aborta depois de mexer em tres tabelas");
    }),
  );

  // Snapshot por tabela, nao so a que o codigo em teste alterou: um rollback
  // parcial passaria no teste anterior e deixaria lixo em outra tabela.
  assert.equal(processo().internalStatus, "RASCUNHO");
  assert.equal(db.payment.rows[0].status, "PENDENTE");
  assert.equal(db.processStatusEvent.rows.length, 0, "linha criada dentro da tx deve sumir");
});

test("FakePrisma.$transaction recusa a forma com array de promises", async () => {
  // A forma em array executa fora do escopo que este fake entende; aceitar as
  // duas daria falsa confianca.
  await assert.rejects(
    () => (db.$transaction as unknown as (a: unknown) => Promise<unknown>)([Promise.resolve(1)]),
    /somente a forma com callback/,
  );
});
