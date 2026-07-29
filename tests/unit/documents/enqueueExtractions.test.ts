/**
 * Criacao controlada de fila de extracao (PR #47D-3B).
 *
 * LIMITE HONESTO, como nos PRs anteriores da serie: a exclusao mutua real (o
 * indice unico parcial recusando a segunda ativa) vive no POSTGRES, e o CI roda
 * sem banco. O que estes testes provam e a POLITICA: quem entra na fila, quem
 * fica de fora, como cada desfecho e contado e o que NAO sai da tabela.
 *
 * Sem OCR, sem rede, sem agendamento, sem Fase 9.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma, type Row } from "../services/testPrisma";
import {
  ENQUEUE_BATCH_SIZE,
  enqueueDocumentExtractions,
} from "../../../src/server/services/enqueueDocumentExtractions";
import { listActiveExtractionDocumentIds } from "../../../src/server/repositories/documentExtractionRepository";
import { listDocumentsAwaitingExtraction } from "../../../src/server/repositories/processDocumentRepository";
import { ACTIVE_EXTRACTION_STATES } from "../../../src/server/services/requestDocumentExtraction";
import {
  MOCK_ENGINE_NAME,
  MOCK_ENGINE_VERSION,
  mockExtractionEngine,
} from "../../../src/server/extraction/mockEngine";

let db: FakePrisma = installFakePrisma();

const BASE = new Date("2026-06-01T10:00:00.000Z");
const emMinutos = (minutos: number) => new Date(BASE.getTime() + minutos * 60_000);

/** Cria um documento com status e idade controlados. */
function seedDocumento(sufixo: string, status: string, createdAt: Date = BASE): string {
  const id = `doc-${sufixo}`;
  db.processDocument.seed({
    id,
    processId: `proc-${sufixo}`,
    type: "IDENTIFICACAO_PESSOAL",
    status,
    createdAt,
  });
  return id;
}

/** Cria uma tentativa para um documento ja semeado. */
function seedTentativa(documentId: string, state: string, over: Row = {}): Row {
  return db.documentExtraction.seed({
    documentId,
    state,
    engine: MOCK_ENGINE_NAME,
    engineVersion: MOCK_ENGINE_VERSION,
    createdAt: BASE,
    updatedAt: BASE,
    ...over,
  });
}

function espiarEngine() {
  const original = mockExtractionEngine.extract.bind(mockExtractionEngine);
  let chamadas = 0;
  (mockExtractionEngine as { extract: typeof original }).extract = async (input) => {
    chamadas += 1;
    return original(input);
  };
  return {
    get chamadas() {
      return chamadas;
    },
    restaurar: () => ((mockExtractionEngine as { extract: typeof original }).extract = original),
  };
}

beforeEach(() => {
  db = installFakePrisma();
});

/* ------------------------------------------------------------- guardas --- */

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* -------------------------------------------------- quem entra na fila --- */

test("enfileira documento ENVIADO", async () => {
  seedDocumento("a", "ENVIADO");

  const resumo = await enqueueDocumentExtractions();

  assert.equal(resumo.candidates, 1);
  assert.equal(resumo.requested, 1);
  assert.equal(db.documentExtraction.rows.length, 1);
  assert.equal(db.documentExtraction.rows[0].state, "PENDENTE");
});

test("enfileira documento EM_ANALISE", async () => {
  seedDocumento("a", "EM_ANALISE");

  const resumo = await enqueueDocumentExtractions();

  assert.equal(resumo.requested, 1);
});

test("NAO enfileira APROVADO, REJEITADO nem PENDENTE", async () => {
  // APROVADO ja passou por pessoa; REJEITADO esta fora; PENDENTE e estado de
  // dominio para "exigido mas nao enviado" — nao ha arquivo para extrair.
  for (const status of ["APROVADO", "REJEITADO", "PENDENTE"]) {
    db = installFakePrisma();
    seedDocumento("a", status);

    const resumo = await enqueueDocumentExtractions();

    assert.equal(resumo.candidates, 0, `${status}: nao pode ser candidato`);
    assert.equal(db.documentExtraction.rows.length, 0, `${status}: nada foi criado`);
  }
});

test("NAO enfileira documento que ja tem tentativa PENDENTE", async () => {
  const doc = seedDocumento("a", "ENVIADO");
  seedTentativa(doc, "PENDENTE");

  const resumo = await enqueueDocumentExtractions();

  assert.equal(resumo.candidates, 0, "a vaga ativa ja esta ocupada");
  assert.equal(db.documentExtraction.rows.length, 1, "nenhuma segunda ativa foi criada");
});

