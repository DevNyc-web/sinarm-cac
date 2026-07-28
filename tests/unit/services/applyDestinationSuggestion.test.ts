/**
 * Aplicacao manual de sugestao de destino — testes COMPORTAMENTAIS do service.
 *
 * Ponto central do PR #47C: este e o unico consumidor que GRAVA a partir da
 * conferencia. Se a troca de fonte mudasse o valor derivado, o efeito nao seria
 * visual — seria um dado errado escrito no processo do cliente e uma linha de
 * trilha append-only que ninguem apaga. Por isso a fonte persistida e testada
 * aqui de ponta a ponta, e nao so por varredura estatica.
 *
 * Banco: fake via `globalThis.prisma`. Sem Postgres, sem OCR, sem rede.
 */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import { applyDestinationSuggestion } from "../../../src/server/services/applyDestinationSuggestion";
import { type AuthUser } from "../../../src/server/auth/mockUsers";

let db: FakePrisma = installFakePrisma();

const PROC = "proc-1";
const DOC = "doc-destino";

/** Id de sugestao = `${documentId}:${fieldKey}` (ver buildFieldSuggestions). */
const SUGESTAO_NOME_LOCAL = `${DOC}:nomeLocalEvento`;
const DONO: AuthUser = {
  id: "user-dono",
  name: "Dona do Processo",
  role: "USER",
  email: "dona@exemplo.test",
};

/** Sugestao de destino nasce de documento CONFIRMADO (APROVADO) do tipo destino. */
function seedCenario() {
  db = installFakePrisma();
  db.process.seed({ id: PROC, userId: DONO.id });
  db.destination.seed({
    processId: PROC,
    eventName: "Clube Atual (exemplo)",
    uf: "AA",
    city: "Cidade Atual",
    street: "Rua Atual",
    number: "123",
  });
  db.processDocument.seed({
    id: DOC,
    processId: PROC,
    type: "DECLARACAO_DESTINO_EVENTO",
    status: "APROVADO",
    originalFileName: "destino.pdf",
    createdAt: new Date("2026-01-01T10:00:00Z"),
  });
}

/** Grava uma extracao utilizavel com um valor DIFERENTE do mock. */
function seedExtracao(value: string, state = "EXTRAIDA") {
  db.documentExtraction.seed({
    documentId: DOC,
    state,
    engine: "mock",
    engineVersion: "0.1.0-mock",
    fields: [{ key: "nomeLocalEvento", label: "Nome do local / evento", value, confidence: "ALTA" }],
    createdAt: new Date(),
  });
}

function destinoAtual() {
  return db.destination.rows.find((row) => row.processId === PROC);
}

