/**
 * Idempotencia e corrida na extracao documental (PR #47C-4).
 *
 * LIMITE HONESTO — LEIA ANTES DE CONFIAR NESTES TESTES:
 * a garantia central deste PR mora no POSTGRES, nao aqui. O indice unico parcial
 * `document_extractions_one_active_per_document`, o P2002 real e a atomicidade do
 * `UPDATE ... WHERE state = 'PENDENTE'` so existem no banco, e o CI roda SEM
 * banco (`.github/workflows/ci.yml` nao declara servico nem DATABASE_URL).
 *
 * O que estes testes provam: a POLITICA dos services (reusar ativa, nao rodar
 * sem claim, recuperar de P2002) e a FORMA das consultas (o claim carrega
 * `state` no `where`; o latest pede desempate). O que eles NAO provam: que o
 * Postgres recusa a segunda ativa. Isso exige verificacao manual, registrada no
 * PR.
 *
 * Sem OCR, sem rede, sem worker.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma } from "../services/testPrisma";
import { requestDocumentExtraction } from "../../../src/server/services/requestDocumentExtraction";
import { runDocumentExtraction } from "../../../src/server/services/runDocumentExtraction";
import {
  claimPendingExtraction,
  failStaleProcessingExtractions,
  findLatestExtractionForDocument,
  findLatestExtractionsWithFieldsForDocuments,
} from "../../../src/server/repositories/documentExtractionRepository";
import { mockExtractionEngine } from "../../../src/server/extraction/mockEngine";
import {
  ACTIVE_EXTRACTION_STATES,
  PROCESSING_TIMEOUT_MS,
  TERMINAL_EXTRACTION_STATES,
} from "../../../src/server/services/requestDocumentExtraction";
import { EXTRACTION_FAILURE_REASONS } from "../../../src/server/documents/documentExtractionTypes";
import { logger } from "../../../src/lib/logger";

let db: FakePrisma = installFakePrisma();

const DOC = "doc-1";

/** Todos os `.ts`/`.tsx` sob `dir`, recursivo. Usado na varredura de `db:push`. */
function arquivosTs(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) arquivosTs(caminho, acc);
    else if (/\.tsx?$/.test(entrada)) acc.push(caminho);
  }
  return acc;
}

beforeEach(() => {
  db = installFakePrisma();
  db.processDocument.seed({ id: DOC, processId: "proc-1", type: "IDENTIFICACAO_PESSOAL" });
});

/** Espia a engine e devolve quantas vezes ela foi chamada. */
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

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ------------------------------------------------- request: reuso/criacao --- */

test("reutiliza tentativa PENDENTE em vez de criar outra", async () => {
  const primeira = await requestDocumentExtraction(DOC);
  const segunda = await requestDocumentExtraction(DOC);

  assert.ok(primeira.ok && segunda.ok);
  assert.equal(segunda.reused, true);
  assert.equal(segunda.extraction.id, primeira.extraction.id);
  assert.equal(db.documentExtraction.rows.length, 1, "nao pode existir segunda ativa");
});

test("reutiliza tentativa PROCESSANDO", async () => {
  const primeira = await requestDocumentExtraction(DOC);
  assert.ok(primeira.ok);
  await claimPendingExtraction(primeira.extraction.id);

  const segunda = await requestDocumentExtraction(DOC);

  assert.ok(segunda.ok);
  assert.equal(segunda.reused, true);
  assert.equal(db.documentExtraction.rows.length, 1);
});

test("cria tentativa NOVA depois de cada estado terminal", async () => {
  for (const terminal of TERMINAL_EXTRACTION_STATES) {
    db = installFakePrisma();
    db.processDocument.seed({ id: DOC, processId: "proc-1", type: "IDENTIFICACAO_PESSOAL" });
    db.documentExtraction.seed({
      documentId: DOC,
      state: terminal,
      engine: "mock",
      engineVersion: "0.1.0-mock",
      createdAt: new Date("2026-01-01T10:00:00Z"),
    });

    const result = await requestDocumentExtraction(DOC);

    assert.ok(result.ok, `${terminal}`);
    assert.equal(result.reused, false, `${terminal}: terminal libera reprocessamento`);
    assert.equal(db.documentExtraction.rows.length, 2, `${terminal}: historico preservado`);
  }
});