test("NAO enfileira documento que ja tem tentativa PROCESSANDO", async () => {
  const doc = seedDocumento("a", "ENVIADO");
  seedTentativa(doc, "PROCESSANDO");

  const resumo = await enqueueDocumentExtractions();

  assert.equal(resumo.candidates, 0);
  assert.equal(db.documentExtraction.rows.length, 1);
});

test("documento com tentativa TERMINAL volta a ser elegivel", async () => {
  // O historico 1:N existe para isso: reprocessar cria linha nova, e o indice
  // parcial so proibe DUAS ATIVAS — terminal nao ocupa vaga.
  const doc = seedDocumento("a", "ENVIADO");
  seedTentativa(doc, "FALHOU");

  const resumo = await enqueueDocumentExtractions();

  assert.equal(resumo.requested, 1);
  assert.equal(db.documentExtraction.rows.length, 2, "historico preservado");
});

/* ------------------------------------------------------ limite e ordem --- */

test("respeita o limite e deixa o excedente para a proxima passada", async () => {
  for (let i = 0; i < ENQUEUE_BATCH_SIZE + 4; i += 1) {
    seedDocumento(`a${i}`, "ENVIADO", emMinutos(i));
  }

  const resumo = await enqueueDocumentExtractions();

  assert.equal(resumo.candidates, ENQUEUE_BATCH_SIZE);
  assert.equal(resumo.requested, ENQUEUE_BATCH_SIZE);
  assert.equal(db.documentExtraction.rows.length, ENQUEUE_BATCH_SIZE);
});

test("o limite padrao e 10", () => {
  assert.equal(ENQUEUE_BATCH_SIZE, 10);
});

test("enfileira em FIFO: createdAt asc, com desempate por id asc", async () => {
  seedDocumento("c", "ENVIADO", emMinutos(30));
  seedDocumento("a", "ENVIADO", emMinutos(10));
  // Empate de milissegundo com "a": so o desempate por id define a ordem.
  seedDocumento("b", "ENVIADO", emMinutos(10));

  await enqueueDocumentExtractions(2);

  const enfileirados = db.documentExtraction.rows.map((r) => r.documentId);
  assert.deepEqual(enfileirados, ["doc-a", "doc-b"], "quem esperou mais entra primeiro");
});

test("limit <= 0 nao consulta o banco", async () => {
  seedDocumento("a", "ENVIADO");

  let consultas = 0;
  const original = db.processDocument.findMany.bind(db.processDocument);
  (db.processDocument as { findMany: unknown }).findMany = async (args: Row) => {
    consultas += 1;
    return original(args);
  };

  try {
    const resumo = await enqueueDocumentExtractions(0);

    assert.equal(consultas, 0, "limite nao-positivo nao pode virar ida ao Postgres");
    assert.equal(resumo.candidates, 0);
  } finally {
    (db.processDocument as { findMany: unknown }).findMany = original;
  }
});

/* ----------------------------------------------------------- contagens --- */

test("corrida com outro acionamento conta em reused, nunca em failed", async () => {
  seedDocumento("a", "ENVIADO");

  // Entre a leitura dos candidatos e o INSERT, outro operador abriu a tentativa:
  // o indice unico parcial recusa a segunda com P2002, e o request rele e devolve
  // a existente. Isso e a protecao FUNCIONANDO.
  const original = db.documentExtraction.create.bind(db.documentExtraction);
  (db.documentExtraction as { create: unknown }).create = async () => {
    db.documentExtraction.seed({
      id: "vencedora",
      documentId: "doc-a",
      state: "PENDENTE",
      engine: MOCK_ENGINE_NAME,
      engineVersion: MOCK_ENGINE_VERSION,
      createdAt: new Date(),
    });
    throw Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["document_id"] },
    });
  };

  try {
    const resumo = await enqueueDocumentExtractions();

    assert.equal(resumo.reused, 1);
    assert.equal(resumo.failed, 0, "constraint funcionando nao e falha");
    assert.equal(resumo.requested, 0);
  } finally {
    (db.documentExtraction as { create: unknown }).create = original;
  }
});

test("request com ok:false conta em failed e o lote CONTINUA", async () => {
  seedDocumento("a", "ENVIADO", emMinutos(10));
  seedDocumento("b", "ENVIADO", emMinutos(20));

  // O primeiro documento some entre a listagem e o request.
  const original = db.processDocument.findUnique.bind(db.processDocument);
  (db.processDocument as { findUnique: unknown }).findUnique = async (args: {
    where: { id?: string };
  }) => (args.where.id === "doc-a" ? null : original(args));

  try {
    const resumo = await enqueueDocumentExtractions();

    assert.equal(resumo.candidates, 2);
    assert.equal(resumo.failed, 1);
    assert.equal(resumo.requested, 1, "a falha do primeiro nao derruba o segundo");
  } finally {
    (db.processDocument as { findUnique: unknown }).findUnique = original;
  }
});

