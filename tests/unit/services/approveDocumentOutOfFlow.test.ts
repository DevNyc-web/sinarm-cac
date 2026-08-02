/**
 * approveDocumentOutOfFlow — testes COMPORTAMENTAIS (sem Postgres).
 *
 * A acao explicita do docs/50 §6: REGISTRA uma revisao feita fora do
 * formulario normal, movendo o DOCUMENTO e o PROCESSO juntos. E o caminho
 * correto para o que o dropdown manual fazia sem revisor (docs/50 §3, ultimo
 * paragrafo).
 *
 * PERMISSAO NAO E TESTADA AQUI, de proposito — mesmo criterio de
 * `reopenDocumentReview.test.ts`: o service NAO checa RBAC, quem exige
 * `document.review.approveOutOfFlow` e a server action. A cobertura da
 * permissao e estrutural, no fim deste arquivo.
 *
 * Banco: fake via `globalThis.prisma` (ver `testPrisma.ts`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import { approveDocumentOutOfFlow } from "../../../src/server/services/approveDocumentOutOfFlow";
import { ROLE_PERMISSIONS } from "../../../src/server/auth/permissions";

let db: FakePrisma = installFakePrisma();

const ADMIN = { id: "mock-admin", name: "Admin", email: "admin@example.com", role: "ADMIN" } as const;

const PROCESS_ID = "test-approve-oof-process";
const DOC_ID = "test-approve-oof-doc";

/** Documento AINDA NAO revisado, processo no estado que o upload deixou. */
function semear(docOverrides: Record<string, unknown> = {}, processOverrides: Record<string, unknown> = {}) {
  const processo = db.process.seed({
    id: PROCESS_ID,
    operationalStatus: "DOCUMENTO_ENVIADO",
    internalStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE",
    ...processOverrides,
  });
  const doc = db.processDocument.seed({
    id: DOC_ID,
    processId: PROCESS_ID,
    status: "ENVIADO",
    reviewedByMockUserId: null,
    reviewedByRole: null,
    reviewedAt: null,
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

/* ---------------------------------------------------------------- guardas --- */

test("motivo vazio e recusado antes de tocar o banco", async () => {
  const { doc, processo } = semear();
  const result = await approveDocumentOutOfFlow(ADMIN, DOC_ID);

  assert.equal(result.ok, false);
  assert.equal(doc.status, "ENVIADO", "documento nao pode mudar");
  assert.equal(processo.internalStatus, "DOCUMENTO_RECEBIDO_PARA_ANALISE");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

test("motivo so com espacos conta como ausente", async () => {
  semear();
  const result = await approveDocumentOutOfFlow(ADMIN, DOC_ID, "    ");
  assert.equal(result.ok, false);
});

test("documento inexistente e recusado", async () => {
  const result = await approveDocumentOutOfFlow(ADMIN, "nao-existe", "conferido por telefone");
  assert.equal(result.ok, false);
});

test("documento ja APROVADO e recusado", async () => {
  const { doc } = semear({
    status: "APROVADO",
    reviewedByMockUserId: "mock-operador",
    reviewedByRole: "OPERADOR",
    reviewedAt: new Date("2026-07-01T10:00:00Z"),
  });
  const result = await approveDocumentOutOfFlow(ADMIN, DOC_ID, "conferido por telefone");

  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /ja revisado/i);
  assert.equal(doc.reviewedByMockUserId, "mock-operador", "revisor original nao pode ser sobrescrito");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

test("documento ja REJEITADO e recusado", async () => {
  const { doc } = semear({ status: "REJEITADO", rejectionReason: "ilegivel" });
  const result = await approveDocumentOutOfFlow(ADMIN, DOC_ID, "conferido por telefone");

  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /ja revisado/i);
  assert.equal(doc.status, "REJEITADO");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

test("processo CANCELADO_DEV e recusado", async () => {
  const { doc, processo } = semear({}, { operationalStatus: "CANCELADO_DEV" });
  const result = await approveDocumentOutOfFlow(ADMIN, DOC_ID, "conferido por telefone");

  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /cancelado/i);
  assert.equal(doc.status, "ENVIADO", "documento nao pode mudar");
  assert.equal(processo.operationalStatus, "CANCELADO_DEV");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

/* ---------------------------------------------------------- status aceitos --- */

test("documento ENVIADO pode ser aprovado fora do fluxo", async () => {
  const { doc } = semear({ status: "ENVIADO" });
  const result = await approveDocumentOutOfFlow(ADMIN, DOC_ID, "conferido por telefone com o cliente");

  assert.deepEqual(result, { ok: true });
  assert.equal(doc.status, "APROVADO");
});

test("documento EM_ANALISE pode ser aprovado fora do fluxo", async () => {
  const { doc } = semear({ status: "EM_ANALISE" });
  const result = await approveDocumentOutOfFlow(ADMIN, DOC_ID, "conferido presencialmente");

  assert.deepEqual(result, { ok: true });
  assert.equal(doc.status, "APROVADO");
});

/* ---------------------------------------------------------- lado do DOCUMENTO */

test("document.status vira APROVADO e os campos do revisor sao preenchidos", async () => {
  const { doc } = semear();
  await approveDocumentOutOfFlow(ADMIN, DOC_ID, "conferido por telefone");

  assert.equal(doc.status, "APROVADO");
  assert.equal(doc.reviewedByMockUserId, ADMIN.id);
  assert.equal(doc.reviewedByRole, ADMIN.role);
  assert.ok(doc.reviewedAt instanceof Date);
});

test("rejectionReason vira null", async () => {
  const { doc } = semear({ rejectionReason: null });
  await approveDocumentOutOfFlow(ADMIN, DOC_ID, "conferido por telefone");
  assert.equal(doc.rejectionReason, null);
});

/* ----------------------------------------------------------- lado do PROCESSO */

test("internalStatus vira DOCUMENTO_VALIDADO pela porta canonica", async () => {
  const { processo } = semear();
  await approveDocumentOutOfFlow(ADMIN, DOC_ID, "conferido por telefone");
  assert.equal(processo.internalStatus, "DOCUMENTO_VALIDADO");
});

test("operationalStatus vira DOCUMENTO_APROVADO via alsoSet", async () => {
  const { processo } = semear();
  await approveDocumentOutOfFlow(ADMIN, DOC_ID, "conferido por telefone");
  assert.equal(processo.operationalStatus, "DOCUMENTO_APROVADO");
});

test("registra EXATAMENTE um evento TIPADO com fromStatus/toStatus e o motivo", async () => {
  semear();
  await approveDocumentOutOfFlow(ADMIN, DOC_ID, "  conferido por telefone com o cliente  ");

  assert.equal(db.processStatusEvent.rows.length, 1, "so um evento por aprovacao fora do fluxo");
  const [evento] = db.processStatusEvent.rows;
  assert.equal(evento.processId, PROCESS_ID);
  assert.equal(evento.fromStatus, "DOCUMENTO_RECEBIDO_PARA_ANALISE", "lido do banco, nao suposto");
  assert.equal(evento.toStatus, "DOCUMENTO_VALIDADO");
  assert.equal(evento.actorMockUserId, ADMIN.id);
  assert.equal(evento.actorRole, ADMIN.role);
  assert.match(String(evento.note), /conferido por telefone com o cliente/);
  assert.doesNotMatch(String(evento.note), /\s{2,}/, "motivo entra aparado");
});

/* --------------------------------------------------------- estrutura/RBAC --- */

test("a server action exige a permissao PROPRIA, nao document.review", () => {
  const source = readFileSync("src/app/(admin)/admin/processos/[id]/actions.ts", "utf8");
  const inicio = source.indexOf("export async function approveDocumentOutOfFlowAction");
  assert.ok(inicio > 0, "action nao encontrada — nome mudou?");
  const corpo = source.slice(inicio, inicio + 600);
  assert.match(corpo, /requirePermission\("document\.review\.approveOutOfFlow"\)/);
  assert.doesNotMatch(corpo, /requirePermission\("document\.review"\)/);
});

test("document.review.approveOutOfFlow NAO e concedida a OPERADOR", () => {
  // Se OPERADOR tivesse as duas, a permissao propria teria o mesmo alcance de
  // `document.review` e a matriz voltaria a nao distinguir conferir de assinar
  // aprovacao feita fora do formulario.
  assert.ok(ROLE_PERMISSIONS.OPERADOR.includes("document.review"));
  assert.ok(!ROLE_PERMISSIONS.OPERADOR.includes("document.review.approveOutOfFlow"));
  assert.ok(ROLE_PERMISSIONS.ADMIN.includes("document.review.approveOutOfFlow"));
  for (const role of ["FINANCEIRO", "SUPORTE", "USER"] as const) {
    assert.ok(!ROLE_PERMISSIONS[role].includes("document.review.approveOutOfFlow"), role);
  }
});

test("o service usa a porta canonica e nao escreve operationalStatus solto", () => {
  const source = readFileSync("src/server/services/approveDocumentOutOfFlow.ts", "utf8");
  assert.match(source, /transitionInternalStatus\s*\(/);
  assert.match(source, /toStatus:\s*"DOCUMENTO_VALIDADO"/);
  assert.match(source, /alsoSet:\s*\{\s*operationalStatus:\s*"DOCUMENTO_APROVADO"\s*\}/);
  assert.doesNotMatch(source, /updateProcessOperations\s*\(/);
});