/* ------------------------------------------------------- request: P2002 --- */

/** Faz o proximo `create` colidir, como o indice unico parcial faria. */
function fazerCreateColidir(aoColidir?: () => void) {
  const original = db.documentExtraction.create.bind(db.documentExtraction);
  (db.documentExtraction as { create: typeof original }).create = async () => {
    aoColidir?.();
    // Formato do Prisma: o service checa `code`, nao `instanceof`.
    throw Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["document_id"] },
    });
  };
  return () => ((db.documentExtraction as { create: typeof original }).create = original);
}

test("colisao P2002 rebusca a ativa e devolve reused", async () => {
  // Simula a corrida: entre o findLatest e o INSERT, outro chamador criou a ativa.
  const restaurar = fazerCreateColidir(() => {
    db.documentExtraction.seed({
      id: "vencedora",
      documentId: DOC,
      state: "PENDENTE",
      engine: "mock",
      engineVersion: "0.1.0-mock",
      createdAt: new Date(),
    });
  });

  try {
    const result = await requestDocumentExtraction(DOC);

    assert.ok(result.ok, "a constraint funcionando nao pode virar erro para o usuario");
    assert.equal(result.reused, true);
    assert.equal(result.extraction.id, "vencedora");
  } finally {
    restaurar();
  }
});

test("colisao P2002 SEM ativa vira erro seguro, sem inventar tentativa", async () => {
  const restaurar = fazerCreateColidir();

  try {
    const result = await requestDocumentExtraction(DOC);

    assert.equal(result.ok, false, "colidiu e a vencedora ja terminou: nao ha o que devolver");
    assert.ok(!result.ok && !/P2002|constraint|prisma/i.test(result.error), "erro sem detalhe interno");
  } finally {
    restaurar();
  }
});

test("erro que NAO e P2002 continua erro generico seguro", async () => {
  const original = db.documentExtraction.create.bind(db.documentExtraction);
  (db.documentExtraction as { create: typeof original }).create = async () => {
    throw new Error("conexao recusada");
  };

  try {
    const result = await requestDocumentExtraction(DOC);
    assert.equal(result.ok, false);
  } finally {
    (db.documentExtraction as { create: typeof original }).create = original;
  }
});

/* --------------------------------------------------------- run: claim --- */

test("claim transiciona PENDENTE -> PROCESSANDO uma UNICA vez", async () => {
  const aberta = await requestDocumentExtraction(DOC);
  assert.ok(aberta.ok);

  assert.equal(await claimPendingExtraction(aberta.extraction.id), true, "primeiro vence");
  assert.equal(await claimPendingExtraction(aberta.extraction.id), false, "segundo perde");
  assert.equal(db.documentExtraction.rows[0].state, "PROCESSANDO");
});

test("segunda execucao devolve claimed:false e NAO chama a engine", async () => {
  await requestDocumentExtraction(DOC);
  await runDocumentExtraction(DOC);

  const espiao = espiarEngine();
  try {
    const segunda = await runDocumentExtraction(DOC);

    assert.ok(segunda.ok, "perder o claim nao e falha");
    assert.equal(segunda.claimed, false);
    assert.equal(espiao.chamadas, 0, "engine rodando duas vezes e o defeito que o claim evita");
  } finally {
    espiao.restaurar();
  }
});

test("tentativa em PROCESSANDO nao e reprocessada", async () => {
  const aberta = await requestDocumentExtraction(DOC);
  assert.ok(aberta.ok);
  await claimPendingExtraction(aberta.extraction.id);

  const espiao = espiarEngine();
  try {
    const result = await runDocumentExtraction(DOC);
    assert.ok(result.ok);
    assert.equal(result.claimed, false);
    assert.equal(espiao.chamadas, 0);
  } finally {
    espiao.restaurar();
  }
});

