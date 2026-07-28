/**
 * uploadProcessDocument — testes COMPORTAMENTAIS (sem Postgres).
 *
 * Banco: fake via `globalThis.prisma` (ver `testPrisma.ts`).
 * Storage: o `FileSystemStorage` REAL grava em `storage-local/` (git-ignored).
 * Nao foi mockado de proposito — assim o teste exercita a resolucao de chave e
 * a protecao contra path traversal de verdade. Os arquivos criados sao apagados
 * no final.
 *
 * LIMITE HONESTO: prova a logica do service, nao constraints do Postgres.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "./testPrisma";
import {
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  uploadProcessDocument,
} from "../../../src/server/services/uploadProcessDocument";

// `getPrisma()` resolve `globalThis.prisma` em tempo de CHAMADA, nao de import:
// basta o fake estar instalado antes de exercitar o service. Importar nao abre
// conexao — por isso o import estatico e seguro aqui.
let db: FakePrisma = installFakePrisma();

const DONO = { id: "user-dono", name: "Dona", email: "dona@example.com", role: "USER" } as const;
const OUTRO = { id: "user-outro", name: "Outro", email: "o@example.com", role: "USER" } as const;

/** Prefixo proprio deste teste, para a limpeza nao tocar em nada mais. */
const PROCESS_ID = "test-upload-process";
const STORAGE_DIR = path.resolve(process.cwd(), "storage-local", "processes", PROCESS_ID);

function arquivo(
  bytes: Uint8Array<ArrayBuffer> | string,
  name = "identificacao.pdf",
  type = "application/pdf",
): File {
  return new File([bytes], name, { type });
}

function semearProcesso(overrides: Record<string, unknown> = {}) {
  return db.process.seed({ id: PROCESS_ID, userId: DONO.id, ...overrides });
}

beforeEach(() => {
  db = installFakePrisma();
});

after(async () => {
  // Remove tudo o que este arquivo gravou no storage local.
  await rm(STORAGE_DIR, { recursive: true, force: true });
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ------------------------------------------------------------- propriedade --- */

test("usuario so envia documento em processo proprio", async () => {
  semearProcesso();
  const result = await uploadProcessDocument(OUTRO, PROCESS_ID, arquivo("conteudo"));
  assert.deepEqual(result, { ok: false, error: "Processo nao encontrado." });
  assert.equal(db.processDocument.rows.length, 0, "nada pode ser gravado");
});

test("processo inexistente e recusado", async () => {
  const result = await uploadProcessDocument(DONO, "nao-existe", arquivo("conteudo"));
  assert.equal(result.ok, false);
  assert.equal(db.processDocument.rows.length, 0);
});

/* --------------------------------------------------------------- validacao --- */

test("rejeita MIME fora da allowlist", async () => {
  semearProcesso();
  for (const perigoso of ["text/html", "image/svg+xml", "application/x-msdownload"]) {
    const result = await uploadProcessDocument(
      DONO,
      PROCESS_ID,
      arquivo("x", "malicioso.html", perigoso),
    );
    assert.equal(result.ok, false, `${perigoso} deveria ser recusado`);
  }
  assert.equal(db.processDocument.rows.length, 0);
});

test("aceita exatamente os tipos da allowlist", async () => {
  semearProcesso();
  for (const permitido of ALLOWED_MIME_TYPES) {
    const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo("ok", "a.bin", permitido));
    assert.equal(result.ok, true, `${permitido} deveria ser aceito`);
  }
});

test("rejeita arquivo acima do limite", async () => {
  semearProcesso();
  const grande = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo(grande));
  assert.equal(result.ok, false);
  assert.equal(db.processDocument.rows.length, 0);
});

test("aceita arquivo exatamente no limite", async () => {
  semearProcesso();
  const noLimite = new Uint8Array(MAX_DOCUMENT_BYTES);
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo(noLimite));
  assert.equal(result.ok, true, "o limite e inclusivo");
});

test("rejeita arquivo vazio", async () => {
  semearProcesso();
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo(""));
  assert.equal(result.ok, false);
  assert.equal(db.processDocument.rows.length, 0);
});

