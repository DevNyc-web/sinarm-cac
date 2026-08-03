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
import { readFileSync, readdirSync } from "node:fs";
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

/** Arquivos que este teste ja gravou no storage local (dir pode nem existir). */
function arquivosNoStorage(): string[] {
  try {
    return readdirSync(STORAGE_DIR, { recursive: true }).map(String).sort();
  } catch {
    return [];
  }
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

/* ------------------------------------- internalStatus canonico (Fase 5e) --- */

test("RASCUNHO avanca internalStatus para DOCUMENTO_RECEBIDO_PARA_ANALISE", async () => {
  // Fase 5e (docs/47 §6.1): via transitionInternalStatus, nao mais so
  // operationalStatus direto.
  const processo = semearProcesso({ operationalStatus: "RASCUNHO", internalStatus: "RASCUNHO" });
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));
  assert.equal(processo.internalStatus, "DOCUMENTO_RECEBIDO_PARA_ANALISE");
});

test("operationalStatus final continua DOCUMENTO_ENVIADO — mesmo efeito da fila/admin", async () => {
  // A porta mudou (transitionInternalStatus + alsoSet), mas o resultado em
  // operationalStatus tem que ser IDENTICO ao comportamento anterior: mesma
  // fila, mesmo badge, mesmo <select> no admin.
  const processo = semearProcesso({ operationalStatus: "RASCUNHO" });
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));
  assert.equal(processo.operationalStatus, "DOCUMENTO_ENVIADO");
});

test("internalStatus e operationalStatus avancam JUNTOS na mesma chamada", async () => {
  const processo = semearProcesso({ operationalStatus: "RASCUNHO", internalStatus: "RASCUNHO" });
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));
  assert.equal(result.ok, true);
  assert.equal(processo.internalStatus, "DOCUMENTO_RECEBIDO_PARA_ANALISE");
  assert.equal(processo.operationalStatus, "DOCUMENTO_ENVIADO");
});

test("status ja avancado tambem NAO regride internalStatus", async () => {
  // Mesma guarda de sempre (operationalStatus === RASCUNHO): se a fila ja
  // passou do inicio, nem operationalStatus nem internalStatus se movem.
  const processo = semearProcesso({
    operationalStatus: "DOCUMENTO_APROVADO",
    internalStatus: "RASCUNHO",
  });
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));
  assert.equal(processo.internalStatus, "RASCUNHO", "nao deveria ter chamado transitionInternalStatus");
});

test("registra evento tipado com fromStatus/toStatus e o ator do upload", async () => {
  semearProcesso({ operationalStatus: "RASCUNHO", internalStatus: "RASCUNHO" });
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));

  assert.equal(db.processStatusEvent.rows.length, 1);
  const [evento] = db.processStatusEvent.rows;
  assert.equal(evento.processId, PROCESS_ID);
  assert.equal(evento.fromStatus, "RASCUNHO");
  assert.equal(evento.toStatus, "DOCUMENTO_RECEBIDO_PARA_ANALISE");
  assert.equal(evento.actorMockUserId, DONO.id);
  assert.equal(evento.actorRole, DONO.role);
});

test("status ja avancado NAO gera evento (guarda bloqueia antes da porta canonica)", async () => {
  semearProcesso({ operationalStatus: "PAGO_EM_FILA", internalStatus: "PAGO_EM_FILA" });
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));
  assert.equal(db.processStatusEvent.rows.length, 0);
});

/* ---------------------------------------- guarda de processo fechado (docs/57) --- */

test("bloqueia upload quando internalStatus = CANCELADO_OPERACIONAL (cancelamento real)", async () => {
  const processo = semearProcesso({
    operationalStatus: "RASCUNHO",
    internalStatus: "CANCELADO_OPERACIONAL",
  });
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));

  assert.deepEqual(result, {
    ok: false,
    error: "Nao e possivel enviar documento para um processo encerrado.",
  });
  assert.equal(db.processDocument.rows.length, 0, "nenhum documento e gravado");
  assert.equal(db.processStatusEvent.rows.length, 0, "nenhum evento e criado");
  assert.equal(processo.internalStatus, "CANCELADO_OPERACIONAL", "processo nao reativa");
  assert.equal(processo.operationalStatus, "RASCUNHO", "a fila nao avanca");
});

test("bloqueia upload quando operationalStatus = CANCELADO_DEV (fechamento tecnico), mesma guarda isClosed", async () => {
  const processo = semearProcesso({
    operationalStatus: "CANCELADO_DEV",
    internalStatus: "RASCUNHO",
  });
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));

  assert.equal(result.ok, false);
  assert.equal(db.processDocument.rows.length, 0);
  assert.equal(processo.operationalStatus, "CANCELADO_DEV", "operationalStatus nao muda");
  assert.equal(processo.internalStatus, "RASCUNHO", "internalStatus nao muda");
});

test("reenvio/substituicao em processo cancelado tambem e bloqueado (docs/57 §3.3/§3.4)", async () => {
  // Mesma porta: reenviar documento rejeitado passa por este service. Um envio
  // valido antes do cancelamento nao abre excecao para o seguinte.
  const processo = semearProcesso({ operationalStatus: "RASCUNHO", internalStatus: "RASCUNHO" });
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("primeiro"));
  assert.equal(db.processDocument.rows.length, 1);

  processo.internalStatus = "CANCELADO_OPERACIONAL";
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo("segundo"));

  assert.equal(result.ok, false);
  assert.equal(db.processDocument.rows.length, 1, "o segundo envio nao entra");
});

test("a guarda roda ANTES do storage: nenhum byte novo e gravado no disco", async () => {
  // Se a guarda descesse para depois do `put`, sobraria arquivo orfao em
  // `storage-local/` sem registro nenhum no banco.
  semearProcesso({ internalStatus: "CANCELADO_OPERACIONAL" });
  const antes = arquivosNoStorage();
  await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));

  assert.equal(db.processDocument.rows.length, 0);
  assert.deepEqual(arquivosNoStorage(), antes, "nada novo foi escrito em storage-local/");
});

test("processo ABERTO continua aceitando upload (nao-regressao da guarda nova)", async () => {
  const processo = semearProcesso({ operationalStatus: "RASCUNHO", internalStatus: "RASCUNHO" });
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));

  assert.equal(result.ok, true);
  assert.equal(db.processDocument.rows.length, 1);
  assert.equal(processo.operationalStatus, "DOCUMENTO_ENVIADO");
});

test("reusa isClosed de operationalSignals.ts — nao reescreve a checagem de estado fechado", () => {
  const code = readFileSync("src/server/services/uploadProcessDocument.ts", "utf8");
  assert.match(code, /import \{ isClosed \} from "@\/server\/processes\/operationalSignals"/);
  assert.match(code, /isClosed\(process\.operationalStatus, process\.internalStatus\)/);
});

/* ------------------------------------------------------------ escopo/limites --- */

test("o service nao devolve storageKey ao chamador", async () => {
  semearProcesso();
  const result = await uploadProcessDocument(DONO, PROCESS_ID, arquivo("x"));
  assert.deepEqual(result, { ok: true }, "o retorno nao pode carregar chave nem caminho");
});