test("quem claima roda a engine e grava EXTRAIDA", async () => {
  await requestDocumentExtraction(DOC);

  const espiao = espiarEngine();
  try {
    const result = await runDocumentExtraction(DOC);
    assert.ok(result.ok && result.claimed);
    assert.equal(result.extraction.state, "EXTRAIDA");
    assert.equal(espiao.chamadas, 1);
  } finally {
    espiao.restaurar();
  }
});

test("falha da engine leva a tentativa claimada para FALHOU", async () => {
  await requestDocumentExtraction(DOC);
  const original = mockExtractionEngine.extract.bind(mockExtractionEngine);
  (mockExtractionEngine as { extract: typeof original }).extract = async () => ({
    ok: false as const,
    failureReason: "ARQUIVO_ILEGIVEL" as const,
  });

  try {
    const result = await runDocumentExtraction(DOC);
    assert.ok(result.ok && result.claimed);
    assert.equal(result.extraction.state, "FALHOU");
  } finally {
    (mockExtractionEngine as { extract: typeof original }).extract = original;
  }
});

/* ------------------------------------------------------ latest determinista --- */

const MESMO_MS = new Date("2026-03-01T12:00:00.000Z");

function seedEmpate() {
  db = installFakePrisma();
  db.processDocument.seed({ id: DOC, processId: "proc-1", type: "IDENTIFICACAO_PESSOAL" });
  // Ordem de insercao propositalmente diferente da ordem por id.
  for (const id of ["aaa", "zzz", "mmm"]) {
    db.documentExtraction.seed({
      id,
      documentId: DOC,
      state: "EXTRAIDA",
      engine: "mock",
      engineVersion: "0.1.0-mock",
      fields: [{ key: "nome", label: "Nome", value: id, confidence: "ALTA" }],
      createdAt: MESMO_MS,
    });
  }
}

test("empate de createdAt desempata por id DESC — e nao alterna", async () => {
  seedEmpate();

  const primeira = await findLatestExtractionForDocument(DOC);
  const segunda = await findLatestExtractionForDocument(DOC);

  assert.equal(primeira?.id, "zzz", "id DESC entre createdAt iguais");
  assert.equal(segunda?.id, primeira?.id, "a mesma pergunta nao pode ter duas respostas");
});

test("a leitura em LOTE respeita o mesmo desempate", async () => {
  seedEmpate();

  const [row] = await findLatestExtractionsWithFieldsForDocuments([DOC]);

  assert.equal(row.id, "zzz", "singular e lote nao podem discordar de qual e a mais recente");
});

/* ------------------------------------- timeout de PROCESSANDO orfa (#47D-0) --- */

/**
 * O #47C-4 impediu corrida, mas criou um efeito colateral: como o indice unico
 * parcial proibe uma segunda ativa, uma linha que ficou PROCESSANDO por queda da
 * app nao so persiste — ela TRAVA o documento. `request` a reusaria para sempre
 * e `run` a recusaria. Estes testes cobrem a saida.
 */
const AGORA = Date.now();
const VELHO = new Date(AGORA - PROCESSING_TIMEOUT_MS - 60_000);
const RECENTE = new Date(AGORA - 60_000);
const CUTOFF = new Date(AGORA - PROCESSING_TIMEOUT_MS);

function seedExtracao(over: Record<string, unknown>) {
  return db.documentExtraction.seed({
    documentId: DOC,
    engine: "mock",
    engineVersion: "0.1.0-mock",
    createdAt: VELHO,
    updatedAt: VELHO,
    ...over,
  });
}

test("PROCESSANDO recente NAO e encerrada", async () => {
  seedExtracao({ state: "PROCESSANDO", updatedAt: RECENTE });

  assert.equal(await failStaleProcessingExtractions(DOC, CUTOFF), 0);
  assert.equal(db.documentExtraction.rows[0].state, "PROCESSANDO");
});

test("PROCESSANDO antiga vira FALHOU com failureReason TIMEOUT", async () => {
  seedExtracao({ state: "PROCESSANDO" });

  assert.equal(await failStaleProcessingExtractions(DOC, CUTOFF), 1);
  assert.equal(db.documentExtraction.rows[0].state, "FALHOU");
  assert.equal(db.documentExtraction.rows[0].failureReason, "TIMEOUT");
});

