/**
 * Leitura da extracao persistida (PR #47C-0) e TROCA DE FONTE (PR #47C).
 *
 * O #47C-0 criou a leitura em lote, o guard do JSON e o loader do dono. O #47C
 * trocou os quatro consumidores para receberem os campos INJETADOS, com o mock
 * como fallback quando nao ha extracao confiavel.
 *
 * A prova central da troca esta em "NEUTRALIDADE": mapa vazio produz exatamente
 * a mesma conferencia de antes, campo a campo. Como nada cria linha de extracao
 * em producao hoje, esse e o caminho real de todo documento — a troca e neutra
 * por construcao, e passa a valer sozinha quando o #47D comecar a gravar linhas.
 *
 * Banco: fake via `globalThis.prisma` (ver `tests/unit/services/testPrisma.ts`).
 * Sem Postgres, sem OCR, sem worker, sem rede.
 *
 * LIMITE HONESTO (mesmo do #47A): prova a politica do repositorio e do loader,
 * nao o comportamento do Postgres. O `in` real, o tipo JSONB e o indice
 * `[documentId, createdAt]` continuam sem cobertura em CI, que roda sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "../services/testPrisma";
import {
  createPendingExtractionForDocument,
  findLatestExtractionForDocument,
  findLatestExtractionsWithFieldsForDocuments,
  listExtractionsForDocument,
  updateExtractionState,
} from "../../../src/server/repositories/documentExtractionRepository";
import {
  USABLE_EXTRACTION_STATES,
  isUsableExtractionState,
  parseExtractionFields,
  usableExtractionFields,
} from "../../../src/server/documents/documentExtractionFields";
import { loadOwnerExtractionFields } from "../../../src/server/services/loadOwnerExtractionFields";
import { EXTRACTION_STATES } from "../../../src/server/documents/documentExtractionTypes";
import { CONFIDENCE_LEVELS } from "../../../src/server/documents/documentExtractionStatus";
import {
  NO_EXTRACTION_FIELDS,
  buildExtractionReview,
  type ReviewDocument,
} from "../../../src/server/documents/documentExtractionReview";
import { mockFieldsFor } from "../../../src/server/documents/documentExtractionMock";
import { DOCUMENT_KINDS, type DocumentKind } from "../../../src/server/documents/documentTypes";
import { mockExtractionEngine } from "../../../src/server/extraction/mockEngine";

let db: FakePrisma = installFakePrisma();

const DOC_A = "doc-a";
const DOC_B = "doc-b";
const DOC_C = "doc-c";
const ENGINE = { engine: "mock", engineVersion: "0.1.0-mock" };

/** Campos no formato que a engine mock grava — array de objetos. */
const CAMPOS_VALIDOS = [
  { key: "nome", label: "Nome", value: "MARIA DE EXEMPLO (fictício)", confidence: "ALTA" },
  { key: "cpf", label: "CPF", value: "000.000.000-00 (exemplo)", confidence: "BAIXA" },
];

/** Semeia uma tentativa ja resolvida, sem passar pelo runner. */
function seedExtraction(documentId: string, over: Record<string, unknown> = {}) {
  return db.documentExtraction.seed({
    documentId,
    state: "EXTRAIDA",
    fields: CAMPOS_VALIDOS,
    confidence: "BAIXA",
    extractedAt: new Date(),
    createdAt: new Date(),
    ...ENGINE,
    ...over,
  });
}

beforeEach(() => {
  db = installFakePrisma();
  for (const id of [DOC_A, DOC_B, DOC_C]) {
    db.processDocument.seed({ id, processId: "proc-1" });
  }
});

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ------------------------------------------------------ leitura em lote --- */

