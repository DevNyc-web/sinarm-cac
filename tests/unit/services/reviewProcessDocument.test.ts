/**
 * reviewProcessDocument — testes COMPORTAMENTAIS (sem Postgres).
 *
 * Banco: fake via `globalThis.prisma` (ver `testPrisma.ts`).
 *
 * PERMISSAO NAO E TESTADA AQUI, de proposito: o service NAO checa RBAC. Quem
 * exige `document.review` e a server action (`reviewDocumentAction` chama
 * `requirePermission`). Testar permissao neste nivel daria falsa sensacao de
 * cobertura — a garantia real vive na action, e move-la para o service seria
 * mudanca de regra, fora do escopo deste PR.
 *
 * LIMITE HONESTO: prova a logica do service, nao constraints do Postgres.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import { reviewProcessDocument } from "../../../src/server/services/reviewProcessDocument";

let db: FakePrisma = installFakePrisma();

const REVISOR = {
  id: "mock-operador",
  name: "Operador",
  email: "op@example.com",
  role: "OPERADOR",
} as const;

const PROCESS_ID = "test-review-process";
const DOC_ID = "test-review-doc";

function semear(docOverrides: Record<string, unknown> = {}, processOverrides: Record<string, unknown> = {}) {
  const processo = db.process.seed({
    id: PROCESS_ID,
    operationalStatus: "DOCUMENTO_ENVIADO",
    ...processOverrides,
  });
  const doc = db.processDocument.seed({
    id: DOC_ID,
    processId: PROCESS_ID,
    status: "ENVIADO",
    ...docOverrides,
  });
  return { processo, doc };
}

beforeEach(() => {
  db = installFakePrisma();
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ---------------------------------------------------------------- aprovacao --- */

test("revisor aprova o documento", async () => {
  const { doc } = semear();
  const result = await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");

  assert.deepEqual(result, { ok: true });
  assert.equal(doc.status, "APROVADO");
});

test("aprovacao registra quem revisou, com qual perfil e quando", async () => {
  const { doc } = semear();
  const antes = Date.now();
  await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");

  assert.equal(doc.reviewedByMockUserId, REVISOR.id);
  assert.equal(doc.reviewedByRole, REVISOR.role);
  assert.ok(doc.reviewedAt instanceof Date, "reviewedAt deve ser gravado");
  assert.ok((doc.reviewedAt as Date).getTime() >= antes);
});

test("aprovacao move o processo de DOCUMENTO_ENVIADO para DOCUMENTO_APROVADO", async () => {
  const { processo } = semear();
  await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");
  assert.equal(processo.operationalStatus, "DOCUMENTO_APROVADO");
});

test("aprovacao NAO regride quem ja passou do pagamento", async () => {
  const { processo } = semear({}, { operationalStatus: "PAGO_EM_FILA" });
  await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");
  assert.equal(processo.operationalStatus, "PAGO_EM_FILA");
});

test("aprovacao nao deixa motivo de rejeicao pendurado", async () => {
  const { doc } = semear({ rejectionReason: "sobra de tentativa anterior" });
  await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");
  assert.equal(doc.rejectionReason, null, "aprovado nao pode manter motivo");
});

/* -------------------------------- internalStatus canonico, lado aprovacao (Fase 5f) --- */