test("o motivo do timeout e um codigo FECHADO do dominio", async () => {
  seedExtracao({ state: "PROCESSANDO" });
  await failStaleProcessingExtractions(DOC, CUTOFF);

  assert.ok(
    (EXTRACTION_FAILURE_REASONS as readonly string[]).includes(
      String(db.documentExtraction.rows[0].failureReason),
    ),
    "nunca texto livre",
  );
});

test("nenhum outro estado e tocado, por mais antigo que seja", async () => {
  for (const state of ["PENDENTE", ...TERMINAL_EXTRACTION_STATES]) {
    db = installFakePrisma();
    db.processDocument.seed({ id: DOC, processId: "proc-1", type: "IDENTIFICACAO_PESSOAL" });
    seedExtracao({ state });

    assert.equal(await failStaleProcessingExtractions(DOC, CUTOFF), 0, `${state}`);
    assert.equal(db.documentExtraction.rows[0].state, state, `${state} intacto`);
  }
});

test("o relogio e updatedAt, NAO createdAt", async () => {
  // Pedida ha muito tempo, mas o processamento COMECOU agora: e trabalho vivo.
  // Se o corte usasse `createdAt`, mataria uma extracao recem-claimada.
  seedExtracao({ state: "PROCESSANDO", createdAt: VELHO, updatedAt: RECENTE });

  assert.equal(await failStaleProcessingExtractions(DOC, CUTOFF), 0);
  assert.equal(db.documentExtraction.rows[0].state, "PROCESSANDO");
});

test("reaper de PROCESSANDO antigo fica limitado ao documentId informado", async () => {
  // O reaper DESTROI trabalho. Escopo errado aqui nao mostra texto errado nem
  // devolve dado velho: mata tentativas vivas de OUTRO documento, em silencio, e
  // grava TIMEOUT como se fosse verdade.
  //
  // A trava importa porque a mudanca perigosa e PLAUSIVEL: o #47D vai querer um
  // reap GLOBAL, e tirar o `documentId` do `where` e exatamente o atalho que
  // alguem tomaria para chegar la.
  const OUTRO = "doc-2";
  db.processDocument.seed({ id: OUTRO, processId: "proc-2", type: "IDENTIFICACAO_PESSOAL" });

  const doA = seedExtracao({ id: "a", state: "PROCESSANDO" });
  const doB = db.documentExtraction.seed({
    id: "b",
    documentId: OUTRO,
    state: "PROCESSANDO",
    engine: "mock",
    engineVersion: "0.1.0-mock",
    createdAt: VELHO,
    updatedAt: VELHO,
  });

  const encerradas = await failStaleProcessingExtractions(DOC, CUTOFF);

  assert.equal(encerradas, 1, "so a tentativa do documento pedido pode ser encerrada");
  assert.equal(doA.state, "FALHOU");
  assert.equal(doA.failureReason, "TIMEOUT");

  assert.equal(doB.state, "PROCESSANDO", "o documento vizinho nao pode ser afetado");
  assert.equal(doB.failureReason, null, "nem ganhar motivo de falha");
});

test("o reaper e idempotente — a segunda passada encontra 0", async () => {
  seedExtracao({ state: "PROCESSANDO" });

  assert.equal(await failStaleProcessingExtractions(DOC, CUTOFF), 1);
  assert.equal(await failStaleProcessingExtractions(DOC, CUTOFF), 0);
});

test("o reaper devolve CONTAGEM, nunca linhas nem PII", async () => {
  seedExtracao({
    state: "PROCESSANDO",
    fields: [{ key: "cpf", label: "CPF", value: "000.000.000-00", confidence: "ALTA" }],
  });

  const resultado = await failStaleProcessingExtractions(DOC, CUTOFF);

  assert.equal(typeof resultado, "number", "quem limpa nao recebe a linha de volta");
  assert.doesNotMatch(JSON.stringify(resultado), /cpf|000\.000|confidence/);
});

/* --------------------------- o documento deixa de ficar travado --- */