test("UMA query cobre N documentos", async () => {
  seedExtraction(DOC_A);
  seedExtraction(DOC_B);
  seedExtraction(DOC_C);

  const original = db.documentExtraction.findMany.bind(db.documentExtraction);
  let chamadas = 0;
  (db.documentExtraction as { findMany: typeof original }).findMany = async (args) => {
    chamadas += 1;
    return original(args);
  };

  try {
    const mapa = await loadOwnerExtractionFields([{ id: DOC_A }, { id: DOC_B }, { id: DOC_C }]);
    assert.equal(mapa.size, 3, "os tres documentos entraram no mapa");
  } finally {
    (db.documentExtraction as { findMany: typeof original }).findMany = original;
  }

  assert.equal(chamadas, 1, "N+1 aqui percorreria a fila inteira do admin");
});

test("lista vazia nao vai ao banco", async () => {
  const original = db.documentExtraction.findMany.bind(db.documentExtraction);
  let chamadas = 0;
  (db.documentExtraction as { findMany: typeof original }).findMany = async (args) => {
    chamadas += 1;
    return original(args);
  };

  try {
    const mapa = await loadOwnerExtractionFields([]);
    assert.equal(mapa.size, 0);
  } finally {
    (db.documentExtraction as { findMany: typeof original }).findMany = original;
  }

  assert.equal(chamadas, 0, "`in: []` seria uma ida inutil ao Postgres");
});

test("devolve a tentativa MAIS RECENTE por documento", async () => {
  const antiga = new Date("2026-01-01T10:00:00Z");
  const nova = new Date("2026-06-01T10:00:00Z");

  seedExtraction(DOC_A, {
    createdAt: antiga,
    fields: [{ key: "nome", label: "Nome", value: "TENTATIVA ANTIGA", confidence: "ALTA" }],
  });
  seedExtraction(DOC_A, {
    createdAt: nova,
    fields: [{ key: "nome", label: "Nome", value: "TENTATIVA NOVA", confidence: "ALTA" }],
  });

  const rows = await findLatestExtractionsWithFieldsForDocuments([DOC_A]);
  assert.equal(rows.length, 1, "uma linha por documento, nao o historico inteiro");

  const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);
  assert.equal(mapa.get(DOC_A)?.[0].value, "TENTATIVA NOVA", "reprocessamento vence o historico");
});

test("cada documento recebe a propria extracao", async () => {
  seedExtraction(DOC_A, {
    fields: [{ key: "nome", label: "Nome", value: "DO DOCUMENTO A", confidence: "ALTA" }],
  });
  seedExtraction(DOC_B, {
    fields: [{ key: "nome", label: "Nome", value: "DO DOCUMENTO B", confidence: "ALTA" }],
  });

  const mapa = await loadOwnerExtractionFields([{ id: DOC_A }, { id: DOC_B }]);
  assert.equal(mapa.get(DOC_A)?.[0].value, "DO DOCUMENTO A");
  assert.equal(mapa.get(DOC_B)?.[0].value, "DO DOCUMENTO B");
});

test("documento sem tentativa nenhuma fica fora do mapa", async () => {
  seedExtraction(DOC_A);
  const mapa = await loadOwnerExtractionFields([{ id: DOC_A }, { id: DOC_B }]);

  assert.ok(mapa.has(DOC_A));
  assert.ok(!mapa.has(DOC_B), "ausencia significa: continue usando a fonte de hoje");
});

/* --------------------------------------------------------------- estados --- */

test("campos validos em estado utilizavel entram no mapa", async () => {
  seedExtraction(DOC_A);
  const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);

  assert.deepEqual(mapa.get(DOC_A), CAMPOS_VALIDOS);
});

test("os tres estados utilizaveis entregam campos", async () => {
  for (const state of USABLE_EXTRACTION_STATES) {
    db = installFakePrisma();
    db.processDocument.seed({ id: DOC_A, processId: "proc-1" });
    seedExtraction(DOC_A, { state });

    const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);
    assert.ok(mapa.has(DOC_A), `${state} deveria entregar campos`);
  }
});