test("aprovacao avanca internalStatus para DOCUMENTO_VALIDADO", async () => {
  // Fase 5f, lado aprovacao (docs/47 §6.2): via transitionInternalStatus, nao
  // mais so operationalStatus direto.
  const { processo } = semear({}, { internalStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE" });
  await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");
  assert.equal(processo.internalStatus, "DOCUMENTO_VALIDADO");
});

test("internalStatus e operationalStatus avancam JUNTOS na mesma aprovacao", async () => {
  const { processo } = semear({}, { internalStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE" });
  const result = await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");
  assert.equal(result.ok, true);
  assert.equal(processo.internalStatus, "DOCUMENTO_VALIDADO");
  assert.equal(processo.operationalStatus, "DOCUMENTO_APROVADO");
});

test("aprovacao que NAO regride (guarda) tambem nao toca internalStatus", async () => {
  // Mesma guarda de sempre (operationalStatus === DOCUMENTO_ENVIADO): se a
  // fila ja passou do pagamento, nem operationalStatus nem internalStatus se
  // movem — nao deveria ter chamado transitionInternalStatus.
  const { processo } = semear(
    {},
    { operationalStatus: "PAGO_EM_FILA", internalStatus: "PAGO_EM_FILA" },
  );
  await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");
  assert.equal(processo.internalStatus, "PAGO_EM_FILA");
});

test("aprovacao registra evento tipado com fromStatus/toStatus e o ator da revisao", async () => {
  semear({}, { internalStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE" });
  await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");

  assert.equal(db.processStatusEvent.rows.length, 1);
  const [evento] = db.processStatusEvent.rows;
  assert.equal(evento.processId, PROCESS_ID);
  assert.equal(evento.fromStatus, "DOCUMENTO_RECEBIDO_PARA_ANALISE");
  assert.equal(evento.toStatus, "DOCUMENTO_VALIDADO");
  assert.equal(evento.actorMockUserId, REVISOR.id);
  assert.equal(evento.actorRole, REVISOR.role);
});

test("aprovacao bloqueada pela guarda NAO gera evento", async () => {
  semear({}, { operationalStatus: "PAGO_EM_FILA", internalStatus: "PAGO_EM_FILA" });
  await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

/* ---------------------------------------------------------------- rejeicao --- */

test("revisor rejeita com motivo", async () => {
  const { doc } = semear();
  const result = await reviewProcessDocument(REVISOR, DOC_ID, "REJEITADO", "ilegivel");

  assert.deepEqual(result, { ok: true });
  assert.equal(doc.status, "REJEITADO");
  assert.equal(doc.rejectionReason, "ilegivel");
});

test("rejeicao SEM motivo e barrada antes de tocar o banco", async () => {
  const { doc } = semear();
  const result = await reviewProcessDocument(REVISOR, DOC_ID, "REJEITADO");

  assert.equal(result.ok, false);
  assert.equal(doc.status, "ENVIADO", "o documento nao pode mudar");
});

test("motivo so com espacos conta como ausente", async () => {
  semear();
  const result = await reviewProcessDocument(REVISOR, DOC_ID, "REJEITADO", "    ");
  assert.equal(result.ok, false);
});

test("o motivo e gravado sem espacos nas pontas", async () => {
  const { doc } = semear();
  await reviewProcessDocument(REVISOR, DOC_ID, "REJEITADO", "  documento cortado  ");
  assert.equal(doc.rejectionReason, "documento cortado");
});

test("rejeicao bloqueia o processo e pede ajuste ao cliente", async () => {
  const { processo } = semear();
  await reviewProcessDocument(REVISOR, DOC_ID, "REJEITADO", "ilegivel");

  assert.equal(processo.operationalStatus, "BLOQUEADO");
  assert.equal(processo.userFacingStatus, "PRECISAMOS_DE_UM_AJUSTE");
});

test("rejeicao NAO mexe em processo cancelado", async () => {
  const { processo } = semear({}, { operationalStatus: "CANCELADO_DEV" });
  await reviewProcessDocument(REVISOR, DOC_ID, "REJEITADO", "ilegivel");
  assert.equal(processo.operationalStatus, "CANCELADO_DEV");
});

test("rejeicao continua LEGADA: nao toca internalStatus nem gera evento tipado", async () => {
  // Fase 5f migra so o lado APROVACAO (docs/47 §9). BLOQUEADO exige decisao
  // propria antes de ganhar porta canonica (docs/47 §6.5) — mapear para
  // BLOQUEADO_INSTABILIDADE/EXCECAO_* sem essa decisao e PROIBIDO (docs/46
  // §3.4). Este teste trava que o lado rejeicao NAO foi tocado.
  const { processo } = semear({}, { internalStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE" });
  await reviewProcessDocument(REVISOR, DOC_ID, "REJEITADO", "ilegivel");
  assert.equal(
    processo.internalStatus,
    "DOCUMENTO_RECEBIDO_PARA_ANALISE",
    "rejeicao nao deveria mexer em internalStatus",
  );
  assert.equal(db.processStatusEvent.rows.length, 0, "rejeicao nao usa a porta canonica");
});

test("rejeicao nao referencia transitionInternalStatus no codigo-fonte", () => {
  // Estrutural: garante que o caminho REJEITADO nao foi tocado por engano —
  // so o bloco de codigo do lado APROVACAO deveria mencionar a porta canonica.
  const code = readFileSync("src/server/services/reviewProcessDocument.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  // Ancora especifica do bloco de rejeicao (nao a guarda inicial de motivo,
  // que tambem contem 'decision === "REJEITADO"").
  const ancora = 'document.process.operationalStatus !== "CANCELADO_DEV"';
  assert.ok(code.includes(ancora), "bloco de rejeicao nao encontrado — ancora do teste ficou desatualizada");
  const ladoRejeicao = code.slice(code.indexOf(ancora));
  assert.doesNotMatch(
    ladoRejeicao,
    /transitionInternalStatus/,
    "o bloco de rejeicao nao deveria chamar a porta canonica",
  );
  assert.doesNotMatch(
    ladoRejeicao,
    /BLOQUEADO_INSTABILIDADE|EXCECAO_DOC_INVALIDO|EXCECAO_ARMA_DIVERGENTE|EXCECAO_DESTINO_INCOMPLETO|BLOQUEADO_OPERACIONAL/,
    "rejeicao nao pode mapear BLOQUEADO para excecao automatica nem criar categoria nova",
  );
});

/* ------------------------------------------------------------------ guardas --- */

test("documento inexistente falha sem quebrar", async () => {
  semear();
  const result = await reviewProcessDocument(REVISOR, "nao-existe", "APROVADO");
  assert.deepEqual(result, { ok: false, error: "Documento nao encontrado." });
});

test("documento ja revisado nao pode ser revisado de novo", async () => {
  for (const status of ["APROVADO", "REJEITADO"]) {
    db = installFakePrisma();
    const { doc } = semear({ status });
    const result = await reviewProcessDocument(REVISOR, DOC_ID, "APROVADO");

    assert.equal(result.ok, false, `${status} deveria barrar nova revisao`);
    assert.equal(doc.status, status, "o status original permanece");
  }
});

/* ------------------------------------------------------------------- escopo --- */

test("o service de revisao nao acessa storage nem rede", () => {
  const code = readFileSync("src/server/services/reviewProcessDocument.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.doesNotMatch(code, /getStorageAdapter|storage-local/, "revisao nao le o arquivo");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
  assert.doesNotMatch(code, /gov\.?br|sinarm/i, "sem Gov.br/SINARM");
});
