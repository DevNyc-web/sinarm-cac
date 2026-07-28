/**
 * Engine de extracao + services de tentativa (PR #47B) — testes COMPORTAMENTAIS.
 *
 * Banco: fake via `globalThis.prisma` (ver `tests/unit/services/testPrisma.ts`).
 * Sem Postgres, sem OCR, sem worker, sem rede.
 *
 * O TESTE MAIS IMPORTANTE deste arquivo e o de espelhamento: a engine mock tem
 * de devolver exatamente o que `mockFieldsFor()` devolve. E isso que permitira
 * ao PR #47C trocar a fonte (mock em memoria -> linha persistida) sem alterar o
 * que a UI mostra, o que o motor de decisao conclui e o que
 * `applyDestinationSuggestion` grava no processo.
 *
 * LIMITE HONESTO: prova a logica dos services, nao constraints do Postgres.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "../services/testPrisma";
import { aggregateConfidence } from "../../../src/server/extraction/adapter";
import {
  MOCK_ENGINE_NAME,
  MOCK_ENGINE_VERSION,
  mockExtractionEngine,
} from "../../../src/server/extraction/mockEngine";
import { getExtractionEngine } from "../../../src/server/extraction/getExtractionEngine";
import {
  ACTIVE_EXTRACTION_STATES,
  TERMINAL_EXTRACTION_STATES,
  requestDocumentExtraction,
} from "../../../src/server/services/requestDocumentExtraction";
import { runDocumentExtraction } from "../../../src/server/services/runDocumentExtraction";
import { mockFieldsFor } from "../../../src/server/documents/documentExtractionMock";
import { DOCUMENT_KINDS } from "../../../src/server/documents/documentTypes";
import { EXTRACTION_FAILURE_REASONS } from "../../../src/server/documents/documentExtractionTypes";

let db: FakePrisma = installFakePrisma();

const DOC_ID = "doc-extracao";

function semearDocumento(type = "IDENTIFICACAO_PESSOAL") {
  return db.processDocument.seed({
    id: DOC_ID,
    processId: "proc-1",
    type,
    mimeType: "application/pdf",
  });
}

beforeEach(() => {
  db = installFakePrisma();
  semearDocumento();
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ------------------------------------------------------------ engine mock --- */

test("a engine mock ESPELHA mockFieldsFor campo a campo", async () => {
  // Trava do PR #47C: se este teste quebrar, trocar a fonte muda comportamento.
  for (const kind of DOCUMENT_KINDS) {
    const result = await mockExtractionEngine.extract({
      documentId: DOC_ID,
      kind,
      mimeType: "application/pdf",
    });
    assert.ok(result.ok, `${kind} deveria extrair`);
    assert.deepEqual(
      result.fields,
      mockFieldsFor(kind).map((f) => ({
        key: f.key,
        label: f.label,
        value: f.value,
        confidence: f.confidence,
      })),
      `campos divergem para ${kind}`,
    );
  }
});

test("a engine mock e deterministica", async () => {
  const input = { documentId: DOC_ID, kind: "IDENTIFICACAO_PESSOAL", mimeType: "application/pdf" } as const;
  const a = await mockExtractionEngine.extract(input);
  const b = await mockExtractionEngine.extract(input);
  assert.deepEqual(a, b);
});

test("a engine mock IGNORA bytes — nao ha caminho para vazar conteudo", async () => {
  const base = { documentId: DOC_ID, kind: "IDENTIFICACAO_PESSOAL", mimeType: "application/pdf" } as const;
  const sem = await mockExtractionEngine.extract(base);
  const com = await mockExtractionEngine.extract({
    ...base,
    bytes: Buffer.from("conteudo secreto que nao pode influenciar nada"),
  });
  assert.deepEqual(sem, com, "os bytes nao podem alterar a saida");
});

test("a engine mock declara nome e versao fixos", () => {
  assert.equal(mockExtractionEngine.name, MOCK_ENGINE_NAME);
  assert.equal(mockExtractionEngine.version, MOCK_ENGINE_VERSION);
  assert.match(MOCK_ENGINE_VERSION, /mock/i, "a versao deve denunciar que nao houve leitura");
});

test("getExtractionEngine devolve a mock por padrao", () => {
  assert.equal(getExtractionEngine(), mockExtractionEngine);
});

/* ------------------------------------------------- confianca agregada --- */

test("a confianca agregada e a do PIOR campo", () => {
  const f = (confidence: "ALTA" | "MEDIA" | "BAIXA") => ({
    key: "k",
    label: "l",
    value: "v",
    confidence,
  });
  assert.equal(aggregateConfidence([f("ALTA"), f("ALTA")]), "ALTA");
  assert.equal(aggregateConfidence([f("ALTA"), f("MEDIA")]), "MEDIA");
  assert.equal(aggregateConfidence([f("ALTA"), f("BAIXA"), f("MEDIA")]), "BAIXA");
  assert.equal(aggregateConfidence([]), "BAIXA", "nada lido nao e evidencia de qualidade");
});