test("PENDENTE, PROCESSANDO e FALHOU caem no fallback", async () => {
  for (const state of ["PENDENTE", "PROCESSANDO", "FALHOU"]) {
    db = installFakePrisma();
    db.processDocument.seed({ id: DOC_A, processId: "proc-1" });
    // Com `fields` preenchido de proposito: o estado sozinho tem de barrar,
    // mesmo que tenha sobrado conteudo de uma tentativa anterior.
    seedExtraction(DOC_A, { state });

    const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);
    assert.ok(!mapa.has(DOC_A), `${state} nao pode entregar campos`);
  }
});

test("todo estado do dominio e classificado — utilizavel ou nao", () => {
  for (const state of EXTRACTION_STATES) {
    assert.equal(
      typeof isUsableExtractionState(state),
      "boolean",
      `${state} precisa ter classificacao explicita`,
    );
  }
  assert.deepEqual(
    EXTRACTION_STATES.filter(isUsableExtractionState),
    [...USABLE_EXTRACTION_STATES],
  );
});

/* ----------------------------------------------------------- guard do JSON --- */

test("JSON invalido cai no fallback, sem lancar", async () => {
  const lixos: unknown[] = [
    null,
    undefined,
    "texto solto",
    42,
    true,
    {},
    { fields: CAMPOS_VALIDOS },
    [],
    [null],
    ["campo"],
    [[]],
  ];

  for (const lixo of lixos) {
    assert.equal(parseExtractionFields(lixo), null, `${JSON.stringify(lixo)} deveria ser recusado`);

    db = installFakePrisma();
    db.processDocument.seed({ id: DOC_A, processId: "proc-1" });
    seedExtraction(DOC_A, { fields: lixo });

    const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);
    assert.ok(!mapa.has(DOC_A), `${JSON.stringify(lixo)} nao pode entrar no mapa`);
  }
});

test("confidence fora de CONFIDENCE_LEVELS cai no fallback", async () => {
  for (const confidence of ["alta", "ALTISSIMA", "", 0.97, null, undefined]) {
    const campos = [{ key: "nome", label: "Nome", value: "X", confidence }];
    assert.equal(parseExtractionFields(campos), null, `confidence ${confidence} deveria ser recusada`);

    db = installFakePrisma();
    db.processDocument.seed({ id: DOC_A, processId: "proc-1" });
    seedExtraction(DOC_A, { fields: campos });

    const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);
    assert.ok(!mapa.has(DOC_A));
  }
});

test("todo nivel de confianca do dominio e aceito", () => {
  for (const confidence of CONFIDENCE_LEVELS) {
    const campos = [{ key: "nome", label: "Nome", value: "X", confidence }];
    assert.ok(parseExtractionFields(campos), `${confidence} e um nivel valido`);
  }
});

test("campo com chave faltando ou tipo errado cai no fallback", () => {
  const invalidos = [
    { label: "Nome", value: "X", confidence: "ALTA" },
    { key: "nome", value: "X", confidence: "ALTA" },
    { key: "nome", label: "Nome", confidence: "ALTA" },
    { key: "nome", label: "Nome", value: "X" },
    { key: "", label: "Nome", value: "X", confidence: "ALTA" },
    { key: "nome", label: "", value: "X", confidence: "ALTA" },
    { key: 1, label: "Nome", value: "X", confidence: "ALTA" },
    { key: "nome", label: "Nome", value: 1, confidence: "ALTA" },
  ];

  for (const campo of invalidos) {
    assert.equal(parseExtractionFields([campo]), null, `${JSON.stringify(campo)} deveria ser recusado`);
  }
});

test("TUDO OU NADA: um campo ruim descarta a lista inteira", () => {
  const lista = [...CAMPOS_VALIDOS, { key: "rg", label: "RG", value: "X", confidence: "MEDIA" }];
  assert.equal(parseExtractionFields(lista)?.length, 3, "controle: a lista boa passa");

  const comRuim = [...CAMPOS_VALIDOS, { key: "rg", label: "RG", value: "X", confidence: "TALVEZ" }];
  assert.equal(
    parseExtractionFields(comRuim),
    null,
    "aproveitar so os bons mostraria MENOS campos que hoje, em silencio",
  );
});