test("request NAO fica preso numa PROCESSANDO antiga: encerra e cria nova", async () => {
  const orfa = seedExtracao({ state: "PROCESSANDO" });

  const result = await requestDocumentExtraction(DOC);

  assert.ok(result.ok);
  assert.equal(result.reused, false, "a orfa nao pode ser reaproveitada");
  assert.notEqual(result.extraction.id, orfa.id);
  assert.equal(result.extraction.state, "PENDENTE");

  const encerrada = db.documentExtraction.rows.find((r) => r.id === orfa.id);
  assert.equal(encerrada?.state, "FALHOU", "a antiga saiu de PROCESSANDO");
  assert.equal(encerrada?.failureReason, "TIMEOUT");

  // O historico 1:N e preservado: encerrar nao apaga a evidencia.
  assert.equal(db.documentExtraction.rows.length, 2);
});

test("request REUSA PROCESSANDO recente — timeout nao mata trabalho vivo", async () => {
  const viva = seedExtracao({ state: "PROCESSANDO", updatedAt: RECENTE });

  const result = await requestDocumentExtraction(DOC);

  assert.ok(result.ok);
  assert.equal(result.reused, true);
  assert.equal(result.extraction.id, viva.id);
  assert.equal(db.documentExtraction.rows.length, 1, "nada foi criado");
});

test("so UMA ativa sobra depois do reap — o indice parcial aceitaria", async () => {
  seedExtracao({ state: "PROCESSANDO" });
  await requestDocumentExtraction(DOC);

  const ativas = db.documentExtraction.rows.filter((r) =>
    ACTIVE_EXTRACTION_STATES.includes(r.state as (typeof ACTIVE_EXTRACTION_STATES)[number]),
  );
  assert.equal(ativas.length, 1, "duas ativas violariam o unique parcial no Postgres");
});

test("o timeout NAO chama a engine", async () => {
  seedExtracao({ state: "PROCESSANDO" });

  const espiao = espiarEngine();
  try {
    await requestDocumentExtraction(DOC);
    assert.equal(espiao.chamadas, 0, "encerrar por timeout nao processa nada");
  } finally {
    espiao.restaurar();
  }
});

test("o log do timeout nao carrega PII", async () => {
  seedExtracao({
    state: "PROCESSANDO",
    fields: [{ key: "nome", label: "Nome", value: "MARIA DA SILVA", confidence: "ALTA" }],
  });

  const original = logger.warn.bind(logger);
  const eventos: unknown[] = [];
  (logger as { warn: typeof original }).warn = ((obj: unknown) => {
    eventos.push(obj);
    return undefined;
  }) as typeof original;

  try {
    await requestDocumentExtraction(DOC);
  } finally {
    (logger as { warn: typeof original }).warn = original;
  }

  const timeout = eventos.find(
    (e) => (e as { event?: string }).event === "extraction_processing_timeout",
  ) as Record<string, unknown> | undefined;

  assert.ok(timeout, "expiracao silenciosa esconderia queda de worker");
  assert.deepEqual(Object.keys(timeout).sort(), ["count", "documentId", "event", "reasonCode"]);
  assert.doesNotMatch(JSON.stringify(Object.values(timeout)), /MARIA|Nome|ALTA/);
});

test("sem expiracao, o request NAO emite log de timeout", async () => {
  seedExtracao({ state: "PROCESSANDO", updatedAt: RECENTE });

  const original = logger.warn.bind(logger);
  const eventos: unknown[] = [];
  (logger as { warn: typeof original }).warn = ((obj: unknown) => {
    eventos.push(obj);
    return undefined;
  }) as typeof original;

  try {
    await requestDocumentExtraction(DOC);
  } finally {
    (logger as { warn: typeof original }).warn = original;
  }

  assert.deepEqual(eventos, [], "sem ruido quando nada expirou");
});

/* -------------------------------------------------- travas estaticas --- */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const REPO = "src/server/repositories/documentExtractionRepository.ts";
const MIGRATION = "prisma/migrations/20260729000000_extraction_single_active/migration.sql";