beforeEach(seedCenario);

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ------------------------------------------------- neutralidade (#47C) --- */

test("SEM extracao persistida, aplica o valor de demonstracao — como antes do #47C", async () => {
  const result = await applyDestinationSuggestion(DONO, PROC, SUGESTAO_NOME_LOCAL, true);

  assert.ok(result.ok, `esperava sucesso, veio: ${!result.ok && result.error}`);
  assert.match(
    String(destinoAtual()?.eventName),
    /exemplo|fict[íi]cio/i,
    "sem linha persistida, o valor continua sendo o mock",
  );
});

test("COM extracao persistida utilizavel, aplica o valor PERSISTIDO", async () => {
  seedExtracao("Clube Persistido do Banco");

  const result = await applyDestinationSuggestion(DONO, PROC, SUGESTAO_NOME_LOCAL, true);

  assert.ok(result.ok, `esperava sucesso, veio: ${!result.ok && result.error}`);
  assert.equal(
    destinoAtual()?.eventName,
    "Clube Persistido do Banco",
    "a fonte persistida tem de vencer o mock no valor GRAVADO",
  );
});

test("estado nao utilizavel volta ao mock — nao grava campo de tentativa pendente", async () => {
  for (const state of ["PENDENTE", "PROCESSANDO", "FALHOU"]) {
    seedCenario();
    seedExtracao("NAO DEVERIA SER GRAVADO", state);

    const result = await applyDestinationSuggestion(DONO, PROC, SUGESTAO_NOME_LOCAL, true);

    assert.ok(result.ok);
    assert.notEqual(
      destinoAtual()?.eventName,
      "NAO DEVERIA SER GRAVADO",
      `${state}: campo de tentativa nao utilizavel nao pode chegar ao processo`,
    );
  }
});

test("JSON corrompido volta ao mock, sem quebrar a aplicacao", async () => {
  db.documentExtraction.seed({
    documentId: DOC,
    state: "EXTRAIDA",
    engine: "mock",
    engineVersion: "0.1.0-mock",
    fields: "isto nao e um array de campos",
    createdAt: new Date(),
  });

  const result = await applyDestinationSuggestion(DONO, PROC, SUGESTAO_NOME_LOCAL, true);

  assert.ok(result.ok, "linha corrompida nao pode derrubar a aplicacao");
  assert.match(String(destinoAtual()?.eventName), /exemplo|fict[íi]cio/i, "caiu no mock");
});

/* ------------------------------------------- guardas que nao mudaram --- */

test("sem confirmacao explicita, nada e aplicado", async () => {
  const antes = destinoAtual()?.eventName;
  const result = await applyDestinationSuggestion(DONO, PROC, SUGESTAO_NOME_LOCAL, false);

  assert.equal(result.ok, false);
  assert.equal(destinoAtual()?.eventName, antes, "o destino nao pode ter mudado");
});

test("usuario que nao e dono nao aplica nada", async () => {
  const antes = destinoAtual()?.eventName;
  const outro: AuthUser = { ...DONO, id: "user-outro" };

  const result = await applyDestinationSuggestion(outro, PROC, SUGESTAO_NOME_LOCAL, true);

  assert.equal(result.ok, false);
  assert.equal(destinoAtual()?.eventName, antes);
});

test("sugestao inexistente e recusada", async () => {
  const result = await applyDestinationSuggestion(DONO, PROC, "doc-destino:naoExiste", true);
  assert.equal(result.ok, false);
});

test("aplicacao bem-sucedida registra UMA linha de trilha", async () => {
  seedExtracao("Clube Persistido do Banco");
  await applyDestinationSuggestion(DONO, PROC, SUGESTAO_NOME_LOCAL, true);

  assert.equal(db.processStatusEvent.rows.length, 1, "trilha append-only: um evento por aplicacao");
});

test("a trilha NAO carrega os campos extraidos", async () => {
  seedExtracao("Clube Persistido do Banco");
  await applyDestinationSuggestion(DONO, PROC, SUGESTAO_NOME_LOCAL, true);

  const evento = JSON.stringify(db.processStatusEvent.rows[0]);
  assert.doesNotMatch(evento, /confidence|"fields"/, "nada de PII estruturada na trilha");
});

/* --------------------------------------- fake: relacoes NAO sao inventadas --- */

/**
 * O fake RESOLVE relacoes, nunca as fabrica.
 *
 * Devolver um `processType` fixo faria um teste de outro tipo de processo passar
 * afirmando algo que nunca rodou — e tipo de processo governa preco e requisitos.
 * Estes testes travam o fake no comportamento honesto: quem semeia, recebe; quem
 * nao semeia, recebe `null`.
 */
const INCLUDE_RELACOES = { destination: true, firearm: true, processType: true };

test("include.processType devolve o que foi SEMEADO", async () => {
  db.process.rows[0].processType = { code: "CONCESSAO_CR", name: "Concessão de CR" };

  const row = await db.process.findFirst({ where: { id: PROC }, include: INCLUDE_RELACOES });

  assert.deepEqual(row?.processType, { code: "CONCESSAO_CR", name: "Concessão de CR" });
});

test("include.processType NAO inventa GUIA_TRAFEGO quando nada foi semeado", async () => {
  const row = await db.process.findFirst({ where: { id: PROC }, include: INCLUDE_RELACOES });

  assert.equal(row?.processType, null, "sem seed => null, nunca um tipo plausivel");
});

test("include.firearm devolve o que foi SEMEADO", async () => {
  db.process.rows[0].firearm = { id: "firearm-1" };

  const row = await db.process.findFirst({ where: { id: PROC }, include: INCLUDE_RELACOES });

  assert.deepEqual(row?.firearm, { id: "firearm-1" });
});

test("include.firearm NAO inventa dado quando nada foi semeado", async () => {
  const row = await db.process.findFirst({ where: { id: PROC }, include: INCLUDE_RELACOES });

  assert.equal(row?.firearm, null);
});

test("include.destination resolve da tabela semeada, e null quando nao ha", async () => {
  const comDestino = await db.process.findFirst({
    where: { id: PROC },
    include: INCLUDE_RELACOES,
  });
  assert.equal((comDestino?.destination as { eventName: string })?.eventName, "Clube Atual (exemplo)");

  db.process.seed({ id: "proc-sem-destino", userId: DONO.id });
  const semDestino = await db.process.findFirst({
    where: { id: "proc-sem-destino" },
    include: INCLUDE_RELACOES,
  });
  assert.equal(semDestino?.destination, null, "processo sem destino nao herda o do vizinho");
});