test("candidates = requested + reused + failed, sempre", async () => {
  for (let i = 0; i < 3; i += 1) seedDocumento(`a${i}`, "ENVIADO", emMinutos(i));

  const resumo = await enqueueDocumentExtractions();

  assert.equal(resumo.candidates, resumo.requested + resumo.reused + resumo.failed);
});

test("o resumo traz cinco contagens e nenhuma PII", async () => {
  const doc = seedDocumento("a", "ENVIADO");
  seedTentativa(doc, "FALHOU", {
    fields: [{ key: "cpf", label: "CPF", value: "000.000.000-00", confidence: "ALTA" }],
  });

  const resumo = await enqueueDocumentExtractions();

  assert.deepEqual(Object.keys(resumo).sort(), [
    "candidates",
    "durationMs",
    "failed",
    "requested",
    "reused",
  ]);
  assert.doesNotMatch(JSON.stringify(resumo), /cpf|000\.000|ALTA|doc-a/i);
});

test("falha ao ler as listas devolve resumo zerado, sem lancar", async () => {
  seedDocumento("a", "ENVIADO");

  const original = db.documentExtraction.findMany.bind(db.documentExtraction);
  (db.documentExtraction as { findMany: unknown }).findMany = async () => {
    throw Object.assign(new Error("Unique constraint failed on the fields: (`document_id`)"), {
      code: "P2002",
    });
  };

  try {
    const resumo = await enqueueDocumentExtractions();

    assert.equal(resumo.candidates, 0);
    assert.equal(resumo.requested, 0);
    assert.equal(typeof resumo.durationMs, "number");
    assert.doesNotMatch(JSON.stringify(resumo), /P2002|constraint|document_id/i);
  } finally {
    (db.documentExtraction as { findMany: unknown }).findMany = original;
  }
});

test("enfileirar NAO chama a engine", async () => {
  seedDocumento("a", "ENVIADO");

  const espiao = espiarEngine();
  try {
    await enqueueDocumentExtractions();
    assert.equal(espiao.chamadas, 0, "criar fila nao processa nada");
  } finally {
    espiao.restaurar();
  }
});

/* --------------------------------------------------------- repositorios --- */

test("a lista de ativos devolve so documentId, e so de tentativas ativas", async () => {
  const a = seedDocumento("a", "ENVIADO");
  const b = seedDocumento("b", "ENVIADO");
  const c = seedDocumento("c", "ENVIADO");
  seedTentativa(a, "PENDENTE");
  seedTentativa(b, "PROCESSANDO");
  seedTentativa(c, "EXTRAIDA");

  const ativos = await listActiveExtractionDocumentIds();

  assert.deepEqual([...ativos].sort(), ["doc-a", "doc-b"]);
  assert.ok(
    ativos.every((id) => typeof id === "string"),
    "so ids, nunca linhas",
  );
});

test("a fila de documentos seleciona SO o id", async () => {
  db.processDocument.seed({
    id: "doc-a",
    processId: "proc-a",
    status: "ENVIADO",
    type: "IDENTIFICACAO_PESSOAL",
    originalFileName: "identidade-maria.pdf",
    storageKey: "processos/proc-a/identidade.pdf",
    sha256: "a".repeat(64),
    createdAt: BASE,
  });

  const [linha] = await listDocumentsAwaitingExtraction(10, []);

  assert.deepEqual(Object.keys(linha), ["id"], "nada alem do id sai da tabela");
  assert.doesNotMatch(JSON.stringify(linha), /identidade-maria|processos\/|proc-a/);
});

test("excludeDocumentIds vazio nao exclui nada", async () => {
  seedDocumento("a", "ENVIADO");

  const linhas = await listDocumentsAwaitingExtraction(10, []);

  assert.equal(linhas.length, 1, "lista vazia de exclusao nao pode zerar a fila");
});

test("os estados ativos do repositorio sao os mesmos do service", async () => {
  // A lista e duplicada no repositorio para nao inverter a camada (repositorio
  // nao importa service). Sem esta paridade, as duas divergiriam em silencio e a
  // fila passaria a enfileirar documento ja ocupado — ou a ignorar documento livre.
  const doc = seedDocumento("a", "ENVIADO");

  for (const state of ACTIVE_EXTRACTION_STATES) {
    db = installFakePrisma();
    const d = seedDocumento("a", "ENVIADO");
    seedTentativa(d, state);
    const ativos = await listActiveExtractionDocumentIds();
    assert.deepEqual(ativos, [d], `${state} precisa contar como ativo`);
  }

  assert.ok(doc, "documento base semeado");
  const source = readFileSync("src/server/repositories/documentExtractionRepository.ts", "utf8");
  assert.match(
    source,
    /ACTIVE_STATES[\s\S]*?\["PENDENTE", "PROCESSANDO"\]/,
    "a copia local precisa listar exatamente os estados ativos",
  );
});