/* ------------------------------------------------------------- persistencia --- */

test("grava o documento com status ENVIADO e o autor do envio", async () => {
  semearProcesso();
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("conteudo"));

  const [doc] = db.processDocument.rows;
  assert.equal(doc.status, "ENVIADO", "a conferencia continua humana");
  assert.equal(doc.uploadedByMockUserId, DONO.id);
  assert.equal(doc.processId, PROCESS_ID);
  assert.equal(doc.reviewedAt, null);
  assert.equal(doc.rejectionReason, null);
});

test("calcula o sha256 do conteudo enviado", async () => {
  semearProcesso();
  const conteudo = "conteudo ficticio para hash";
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo(conteudo));

  const esperado = createHash("sha256").update(Buffer.from(conteudo)).digest("hex");
  assert.equal(db.processDocument.rows[0].sha256, esperado);
});

test("grava tamanho e mime observados, nao os declarados a esmo", async () => {
  semearProcesso();
  const conteudo = "12345";
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo(conteudo, "a.pdf", "application/pdf"));

  const [doc] = db.processDocument.rows;
  assert.equal(doc.sizeBytes, Buffer.from(conteudo).byteLength);
  assert.equal(doc.mimeType, "application/pdf");
});

/* -------------------------------------------------------------- storageKey --- */

test("a storageKey nao usa o nome original como caminho", async () => {
  semearProcesso();
  const hostil = "../../etc/passwd";
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x", hostil));

  const key = db.processDocument.rows[0].storageKey as string;
  // A propriedade que importa e nao haver SEGMENTO de caminho `..` — o nome
  // sanitizado pode ate conter pontos (".._.._etc_passwd"), o que e inofensivo
  // porque `/` virou `_` e nada sobe de diretorio.
  const segmentos = key.split("/");
  assert.ok(!segmentos.includes(".."), `segmento de traversal na chave: ${key}`);
  assert.ok(key.startsWith(`processes/${PROCESS_ID}/documents/`), `chave inesperada: ${key}`);
  assert.ok(!segmentos.slice(3).join("/").includes("/"), "o nome nao pode criar subpasta");
  // O nome original e preservado no banco, mas so como metadado.
  assert.equal(db.processDocument.rows[0].originalFileName, hostil);
});

test("a storageKey e unica por envio, mesmo com nome repetido", async () => {
  semearProcesso();
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("a", "igual.pdf"));
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("b", "igual.pdf"));

  const [k1, k2] = db.processDocument.rows.map((row) => row.storageKey);
  assert.notEqual(k1, k2, "dois envios nao podem colidir no storage");
});

test("a storageKey sanitiza caracteres fora de [A-Za-z0-9._-]", async () => {
  semearProcesso();
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x", "no me;com|coisas.pdf"));

  const key = db.processDocument.rows[0].storageKey as string;
  const nomeNaChave = key.split("/").pop() ?? "";
  assert.ok(/^[A-Za-z0-9._-]+$/.test(nomeNaChave), `nome inseguro na chave: ${nomeNaChave}`);
});

/* ------------------------------------------------------ status do processo --- */

test("RASCUNHO avanca para DOCUMENTO_ENVIADO", async () => {
  const processo = semearProcesso({ operationalStatus: "RASCUNHO" });
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));
  assert.equal(processo.operationalStatus, "DOCUMENTO_ENVIADO");
});

test("status ja avancado NAO regride", async () => {
  for (const status of ["PAGO_EM_FILA", "DOCUMENTO_APROVADO", "EM_REVISAO_OPERACIONAL"]) {
    db = installFakePrisma();
    const processo = semearProcesso({ operationalStatus: status });
    await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));
    assert.equal(processo.operationalStatus, status, `${status} nao pode regredir`);
  }
});

/* ------------------------------------------------------------ escopo/limites --- */

test("o service nao devolve storageKey ao chamador", async () => {
  semearProcesso();
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));
  assert.deepEqual(result, { ok: true }, "o retorno nao pode carregar chave nem caminho");
});
