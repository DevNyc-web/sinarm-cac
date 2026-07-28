/**
 * Persistencia da extracao documental (PR #47A) — testes COMPORTAMENTAIS.
 *
 * Banco: fake via `globalThis.prisma` (ver `tests/unit/services/testPrisma.ts`).
 * Nao ha Postgres, OCR, worker nem rede aqui.
 *
 * O GATE DE PII e o ponto central: `fields` guarda o que foi lido do documento do
 * cliente e NAO pode sair no select base. O fake honra `select`, entao estes
 * testes provam a projecao de verdade — se ele devolvesse a linha inteira, o
 * teste passaria em falso.
 *
 * LIMITE HONESTO: prova a politica do repositorio, nao constraints do Postgres.
 * FK, cascade e o tipo JSONB continuam sem cobertura em CI, que roda sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import {
  installFakePrisma,
  prismaIsFake,
  type FakePrisma,
} from "../services/testPrisma";
import {
  createPendingExtractionForDocument,
  findLatestExtractionForDocument,
  findLatestExtractionWithFieldsForDocument,
  listExtractionsForDocument,
  updateExtractionState,
} from "../../../src/server/repositories/documentExtractionRepository";
import {
  EXTRACTION_FAILURE_REASONS,
  EXTRACTION_STATES,
  EXTRACTION_STATE_LABELS,
  NO_EXTRACTION_STATE,
  emptyExtraction,
  extractionStateLabel,
  isExtractionFailureReason,
} from "../../../src/server/documents/documentExtractionTypes";

let db: FakePrisma = installFakePrisma();

const DOC_ID = "doc-teste";
const OUTRO_DOC = "doc-outro";
const ENGINE = { engine: "mock", engineVersion: "0.0.0" };

/** Campos extraidos ficticios — formato do que o motor gravara no futuro. */
const FIELDS_FICTICIOS = {
  nome: { value: "MARIA DE EXEMPLO (fictício)", confidence: "ALTA" },
  cpf: { value: "000.000.000-00 (exemplo)", confidence: "BAIXA" },
};

beforeEach(() => {
  db = installFakePrisma();
  db.processDocument.seed({ id: DOC_ID, processId: "proc-1" });
  db.processDocument.seed({ id: OUTRO_DOC, processId: "proc-1" });
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ------------------------------------------------------------------ criacao --- */

test("cria tentativa PENDENTE para o documento", async () => {
  const row = await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });

  assert.equal(row.documentId, DOC_ID);
  assert.equal(row.state, "PENDENTE", "estado default do schema");
  assert.equal(row.engine, "mock");
  assert.equal(row.engineVersion, "0.0.0");
});

test("a tentativa nasce vazia — sem OCR nesta fase", async () => {
  await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  const [linha] = db.documentExtraction.rows;

  assert.equal(linha.fields, null, "nenhum campo extraido nasce preenchido");
  assert.equal(linha.confidence, null);
  assert.equal(linha.extractedAt, null);
  assert.equal(linha.failureReason, null);
});

test("a tentativa fica ligada ao documento informado", async () => {
  await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  await createPendingExtractionForDocument({ documentId: OUTRO_DOC, ...ENGINE });

  const doDoc = await listExtractionsForDocument(DOC_ID);
  assert.equal(doDoc.length, 1);
  assert.equal(doDoc[0].documentId, DOC_ID);
});

/* --------------------------------------------------------------- 1:N / latest --- */

test("o mesmo documento aceita varias tentativas (1:N)", async () => {
  await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });

  assert.equal((await listExtractionsForDocument(DOC_ID)).length, 3);
});

test("reprocessar PRESERVA a tentativa anterior", async () => {
  const primeira = await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  await updateExtractionState(primeira.id, {
    state: "FALHOU",
    failureReason: "ARQUIVO_ILEGIVEL",
  });
  await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });

  const historico = await listExtractionsForDocument(DOC_ID);
  assert.equal(historico.length, 2, "a falha anterior continua no historico");
  assert.ok(
    historico.some((linha) => linha.state === "FALHOU"),
    "a evidencia da tentativa que falhou nao pode ser apagada",
  );
});