test("o guard COPIA os campos — chave estranha no JSON nao vaza", () => {
  const comExtras = [
    {
      key: "nome",
      label: "Nome",
      value: "MARIA DE EXEMPLO (fictício)",
      confidence: "ALTA",
      storageKey: "processos/proc-1/doc-a.pdf",
      rawOcrText: "texto bruto que nunca deveria existir",
    },
  ];

  const parsed = parseExtractionFields(comExtras);
  assert.ok(parsed);
  assert.deepEqual(Object.keys(parsed[0]).sort(), ["confidence", "key", "label", "value"]);
});

test("usableExtractionFields junta as duas travas", () => {
  assert.ok(usableExtractionFields("EXTRAIDA", CAMPOS_VALIDOS), "estado ok + json ok");
  assert.equal(usableExtractionFields("PENDENTE", CAMPOS_VALIDOS), null, "estado barra");
  assert.equal(usableExtractionFields("EXTRAIDA", "lixo"), null, "json barra");
});

/* ------------------------------------------------------------ PII / select --- */

test("`fields` NAO aparece nas funcoes de select base", async () => {
  seedExtraction(DOC_A);

  const criada = await createPendingExtractionForDocument({ documentId: DOC_B, ...ENGINE });
  const ultima = await findLatestExtractionForDocument(DOC_A);
  const historico = await listExtractionsForDocument(DOC_A);
  const atualizada = await updateExtractionState(criada.id, { state: "PROCESSANDO" });

  for (const [nome, row] of [
    ["createPendingExtractionForDocument", criada],
    ["findLatestExtractionForDocument", ultima],
    ["updateExtractionState", atualizada],
    ["listExtractionsForDocument", historico[0]],
  ] as const) {
    assert.ok(row, `${nome} devolveu linha`);
    assert.ok(!("fields" in row), `${nome} nao pode devolver PII`);
  }
});

test("so a funcao marcada como WithFields devolve PII", async () => {
  seedExtraction(DOC_A);
  const [row] = await findLatestExtractionsWithFieldsForDocuments([DOC_A]);

  assert.ok("fields" in row, "o nome da funcao anuncia que traz PII");
  assert.deepEqual(row.fields, CAMPOS_VALIDOS);
});

test("nem o repositorio nem o loader conhecem storage", () => {
  for (const arquivo of [
    "src/server/repositories/documentExtractionRepository.ts",
    "src/server/services/loadOwnerExtractionFields.ts",
    "src/server/documents/documentExtractionFields.ts",
  ]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    assert.doesNotMatch(code, /storageKey|getStorageAdapter/, `${arquivo}: sem storage`);
  }
});

test("o loader nao devolve nada alem dos campos do contrato", async () => {
  seedExtraction(DOC_A);
  const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);
  const campos = mapa.get(DOC_A);

  assert.ok(campos);
  for (const campo of campos) {
    assert.deepEqual(Object.keys(campo).sort(), ["confidence", "key", "label", "value"]);
  }
});

/* ------------------------------------------------------------ tolerancia --- */

test("banco fora do ar NAO derruba o loader", async () => {
  const original = db.documentExtraction.findMany.bind(db.documentExtraction);
  (db.documentExtraction as { findMany: typeof original }).findMany = async () => {
    throw new Error("conexao recusada");
  };

  try {
    const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);
    assert.equal(mapa.size, 0, "degrada para a fonte de hoje em vez de quebrar a pagina");
  } finally {
    (db.documentExtraction as { findMany: typeof original }).findMany = original;
  }
});

/* ------------------------------------------------------- fake: filtro `in` --- */

test("o fake filtra por `in` de verdade", async () => {
  seedExtraction(DOC_A);
  seedExtraction(DOC_B);
  seedExtraction(DOC_C);

  const rows = await findLatestExtractionsWithFieldsForDocuments([DOC_A, DOC_C]);
  assert.deepEqual(
    rows.map((row) => row.documentId).sort(),
    [DOC_A, DOC_C],
    "`in` nao pode devolver a tabela inteira",
  );
});