/* --------------------------------------------------------- idempotencia --- */

test("request cria uma tentativa PENDENTE", async () => {
  const result = await requestDocumentExtraction(DOC_ID);
  assert.ok(result.ok);
  assert.equal(result.reused, false);
  assert.equal(result.extraction.state, "PENDENTE");
  assert.equal(result.extraction.engine, MOCK_ENGINE_NAME);
  assert.equal(result.extraction.engineVersion, MOCK_ENGINE_VERSION);
  assert.equal(db.documentExtraction.rows.length, 1);
});

test("request REUSA tentativa viva em vez de duplicar", async () => {
  for (const estado of ACTIVE_EXTRACTION_STATES) {
    db = installFakePrisma();
    semearDocumento();
    const primeira = await requestDocumentExtraction(DOC_ID);
    assert.ok(primeira.ok);
    db.documentExtraction.rows[0].state = estado;

    const segunda = await requestDocumentExtraction(DOC_ID);
    assert.ok(segunda.ok);
    assert.equal(segunda.reused, true, `${estado} deveria ser reusado`);
    assert.equal(segunda.extraction.id, primeira.extraction.id);
    assert.equal(db.documentExtraction.rows.length, 1, `${estado} nao pode duplicar`);
  }
});

test("request cria NOVA tentativa apos qualquer estado terminal", async () => {
  for (const estado of TERMINAL_EXTRACTION_STATES) {
    db = installFakePrisma();
    semearDocumento();
    const primeira = await requestDocumentExtraction(DOC_ID);
    assert.ok(primeira.ok);
    db.documentExtraction.rows[0].state = estado;
    db.documentExtraction.rows[0].createdAt = new Date(Date.now() - 60_000);

    const segunda = await requestDocumentExtraction(DOC_ID);
    assert.ok(segunda.ok);
    assert.equal(segunda.reused, false, `${estado} deveria permitir reprocessar`);
    assert.notEqual(segunda.extraction.id, primeira.extraction.id);
    assert.equal(db.documentExtraction.rows.length, 2, `${estado}: historico preservado`);
  }
});

test("os dois conjuntos de estado cobrem o enum inteiro, sem sobreposicao", () => {
  const todos = [...ACTIVE_EXTRACTION_STATES, ...TERMINAL_EXTRACTION_STATES];
  assert.equal(new Set(todos).size, todos.length, "nenhum estado em dois grupos");
  assert.equal(todos.length, 6, "todo estado precisa de classificacao");
});

test("documento inexistente nao abre extracao", async () => {
  const result = await requestDocumentExtraction("nao-existe");
  assert.equal(result.ok, false);
  assert.equal(db.documentExtraction.rows.length, 0);
});

test("request NAO devolve PII", async () => {
  const result = await requestDocumentExtraction(DOC_ID);
  assert.ok(result.ok);
  assert.ok(!("fields" in result.extraction));
});

/* -------------------------------------------------------------- execucao --- */

test("run marca PROCESSANDO antes de chamar a engine", async () => {
  await requestDocumentExtraction(DOC_ID);
  const vistos: string[] = [];
  const original = mockExtractionEngine.extract.bind(mockExtractionEngine);
  // Espia o estado NO MOMENTO da chamada da engine.
  (mockExtractionEngine as { extract: typeof original }).extract = async (input) => {
    vistos.push(String(db.documentExtraction.rows[0].state));
    return original(input);
  };
  try {
    await runDocumentExtraction(DOC_ID);
  } finally {
    (mockExtractionEngine as { extract: typeof original }).extract = original;
  }
  assert.deepEqual(vistos, ["PROCESSANDO"], "a engine roda com a linha ja em PROCESSANDO");
});

test("run grava EXTRAIDA com fields, confidence, engine e extractedAt", async () => {
  await requestDocumentExtraction(DOC_ID);
  const result = await runDocumentExtraction(DOC_ID);

  assert.ok(result.ok);
  assert.equal(result.extraction.state, "EXTRAIDA");
  assert.equal(result.extraction.engine, MOCK_ENGINE_NAME);
  assert.equal(result.extraction.engineVersion, MOCK_ENGINE_VERSION);
  assert.ok(result.extraction.extractedAt instanceof Date);

  const linha = db.documentExtraction.rows[0];
  assert.deepEqual(linha.fields, mockFieldsFor("IDENTIFICACAO_PESSOAL").map((f) => ({ ...f })));
  assert.equal(linha.confidence, "BAIXA", "pior campo da identificacao e BAIXA");
});

test("run NAO devolve PII", async () => {
  await requestDocumentExtraction(DOC_ID);
  const result = await runDocumentExtraction(DOC_ID);
  assert.ok(result.ok);
  assert.ok(!("fields" in result.extraction), "quem executa nao recebe PII de volta");
});