test("findLatest devolve a tentativa MAIS RECENTE", async () => {
  const antiga = await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  // O fake ordena por createdAt: garantir instantes distintos.
  db.documentExtraction.rows[0].createdAt = new Date(Date.now() - 60_000);
  const nova = await createPendingExtractionForDocument({
    documentId: DOC_ID,
    engine: "mock",
    engineVersion: "0.0.1",
  });

  const latest = await findLatestExtractionForDocument(DOC_ID);
  assert.equal(latest?.id, nova.id);
  assert.notEqual(latest?.id, antiga.id);
  assert.equal(latest?.engineVersion, "0.0.1", "permite comparar motores");
});

test("documento sem tentativa devolve null (ausencia de linha, nao estado)", async () => {
  assert.equal(await findLatestExtractionForDocument(DOC_ID), null);
});

/* ------------------------------------------------------------- gate de PII --- */

test("o select BASE nao devolve os campos extraidos", async () => {
  const criada = await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  await updateExtractionState(criada.id, { state: "EXTRAIDA", fields: FIELDS_FICTICIOS });

  const base = await findLatestExtractionForDocument(DOC_ID);
  assert.ok(base, "a linha existe");
  assert.ok(!("fields" in base), "PII nao pode sair na leitura padrao");
});

test("a funcao explicitamente PII devolve os campos", async () => {
  const criada = await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  await updateExtractionState(criada.id, { state: "EXTRAIDA", fields: FIELDS_FICTICIOS });

  const full = await findLatestExtractionWithFieldsForDocument(DOC_ID);
  assert.ok(full && "fields" in full, "a leitura full precisa trazer os campos");
  assert.deepEqual(full.fields, FIELDS_FICTICIOS, "roundtrip do JSON");
});

test("o historico tambem nao vaza PII", async () => {
  const criada = await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  await updateExtractionState(criada.id, { state: "EXTRAIDA", fields: FIELDS_FICTICIOS });

  for (const linha of await listExtractionsForDocument(DOC_ID)) {
    assert.ok(!("fields" in linha), "listagem e leitura de fila, nao de conteudo");
  }
});

test("update devolve a linha SEM PII", async () => {
  const criada = await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  const atualizada = await updateExtractionState(criada.id, {
    state: "EXTRAIDA",
    fields: FIELDS_FICTICIOS,
  });
  assert.ok(!("fields" in atualizada), "quem grava nao precisa receber PII de volta");
});

/* ---------------------------------------------------------------- transicao --- */

test("updateExtractionState move o estado e grava os carimbos", async () => {
  const criada = await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  const quando = new Date();

  const atualizada = await updateExtractionState(criada.id, {
    state: "EXTRAIDA",
    confidence: "BAIXA",
    extractedAt: quando,
  });

  assert.equal(atualizada.state, "EXTRAIDA");
  assert.equal(atualizada.confidence, "BAIXA", "agregado do pior campo preservado");
  assert.deepEqual(atualizada.extractedAt, quando);
});

test("a revisao de excecao grava quem revisou e quando", async () => {
  const criada = await createPendingExtractionForDocument({ documentId: DOC_ID, ...ENGINE });
  const quando = new Date();

  const atualizada = await updateExtractionState(criada.id, {
    state: "CONFIRMADA",
    reviewedBy: "mock-operador",
    reviewedByRole: "OPERADOR",
    reviewedAt: quando,
  });

  assert.equal(atualizada.reviewedBy, "mock-operador");
  assert.equal(atualizada.reviewedByRole, "OPERADOR");
  assert.deepEqual(atualizada.reviewedAt, quando);
});

test("tentativa inexistente falha em vez de virar no-op silencioso", async () => {
  await assert.rejects(() => updateExtractionState("nao-existe", { state: "FALHOU" }));
});

/* ------------------------------------------------------------------ estados --- */

test("os estados persistidos sao exatamente os 6 aprovados", () => {
  assert.deepEqual(
    [...EXTRACTION_STATES],
    ["PENDENTE", "PROCESSANDO", "EXTRAIDA", "PRECISA_REVISAO", "CONFIRMADA", "FALHOU"],
  );
});

test("PARIDADE: dominio e enum Prisma declaram os mesmos estados", () => {
  // Mesmo criterio de `Role` x `roles.ts`: o banco recusar estado invalido so
  // vale se os dois lados nao divergirem.
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const bloco = schema.slice(schema.indexOf("enum ExtractionState"));
  const corpo = bloco.slice(bloco.indexOf("{") + 1, bloco.indexOf("}"));
  const noPrisma = corpo
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => /^[A-Z_]+$/.test(linha));

  assert.deepEqual(noPrisma.sort(), [...EXTRACTION_STATES].sort());
});