test("o fake LANCA em filtro desconhecido — nunca verde falso", async () => {
  seedExtraction(DOC_A);

  await assert.rejects(
    () =>
      db.documentExtraction.findMany({
        where: { documentId: { contains: "doc" } },
      }),
    /filtro nao suportado/,
    "um operador nao ensinado devolvendo vazio faria o teste mentir",
  );
});

test("o fake continua entendendo escalar, null, Date, gt e OR", async () => {
  const antes = new Date("2026-01-01T00:00:00Z");
  seedExtraction(DOC_A, { createdAt: new Date("2026-06-01T00:00:00Z"), failureReason: null });

  assert.equal((await db.documentExtraction.findMany({ where: { documentId: DOC_A } })).length, 1);
  assert.equal((await db.documentExtraction.findMany({ where: { failureReason: null } })).length, 1);
  assert.equal(
    (await db.documentExtraction.findMany({ where: { createdAt: { gt: antes } } })).length,
    1,
  );
  assert.equal(
    (await db.documentExtraction.findMany({ where: { OR: [{ documentId: DOC_A }] } })).length,
    1,
  );
});

/* ------------------------------------------- #47C: NEUTRALIDADE da troca --- */

/** Documento de conferencia, com o `id` que chaveia o mapa. */
function reviewDoc(over: Partial<ReviewDocument> & { id: string }): ReviewDocument {
  return {
    originalFileName: "fake.pdf",
    type: "IDENTIFICACAO_PESSOAL",
    status: "ENVIADO",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    rejectionReason: null,
    ...over,
  };
}

/** `DocumentKind` -> `DocumentType` do Prisma (COMPLEMENTAR grava como OUTRO). */
function typeOf(kind: DocumentKind): ReviewDocument["type"] {
  return kind === "COMPLEMENTAR" ? "OUTRO" : kind;
}

test("NEUTRALIDADE: mapa vazio reproduz a conferencia de antes do #47C", () => {
  // Para TODO tipo e TODO status, a saida com mapa vazio tem de ser exatamente a
  // que o mock produzia. Este e o teste que sustenta "sem mudanca de
  // comportamento" — hoje nao ha linha persistida, entao e o caminho de todos.
  for (const kind of DOCUMENT_KINDS) {
    for (const status of ["PENDENTE", "ENVIADO", "EM_ANALISE", "APROVADO", "REJEITADO"] as const) {
      const doc = reviewDoc({ id: "d1", type: typeOf(kind), status });
      const [review] = buildExtractionReview([doc], NO_EXTRACTION_FIELDS);

      assert.deepEqual(
        review.fields,
        mockFieldsFor(kind).map((f) => ({ ...f, confirmed: false })),
        `${kind}/${status}: campos divergiram do mock`,
      );
    }
  }
});

test("NEUTRALIDADE: a engine mock persistida produz a MESMA conferencia do mock", async () => {
  // O espelhamento provado no #47B vira, aqui, garantia de que a troca de fonte
  // nao muda nada: linha EXTRAIDA gravada pela engine === ausencia de linha.
  for (const kind of DOCUMENT_KINDS) {
    const doc = reviewDoc({ id: "d1", type: typeOf(kind), status: "ENVIADO" });

    const resultado = await mockExtractionEngine.extract({
      documentId: "d1",
      kind,
      mimeType: "application/pdf",
    });
    assert.ok(resultado.ok);

    const comPersistido = buildExtractionReview([doc], new Map([["d1", resultado.fields]]));
    const semPersistido = buildExtractionReview([doc], NO_EXTRACTION_FIELDS);

    assert.deepEqual(comPersistido, semPersistido, `${kind}: a troca de fonte mudou a saida`);
  }
});

test("persistido SUBSTITUI o mock quando presente", () => {
  const doc = reviewDoc({ id: "d1", type: "IDENTIFICACAO_PESSOAL" });
  const persistido = [
    { key: "nome", label: "Nome", value: "VALOR PERSISTIDO", confidence: "ALTA" as const },
  ];

  const [review] = buildExtractionReview([doc], new Map([["d1", persistido]]));

  assert.deepEqual(review.fields, [{ ...persistido[0], confirmed: false }]);
  assert.equal(review.hasLowConfidence, false, "confianca deriva dos campos EFETIVOS");
});