test("falha da engine grava FALHOU com codigo fechado", async () => {
  await requestDocumentExtraction(DOC_ID);
  const original = mockExtractionEngine.extract.bind(mockExtractionEngine);
  (mockExtractionEngine as { extract: typeof original }).extract = async () => ({
    ok: false as const,
    failureReason: "ARQUIVO_ILEGIVEL" as const,
  });
  try {
    const result = await runDocumentExtraction(DOC_ID);
    assert.ok(result.ok);
    assert.equal(result.extraction.state, "FALHOU");
    assert.equal(result.extraction.failureReason, "ARQUIVO_ILEGIVEL");
    assert.ok(
      (EXTRACTION_FAILURE_REASONS as readonly string[]).includes(
        String(result.extraction.failureReason),
      ),
      "o motivo tem de ser um codigo do conjunto fechado",
    );
  } finally {
    (mockExtractionEngine as { extract: typeof original }).extract = original;
  }
});

test("run recusa tentativa que nao esta PENDENTE", async () => {
  await requestDocumentExtraction(DOC_ID);
  await runDocumentExtraction(DOC_ID);
  const segunda = await runDocumentExtraction(DOC_ID);
  assert.equal(segunda.ok, false, "EXTRAIDA nao pode ser reexecutada sem novo request");
});

test("run sem tentativa aberta falha de forma segura", async () => {
  const result = await runDocumentExtraction(DOC_ID);
  assert.equal(result.ok, false);
});

/* --------------------------------------------- consumidores nao trocados --- */

const CONSUMIDORES = [
  "src/server/documents/documentExtractionReview.ts",
  "src/server/automation/automationReadinessInput.ts",
  "src/server/services/applyDestinationSuggestion.ts",
];

test("nenhum consumidor de buildExtractionReview passou a usar a engine", () => {
  // O #47B nao pode trocar fonte: isso e o #47C, e tem de ser atomico.
  for (const arquivo of CONSUMIDORES) {
    const source = readFileSync(arquivo, "utf8");
    assert.ok(
      !source.includes("getExtractionEngine") && !source.includes("documentExtractionRepository"),
      `${arquivo} nao pode ler a nova fonte neste PR`,
    );
  }
});

test("buildExtractionReview continua derivando do mock", () => {
  const source = readFileSync("src/server/documents/documentExtractionReview.ts", "utf8");
  assert.match(source, /mockFieldsFor/, "a fonte continua sendo a funcao pura");
});

/* ------------------------------------------------ nunca no caminho de render --- */

function arquivosDe(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return arquivosDe(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

test("nenhum arquivo de src/app ou src/components importa a engine ou o runner", () => {
  const proibidos = [...arquivosDe("src/app"), ...arquivosDe("src/components")].filter((file) => {
    const code = readFileSync(file, "utf8");
    return /getExtractionEngine|runDocumentExtraction|mockExtractionEngine/.test(code);
  });
  assert.deepEqual(proibidos, [], `extracao nao pode entrar no render: ${proibidos.join(", ")}`);
});

/* ------------------------------------------------------------------ escopo --- */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("a camada de extracao nao faz rede, OCR real, nuvem, Gov.br/SINARM nem Fase 9", () => {
  for (const arquivo of [
    "src/server/extraction/adapter.ts",
    "src/server/extraction/mockEngine.ts",
    "src/server/extraction/getExtractionEngine.ts",
    "src/server/services/requestDocumentExtraction.ts",
    "src/server/services/runDocumentExtraction.ts",
  ]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, `${arquivo}: sem rede`);
    // Limites de palavra: sem eles, "textract" casaria dentro de
    // "documen(tExtract)ionStatus" — nome do proprio modulo de dominio.
    // Limite INICIAL de palavra basta e e o que se quer: sem ele, "textract"
    // casaria dentro de "documen(tExtract)ionStatus" — o proprio modulo de
    // dominio. Com ele, `TextractClient` e `tesseract.js` continuam pegos.
    assert.doesNotMatch(
      code,
      /\b(tesseract|openai|anthropic|textract|rekognition)/i,
      `${arquivo}: sem OCR/IA`,
    );
    assert.doesNotMatch(code, /gov\.?br|sinarm/i, `${arquivo}: sem Gov.br/SINARM`);
    assert.doesNotMatch(code, /phase9|PHASE9/i, `${arquivo}: sem Fase 9`);
    assert.doesNotMatch(code, /storageKey|getStorageAdapter/, `${arquivo}: sem storage`);
  }
});

test("a fabrica nao introduz variavel de ambiente nesta fase", () => {
  const code = codeOnly(readFileSync("src/server/extraction/getExtractionEngine.ts", "utf8"));
  assert.doesNotMatch(code, /getEnv|process\.env/, "so ha uma engine — env viria sem ganho");
});
