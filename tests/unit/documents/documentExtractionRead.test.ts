/**
 * Infraestrutura de LEITURA da extracao persistida (PR #47C-0).
 *
 * Este PR e INERTE: cria a leitura em lote, o guard do JSON e o loader do dono,
 * e NAO troca nenhum consumidor. `buildExtractionReview` continua derivando do
 * mock — a troca e o #47C, e tem de ser atomica. Ha testes aqui provando
 * justamente que a troca NAO aconteceu ainda.
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

test("NENHUM consumidor foi trocado — o loader ainda nao tem chamador", () => {
  const importadores = [...arquivosDe("src"), ...arquivosDe("prisma")]
    .filter((file) => file !== LOADER)
    .filter((file) => /loadOwnerExtractionFields/.test(readFileSync(file, "utf8")));

  assert.deepEqual(
    importadores,
    [],
    `o #47C-0 e inerte: a troca e o #47C, e tem de ser atomica. Achei: ${importadores.join(", ")}`,
  );
});

test("os 4 consumidores de buildExtractionReview continuam na fonte antiga", () => {
  const CONSUMIDORES = [
    "src/app/(user)/processos/[id]/page.tsx",
    "src/components/documents/DocumentIntakePanel.tsx",
    "src/server/automation/automationReadinessInput.ts",
    "src/server/services/applyDestinationSuggestion.ts",
  ];

  for (const arquivo of CONSUMIDORES) {
    const source = readFileSync(arquivo, "utf8");
    assert.ok(source.includes("buildExtractionReview"), `${arquivo}: ainda e consumidor`);
    assert.ok(
      !source.includes("loadOwnerExtractionFields") &&
        !source.includes("documentExtractionRepository"),
      `${arquivo} nao pode ler a nova fonte neste PR`,
    );
  }
});

test("buildExtractionReview NAO foi alterado", async () => {
  const source = readFileSync("src/server/documents/documentExtractionReview.ts", "utf8");
  assert.match(source, /mockFieldsFor/, "a fonte continua sendo a funcao pura");
  assert.doesNotMatch(source, /await|Promise|async/, "continua sincrona");
  assert.doesNotMatch(source, /documentExtractionFields|Repository/, "nao le a fonte nova");

  const { buildExtractionReview } = await import(
    "../../../src/server/documents/documentExtractionReview"
  );
  assert.equal(buildExtractionReview.length, 1, "assinatura intacta: so `documents`");
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
