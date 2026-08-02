/**
 * reopenDocumentReview — testes COMPORTAMENTAIS (sem Postgres).
 *
 * A acao explicita do docs/50 §5: DESFAZ uma revisao ja feita, movendo o
 * DOCUMENTO e o PROCESSO juntos. E a saida do beco sem saida que o dropdown
 * produzia (docs/50 §3) e que o PR #86 passou a impedir.
 *
 * PERMISSAO NAO E TESTADA AQUI, de proposito — mesmo criterio de
 * `reviewProcessDocument.test.ts`: o service NAO checa RBAC, quem exige
 * `document.review.reopen` e a server action. A cobertura da permissao e
 * estrutural, no fim deste arquivo.
 *
 * Banco: fake via `globalThis.prisma` (ver `testPrisma.ts`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import { reopenDocumentReview } from "../../../src/server/services/reopenDocumentReview";
import { ROLE_PERMISSIONS } from "../../../src/server/auth/permissions";

let db: FakePrisma = installFakePrisma();

const ADMIN = { id: "mock-admin", name: "Admin", email: "admin@example.com", role: "ADMIN" } as const;

const PROCESS_ID = "test-reopen-process";
const DOC_ID = "test-reopen-doc";

/** Documento JA revisado, processo no estado que a revisao deixou. */
function semear(docOverrides: Record<string, unknown> = {}, processOverrides: Record<string, unknown> = {}) {
  const processo = db.process.seed({
    id: PROCESS_ID,
    operationalStatus: "DOCUMENTO_APROVADO",
    internalStatus: "DOCUMENTO_VALIDADO",
    ...processOverrides,
  });
  const doc = db.processDocument.seed({
    id: DOC_ID,
    processId: PROCESS_ID,
    status: "APROVADO",
    reviewedByMockUserId: "mock-operador",
    reviewedByRole: "OPERADOR",
    reviewedAt: new Date("2026-07-01T10:00:00Z"),
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
  const result = await reopenDocumentReview(ADMIN, DOC_ID);

  assert.equal(result.ok, false);
  assert.equal(doc.status, "APROVADO", "documento nao pode mudar");
  assert.equal(processo.internalStatus, "DOCUMENTO_VALIDADO");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

test("motivo so com espacos conta como ausente", async () => {
  semear();
  const result = await reopenDocumentReview(ADMIN, DOC_ID, "    ");
  assert.equal(result.ok, false);
});

test("documento inexistente e recusado", async () => {
  const result = await reopenDocumentReview(ADMIN, "nao-existe", "motivo valido");
  assert.equal(result.ok, false);
});

test("documento AINDA NAO revisado e recusado — nao ha conferencia a reabrir", async () => {
  const { doc } = semear({ status: "ENVIADO", reviewedAt: null });
  const result = await reopenDocumentReview(ADMIN, DOC_ID, "engano");

  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /nao foi revisado/i);
  assert.equal(doc.status, "ENVIADO");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

test("processo CANCELADO_DEV e recusado", async () => {
  const { doc, processo } = semear({}, { operationalStatus: "CANCELADO_DEV" });
  const result = await reopenDocumentReview(ADMIN, DOC_ID, "motivo valido");

  assert.equal(result.ok, false);
  assert.match(String(result.ok === false && result.error), /cancelado/i);
  assert.equal(doc.status, "APROVADO", "documento nao pode voltar");
  assert.equal(processo.operationalStatus, "CANCELADO_DEV");
  assert.equal(db.processStatusEvent.rows.length, 0);
});

/* ------------------------------------------------------- lado do DOCUMENTO --- */

test("documento APROVADO volta para ENVIADO e fica revisavel de novo", async () => {
  const { doc } = semear();
  const result = await reopenDocumentReview(ADMIN, DOC_ID, "conferencia errada");

  assert.deepEqual(result, { ok: true });
  assert.equal(doc.status, "ENVIADO", "e isto que devolve o documento para a fila de revisao");
});

test("documento REJEITADO tambem pode ser reaberto", async () => {
  // docs/50 §5 fala em desfazer "uma revisao ja feita" — rejeicao e revisao.
  const { doc } = semear({ status: "REJEITADO", rejectionReason: "ilegivel" });
  const result = await reopenDocumentReview(ADMIN, DOC_ID, "cliente reenviou por outro canal");

  assert.equal(result.ok, true);
  assert.equal(doc.status, "ENVIADO");
  assert.equal(doc.rejectionReason, null, "o motivo da rejeicao desfeita nao pode ficar pendurado");
});

test("os campos da revisao desfeita sao LIMPOS no documento", async () => {
  const { doc } = semear();
  await reopenDocumentReview(ADMIN, DOC_ID, "conferencia errada");

  assert.equal(doc.reviewedByMockUserId, null);
  assert.equal(doc.reviewedByRole, null);
  assert.equal(doc.reviewedAt, null);
});

/* -------------------------------------------------------- lado do PROCESSO --- */

test("internalStatus volta para DOCUMENTO_RECEBIDO_PARA_ANALISE pela porta canonica", async () => {
  const { processo } = semear();
  await reopenDocumentReview(ADMIN, DOC_ID, "conferencia errada");
  assert.equal(processo.internalStatus, "DOCUMENTO_RECEBIDO_PARA_ANALISE");
});

test("operationalStatus volta para DOCUMENTO_ENVIADO via alsoSet", async () => {
  const { processo } = semear();
  await reopenDocumentReview(ADMIN, DOC_ID, "conferencia errada");
  assert.equal(processo.operationalStatus, "DOCUMENTO_ENVIADO");
});

test("o par resultante e exatamente o que uploadProcessDocument produz", async () => {
  // Reaberto e recem-enviado ficam indistinguiveis — por isso o diagnostico
  // classifica o par como `none` (docs/47 §6.1) e o cliente nao ve nada novo.
  const { processo } = semear();
  await reopenDocumentReview(ADMIN, DOC_ID, "conferencia errada");
  assert.equal(processo.internalStatus, "DOCUMENTO_RECEBIDO_PARA_ANALISE");
  assert.equal(processo.operationalStatus, "DOCUMENTO_ENVIADO");
});

test("registra EXATAMENTE um evento TIPADO com fromStatus/toStatus e o motivo", async () => {
  semear();
  await reopenDocumentReview(ADMIN, DOC_ID, "  conferencia feita no documento errado  ");

  assert.equal(db.processStatusEvent.rows.length, 1, "so um evento por reabertura");
  const [evento] = db.processStatusEvent.rows;
  assert.equal(evento.processId, PROCESS_ID);
  assert.equal(evento.fromStatus, "DOCUMENTO_VALIDADO", "lido do banco, nao suposto");
  assert.equal(evento.toStatus, "DOCUMENTO_RECEBIDO_PARA_ANALISE");
  assert.equal(evento.actorMockUserId, ADMIN.id);
  assert.equal(evento.actorRole, ADMIN.role);
  assert.notEqual(evento.kind, "STATUS_OPERACIONAL", "evento tipado nao usa o kind legado");
  assert.match(String(evento.note), /conferencia feita no documento errado/);
  assert.doesNotMatch(String(evento.note), /\s{2,}/, "motivo entra aparado");
});

test("o historico de quem revisou sobrevive na trilha, nao nos campos do documento", async () => {
  // Limpar `reviewedBy*` nao apaga auditoria: o evento tipado registra quem
  // reabriu e de qual estado canonico saiu (docs/50 §5).
  const { doc } = semear();
  await reopenDocumentReview(ADMIN, DOC_ID, "conferencia errada");

  assert.equal(doc.reviewedByMockUserId, null, "campo do documento limpo");
  assert.equal(db.processStatusEvent.rows.length, 1, "mas a trilha ganhou registro");
  assert.equal(db.processStatusEvent.rows[0].fromStatus, "DOCUMENTO_VALIDADO");
});

/* --------------------------------------------------------- estrutura/RBAC --- */

test("a server action exige a permissao PROPRIA, nao document.review", () => {
  const source = readFileSync("src/app/(admin)/admin/processos/[id]/actions.ts", "utf8");
  const inicio = source.indexOf("export async function reopenDocumentReviewAction");
  assert.ok(inicio > 0, "action nao encontrada — nome mudou?");
  const corpo = source.slice(inicio, inicio + 600);
  assert.match(corpo, /requirePermission\("document\.review\.reopen"\)/);
  assert.doesNotMatch(corpo, /requirePermission\("document\.review"\)/);
});

test("document.review.reopen NAO e concedida a OPERADOR", () => {
  // Se OPERADOR tivesse as duas, a permissao propria teria o mesmo alcance de
  // `document.review` e a matriz voltaria a nao distinguir conferir de desfazer.
  assert.ok(ROLE_PERMISSIONS.OPERADOR.includes("document.review"));
  assert.ok(!ROLE_PERMISSIONS.OPERADOR.includes("document.review.reopen"));
  assert.ok(ROLE_PERMISSIONS.ADMIN.includes("document.review.reopen"));
  for (const role of ["FINANCEIRO", "SUPORTE", "USER"] as const) {
    assert.ok(!ROLE_PERMISSIONS[role].includes("document.review.reopen"), role);
  }
});

test("o service usa a porta canonica e nao escreve operationalStatus solto", () => {
  const source = readFileSync("src/server/services/reopenDocumentReview.ts", "utf8");
  assert.match(source, /transitionInternalStatus\s*\(/);
  assert.match(source, /toStatus:\s*"DOCUMENTO_RECEBIDO_PARA_ANALISE"/);
  assert.match(source, /alsoSet:\s*\{\s*operationalStatus:\s*"DOCUMENTO_ENVIADO"\s*\}/);
  assert.doesNotMatch(source, /updateProcessOperations\s*\(/);
});