test("o mapa e por documento — um persistido nao contamina o vizinho", () => {
  const docs = [
    reviewDoc({ id: "com", createdAt: new Date("2026-01-02T10:00:00Z") }),
    reviewDoc({ id: "sem", createdAt: new Date("2026-01-01T10:00:00Z") }),
  ];
  const persistido = [
    { key: "nome", label: "Nome", value: "SO DESTE", confidence: "ALTA" as const },
  ];

  const reviews = buildExtractionReview(docs, new Map([["com", persistido]]));

  assert.equal(reviews[0].documentId, "com", "ordenacao por createdAt desc nao mudou");
  assert.equal(reviews[0].fields[0].value, "SO DESTE");
  assert.deepEqual(
    reviews[1].fields,
    mockFieldsFor("IDENTIFICACAO_PESSOAL").map((f) => ({ ...f, confirmed: false })),
    "o documento sem extracao continua no mock",
  );
});

test("estado nao utilizavel nunca chega ao review — cai no mock via loader", async () => {
  // A regra vive no loader/guard: estados nao utilizaveis ficam FORA do mapa, e
  // ausencia no mapa e mock. Aqui provamos a ponta a ponta, do banco ao review.
  for (const state of ["PENDENTE", "PROCESSANDO", "FALHOU"]) {
    db = installFakePrisma();
    db.processDocument.seed({ id: DOC_A, processId: "proc-1" });
    seedExtraction(DOC_A, { state });

    const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);
    const doc = reviewDoc({ id: DOC_A });
    const [review] = buildExtractionReview([doc], mapa);

    assert.deepEqual(
      review.fields,
      mockFieldsFor("IDENTIFICACAO_PESSOAL").map((f) => ({ ...f, confirmed: false })),
      `${state}: deveria cair no mock`,
    );
  }
});

test("estado utilizavel chega ao review — do banco ate a conferencia", async () => {
  for (const state of USABLE_EXTRACTION_STATES) {
    db = installFakePrisma();
    db.processDocument.seed({ id: DOC_A, processId: "proc-1" });
    seedExtraction(DOC_A, { state });

    const mapa = await loadOwnerExtractionFields([{ id: DOC_A }]);
    const [review] = buildExtractionReview([reviewDoc({ id: DOC_A })], mapa);

    assert.deepEqual(review.fields, CAMPOS_VALIDOS.map((f) => ({ ...f, confirmed: false })), state);
  }
});