/* ------------------------------------------------ notIn no fake do Prisma --- */

test("o fake aplica notIn: exclui os ids da lista", async () => {
  seedDocumento("a", "ENVIADO", emMinutos(10));
  seedDocumento("b", "ENVIADO", emMinutos(20));

  const linhas = await listDocumentsAwaitingExtraction(10, ["doc-a"]);

  assert.deepEqual(
    linhas.map((l) => l.id),
    ["doc-b"],
  );
});

test("o fake recusa notIn que nao seja array", async () => {
  // PRECISA de linha semeada: o fake so avalia o `where` ao FILTRAR, entao numa
  // tabela vazia nenhum operador chega a ser inspecionado. A trava de operador
  // vale por linha existente, nao pela forma da consulta.
  seedDocumento("a", "ENVIADO");

  await assert.rejects(
    () => db.processDocument.findMany({ where: { id: { notIn: "doc-a" } } as never }),
    /notIn` exige um array/,
  );
});

test("operador desconhecido continua lancando no fake", async () => {
  seedDocumento("a", "ENVIADO");

  await assert.rejects(
    () => db.processDocument.findMany({ where: { id: { startsWith: "doc" } } as never }),
    /filtro nao suportado/,
  );
});

/* -------------------------------------------------- travas estaticas --- */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SERVICE = "src/server/services/enqueueDocumentExtractions.ts";

test("o service nao chama o lote, a varredura nem a engine", () => {
  const code = codeOnly(readFileSync(SERVICE, "utf8"));

  for (const proibido of [
    "runExtractionWorkerOnce",
    "runExtractionReaperOnce",
    "getExtractionEngine",
    "mockExtractionEngine",
    "claimPendingExtraction",
  ]) {
    assert.doesNotMatch(code, new RegExp(proibido), `service nao pode usar ${proibido}`);
  }
  assert.match(code, /requestDocumentExtraction\(/, "abrir tentativa continua delegado");
});

test("o service nao loga — quem tem o autor e a camada de cima", () => {
  const code = codeOnly(readFileSync(SERVICE, "utf8"));
  assert.doesNotMatch(code, /logger\./, "evento sem actorId seria auditoria pela metade");
});

test("todo catch do service e sem binding", () => {
  const code = codeOnly(readFileSync(SERVICE, "utf8"));
  assert.doesNotMatch(code, /catch\s*\(/);
  assert.equal((code.match(/\} catch \{/g) ?? []).length, 1);
});

test("o service nao faz rede, OCR real, storage nem Fase 9", () => {
  const code = codeOnly(readFileSync(SERVICE, "utf8"));

  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
  assert.doesNotMatch(code, /\b(tesseract|openai|anthropic|textract|rekognition)/i, "sem OCR/IA");
  assert.doesNotMatch(code, /gov\.?br|sinarm|policia federal/i, "sem orgao publico");
  assert.doesNotMatch(code, /phase9|PHASE9/i, "sem Fase 9");
  assert.doesNotMatch(code, /storageKey|getStorageAdapter|readFile/, "sem storage/arquivo");
  assert.doesNotMatch(code, /setInterval|setTimeout|cron|schedule/i, "sem agendamento");
  assert.doesNotMatch(code, /getEnv|process\.env/, "sem variavel de ambiente");
});

test("a fila de documentos nao seleciona metadado sensivel", () => {
  const code = codeOnly(readFileSync("src/server/repositories/processDocumentRepository.ts", "utf8"));
  const fila = code.match(/export function listDocumentsAwaitingExtraction[\s\S]*?\n}/)?.[0] ?? "";

  assert.ok(fila, "a funcao precisa existir");
  assert.match(fila, /select: \{ id: true \}/, "o select E o gate");
  assert.doesNotMatch(fila, /originalFileName|storageKey|sha256|processId/, "nada sensivel");
  assert.match(fila, /status: \{ in: \["ENVIADO", "EM_ANALISE"\] \}/, "criterio de elegibilidade");
  assert.match(fila, /take: limit/, "o corte acontece no banco");
});

test("package.json roda este arquivo em test:documents:unit", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.match(
    pkg.scripts["test:documents:unit"],
    /tests\/unit\/documents\/enqueueExtractions\.test\.ts/,
  );
});