test("o claim carrega `state` no where — sem isso seria um update disfarcado", () => {
  const code = codeOnly(readFileSync(REPO, "utf8"));
  const claim = code.match(/claimPendingExtraction[\s\S]*?return count === 1;/)?.[0] ?? "";

  assert.match(claim, /updateMany/, "precisa ser updateMany para ter count");
  assert.match(claim, /where: \{ id, state: "PENDENTE" \}/, "id E state");
});

test("todo findLatest pede o desempate", () => {
  const code = codeOnly(readFileSync(REPO, "utf8"));

  assert.match(code, /createdAt: "desc"[\s\S]*?id: "desc"/, "ordem composta declarada");
  const semDesempate = code.match(/orderBy: \{ createdAt: "desc" \}/g) ?? [];
  assert.deepEqual(semDesempate, [], "nenhum orderBy de campo unico sobrou");
});

test("a migration tem fail-fast, indice parcial e indice de latest", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  assert.match(sql, /RAISE EXCEPTION/, "duplicidade ativa aborta a migration");
  assert.doesNotMatch(sql, /UPDATE "document_extractions"\s+SET/i, "nao corrige dados em silencio");
  assert.match(
    sql,
    /CREATE UNIQUE INDEX[\s\S]*?WHERE "state" IN \('PENDENTE', 'PROCESSANDO'\)/,
    "unique parcial",
  );
  assert.match(sql, /"created_at" DESC, "id" DESC/, "indice de latest com desempate");
});

test("a migration avisa que db:push nao preserva o indice parcial", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  assert.match(sql, /db push|db:push/, "o aviso precisa estar onde alguem le");
  assert.match(sql, /db:migrate|db:deploy/, "aponta o caminho correto");
});

test("package.json tem db:migrate e db:deploy", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.equal(pkg.scripts["db:migrate"], "prisma migrate dev");
  assert.equal(pkg.scripts["db:deploy"], "prisma migrate deploy");
  assert.ok(pkg.scripts["db:push"], "db:push permanece — a decisao foi manter");
});

test("o schema avisa sobre o indice que ele nao declara", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /one_active_per_document/, "aponta o indice parcial");
  assert.match(schema, /db push|db:push/, "avisa o risco");
});

test("nenhum service/repositorio manda rodar db:push", () => {
  // `db push` sincroniza o banco COM O SCHEMA, que nao declara o indice unico
  // parcial — rodar aquilo apaga a garantia de "uma tentativa ativa por
  // documento". Uma mensagem de erro que instrui o usuario a executar o comando
  // que enfraquece a propria protecao do service e pior que nao ter mensagem.
  //
  // ESCOPO AMPLIADO: antes este teste cobria so os dois services de extracao e
  // registrava as demais ocorrencias como divida, com o argumento de que "la a
  // orientacao ainda cabe". O argumento estava errado — `db push` derruba o
  // indice do BANCO INTEIRO, nao do service que imprimiu a mensagem. Quem le
  // "rode db:push" no erro de pagamento e obedece apaga a protecao da extracao.
  // A divida foi paga; a regra agora vale para todo `src/server`.
  const alvos = arquivosTs("src/server");
  assert.ok(alvos.length > 0, "varredura nao encontrou arquivo — caminho errado");

  for (const arquivo of alvos) {
    const source = readFileSync(arquivo, "utf8");
    assert.ok(!source.includes("npm run db:push"), `${arquivo}: nao pode mandar rodar db:push`);
  }

  // Os dois services de extracao seguem obrigados a apontar o caminho correto:
  // sao os que dependem diretamente do indice parcial.
  for (const arquivo of [
    "src/server/services/requestDocumentExtraction.ts",
    "src/server/services/runDocumentExtraction.ts",
  ]) {
    const source = readFileSync(arquivo, "utf8");
    assert.match(source, /npm run db:migrate/, `${arquivo}: aponta o fluxo correto`);
  }
});

test("nada aqui liga worker, OCR real, rede, Gov.br/SINARM ou Fase 9", () => {
  for (const arquivo of [
    REPO,
    "src/server/services/requestDocumentExtraction.ts",
    "src/server/services/runDocumentExtraction.ts",
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
    assert.doesNotMatch(code, /setInterval|cron|worker/i, `${arquivo}: sem worker`);
  }
});