/* ------------------------------------------------ escopo: PR INERTE (#47C-0) --- */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function arquivosDe(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return arquivosDe(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const LOADER = "src/server/services/loadOwnerExtractionFields.ts";

/**
 * Quem PODE chamar o loader (PR #47C).
 *
 * Lista FECHADA: o loader le PII por posse, entao cada chamador novo e uma
 * decisao de exposicao, nao um detalhe. Um arquivo que passe a importa-lo sem
 * entrar aqui derruba o teste de proposito.
 */
const CHAMADORES_AUTORIZADOS = [
  "src/app/(user)/processos/[id]/page.tsx",
  "src/server/services/applyDestinationSuggestion.ts",
];

test("so os chamadores autorizados usam o loader do dono", () => {
  // `codeOnly`: interessa IMPORTAR o loader, nao cita-lo. `documentExtractionReview.ts`
  // explica em prosa quem carrega o mapa — mencao nao e uso.
  const importadores = [...arquivosDe("src"), ...arquivosDe("prisma")]
    .filter((file) => file !== LOADER)
    .filter((file) => /loadOwnerExtractionFields/.test(codeOnly(readFileSync(file, "utf8"))));

  assert.deepEqual(
    importadores.sort(),
    [...CHAMADORES_AUTORIZADOS].sort(),
    "chamador novo do loader e decisao de PII — precisa entrar na lista de propósito",
  );
});

test("os 4 consumidores receberam a fonte injetada", () => {
  // Cada consumidor tem a sua forma legitima de obter o mapa. O que NENHUM pode
  // fazer e ler a fonte por conta propria (repositorio) ou acionar a engine.
  const CONSUMIDORES: Record<string, RegExp> = {
    // Faz I/O: carrega o mapa uma vez e repassa ao painel.
    "src/app/(user)/processos/[id]/page.tsx": /loadOwnerExtractionFields\(documents\)/,
    // Componente NAO faz I/O: recebe por prop.
    "src/components/documents/DocumentIntakePanel.tsx": /extractionFields/,
    // Puro: recebe por parametro, nunca busca.
    "src/server/automation/automationReadinessInput.ts": /extractionFields/,
    // Service async: carrega antes de derivar.
    "src/server/services/applyDestinationSuggestion.ts": /loadOwnerExtractionFields\(documents\)/,
  };

  for (const [arquivo, esperado] of Object.entries(CONSUMIDORES)) {
    const source = readFileSync(arquivo, "utf8");
    assert.ok(source.includes("buildExtractionReview"), `${arquivo}: continua consumidor`);
    assert.match(source, esperado, `${arquivo}: nao recebeu a fonte injetada`);
    assert.ok(
      !source.includes("documentExtractionRepository"),
      `${arquivo}: le a fonte pelo loader, nunca pelo repositorio`,
    );
  }
});

test("buildExtractionReview trocou de fonte SEM perder pureza", async () => {
  // `codeOnly`: o cabecalho do modulo explica POR QUE nao pode virar async e
  // quem carrega o mapa — a trava e sobre codigo, nao sobre a prosa que o documenta.
  const code = codeOnly(readFileSync("src/server/documents/documentExtractionReview.ts", "utf8"));
  assert.match(code, /mockFieldsFor/, "o mock continua como FALLBACK");
  assert.doesNotMatch(code, /\b(await|async)\b/, "continua sincrona");
  assert.doesNotMatch(code, /Repository|loadOwner|getPrisma/, "nao le banco: recebe injetado");

  const { buildExtractionReview } = await import(
    "../../../src/server/documents/documentExtractionReview"
  );
  assert.equal(
    buildExtractionReview.length,
    2,
    "parametro obrigatorio: e o que impede troca pela metade",
  );
});

test("nenhum caminho de ADMIN usa o loader do dono", () => {
  const adminFiles = [
    ...arquivosDe("src/app/(admin)"),
    "src/server/services/getAdminProcessDetail.ts",
    "src/server/services/getAutomationQueue.ts",
    "src/server/services/submitToAutomationQueue.ts",
  ];

  const violacoes = adminFiles.filter((file) =>
    /loadOwnerExtractionFields/.test(readFileSync(file, "utf8")),
  );

  assert.deepEqual(
    violacoes,
    [],
    `equipe lendo PII de terceiro exige process.pii.viewFull, nao posse: ${violacoes.join(", ")}`,
  );
});

test("o loader se declara owner-scoped no nome e no comentario", () => {
  const source = readFileSync(LOADER, "utf8");

  assert.match(source, /export async function loadOwnerExtractionFields/, "o nome diz Owner");
  assert.match(source, /process\.pii\.viewFull/, "explica o criterio da equipe");
  assert.match(source, /\bposse\b/i, "explica o criterio do dono");
  assert.match(source, /listDocumentsForOwner/, "aponta de onde vem a checagem de dono");
});

test("o painel de intake NAO faz I/O — recebe o mapa por prop", () => {
  const source = readFileSync("src/components/documents/DocumentIntakePanel.tsx", "utf8");

  assert.match(source, /extractionFields: ExtractionFieldsByDocument/, "recebe por prop");
  assert.doesNotMatch(codeOnly(source), /\bawait\b|loadOwnerExtractionFields|getPrisma/, "sem I/O");
});

test("a pagina do processo carrega o mapa UMA vez e repassa ao painel", () => {
  const code = codeOnly(readFileSync("src/app/(user)/processos/[id]/page.tsx", "utf8"));
  const chamadas = code.match(/loadOwnerExtractionFields\(/g) ?? [];

  assert.equal(chamadas.length, 1, "mais de uma chamada seria N+1 no render");
  assert.match(code, /extractionFields=\{extractionFields\}/, "o mesmo mapa vai para o painel");
});

test("snapshotFromRow continua PURO — sem Prisma, sem loader, sem I/O", () => {
  const code = codeOnly(readFileSync("src/server/automation/automationReadinessInput.ts", "utf8"));

  assert.doesNotMatch(code, /getPrisma|Repository|loadOwnerExtractionFields/, "nao busca nada");
  assert.doesNotMatch(code, /\b(async|await)\b/, "continua sincrono");
  assert.match(code, /extractionFields/, "recebe a fonte por parametro");
});

test("fila e gate leem persistido pelo loader de READINESS, nunca pelo do dono", () => {
  // Invertido no #47C-2: a fila passou a ler persistido. O que continua proibido
  // e usar o loader OWNER-SCOPED aqui — caminho de equipe nao tem posse a
  // invocar; o que o autoriza e nao divulgar, nao ser dono.
  for (const arquivo of [
    "src/server/services/getAutomationQueue.ts",
    "src/server/services/submitToAutomationQueue.ts",
  ]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    assert.match(code, /loadReadinessExtractionFields\(/, `${arquivo}: le persistido`);
    assert.match(code, /snapshotFromRow\([^)]*extractionFields\)/, `${arquivo}: passa o mapa real`);
    assert.doesNotMatch(
      code,
      /loadOwnerExtractionFields/,
      `${arquivo}: loader do DONO nunca em caminho de equipe`,
    );
  }
});

test("a leitura nova nao faz rede, OCR real, nuvem, Gov.br/SINARM nem Fase 9", () => {
  for (const arquivo of [
    LOADER,
    "src/server/documents/documentExtractionFields.ts",
    "src/server/repositories/documentExtractionRepository.ts",
  ]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, `${arquivo}: sem rede`);
    assert.doesNotMatch(
      code,
      /\b(tesseract|openai|anthropic|textract|rekognition)/i,
      `${arquivo}: sem OCR/IA`,
    );
    assert.doesNotMatch(code, /gov\.?br|sinarm/i, `${arquivo}: sem Gov.br/SINARM`);
    assert.doesNotMatch(code, /phase9|PHASE9/i, `${arquivo}: sem Fase 9`);
  }
});

test("o loader nao cria, nao executa e nao grava extracao", () => {
  const code = codeOnly(readFileSync(LOADER, "utf8"));

  assert.doesNotMatch(code, /requestDocumentExtraction|runDocumentExtraction/, "nao executa");
  assert.doesNotMatch(code, /getExtractionEngine|mockExtractionEngine/, "nao chama engine");
  assert.doesNotMatch(code, /createPendingExtraction|updateExtractionState/, "nao grava");
});

test("NENHUM consumidor aciona engine, request ou run", () => {
  // A troca e de FONTE DE LEITURA. Criar ou executar extracao a partir de um
  // render ou de uma acao do usuario e o #47D, e depende de worker.
  for (const arquivo of [
    "src/app/(user)/processos/[id]/page.tsx",
    "src/components/documents/DocumentIntakePanel.tsx",
    "src/server/automation/automationReadinessInput.ts",
    "src/server/services/applyDestinationSuggestion.ts",
    "src/server/services/getAutomationQueue.ts",
    "src/server/services/submitToAutomationQueue.ts",
    "src/server/documents/documentExtractionReview.ts",
  ]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    assert.doesNotMatch(
      code,
      /getExtractionEngine|requestDocumentExtraction|runDocumentExtraction|mockExtractionEngine/,
      `${arquivo}: extracao nao pode ser acionada por consumidor`,
    );
  }
});