test("todo estado persistido tem rotulo", () => {
  for (const state of EXTRACTION_STATES) {
    assert.equal(typeof EXTRACTION_STATE_LABELS[state], "string");
  }
});

test("NAO_INICIADA e marcador de DOMINIO, nao estado persistido", () => {
  // Com a tabela, "sem tentativa" e a AUSENCIA de linha — nao um estado gravado.
  assert.ok(!(EXTRACTION_STATES as readonly string[]).includes(NO_EXTRACTION_STATE));
  assert.equal(emptyExtraction().status, NO_EXTRACTION_STATE);
  assert.equal(extractionStateLabel(NO_EXTRACTION_STATE), "Não iniciada");
  assert.equal(extractionStateLabel("PROCESSANDO"), "Processando");
});

/* --------------------------------------------------------- failureReason --- */

test("os motivos de falha sao codigos curtos e fechados", () => {
  for (const reason of EXTRACTION_FAILURE_REASONS) {
    assert.ok(/^[A-Z_]{3,30}$/.test(reason), `codigo fora do padrao: ${reason}`);
    assert.ok(isExtractionFailureReason(reason));
  }
  assert.ok(!isExtractionFailureReason("texto bruto do OCR com dados do cliente"));
});

/* ------------------------------------------------------ escopo e seguranca --- */

const REPO = "src/server/repositories/documentExtractionRepository.ts";
const SCHEMA = "prisma/schema.prisma";
const MIGRATION = "prisma/migrations/20260728000000_add_document_extraction/migration.sql";

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Remove comentarios do Prisma/SQL — a busca e por COLUNA, nao por prosa. */
function withoutComments(source: string): string {
  return source
    .split("\n")
    .filter((linha) => !/^\s*(\/\/|--)/.test(linha))
    .join("\n");
}

const CREDENCIAL = /password|senha|token|cookie|otp|secret|credential/i;

test("a tabela NAO tem coluna de senha, token, cookie ou OTP", () => {
  const schema = readFileSync(SCHEMA, "utf8");
  const inicio = schema.indexOf("model DocumentExtraction");
  const bloco = schema.slice(inicio, schema.indexOf("}", schema.indexOf("@@map", inicio)));
  assert.doesNotMatch(withoutComments(bloco), CREDENCIAL, "nenhuma coluna de credencial");

  const sql = readFileSync(MIGRATION, "utf8");
  const create = sql.slice(sql.indexOf("CREATE TABLE"), sql.indexOf("CONSTRAINT"));
  assert.doesNotMatch(withoutComments(create), CREDENCIAL, "nenhuma coluna de credencial no SQL");
});

test("o repositorio nao conhece storageKey nem caminho local", () => {
  const code = codeOnly(readFileSync(REPO, "utf8"));
  assert.doesNotMatch(code, /storageKey|storage_key|storage-local|getStorageAdapter/);
});

test("o repositorio nao faz OCR, rede, worker nem toca Gov.br/SINARM/Fase 9", () => {
  const code = codeOnly(readFileSync(REPO, "utf8"));
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
  assert.doesNotMatch(code, /ocr|tesseract|openai|anthropic/i, "sem OCR/IA");
  assert.doesNotMatch(code, /worker|setInterval|cron/i, "sem worker");
  assert.doesNotMatch(code, /gov\.?br|sinarm/i, "sem Gov.br/SINARM");
  assert.doesNotMatch(code, /phase9|PHASE9/i, "sem Fase 9");
});

test("a migration e ADITIVA — nao altera tabela existente", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  assert.match(sql, /CREATE TYPE "extraction_state"/);
  assert.match(sql, /CREATE TABLE "document_extractions"/);
  assert.match(sql, /ON DELETE CASCADE/, "extracao sem documento nao faz sentido");
  assert.match(sql, /"document_extractions_document_id_created_at_idx"/, "indice composto");
  assert.doesNotMatch(sql, /ALTER TABLE "process_documents"/, "nao mexe na tabela de documentos");
  assert.doesNotMatch(sql, /DROP /i, "nada e removido");
});
