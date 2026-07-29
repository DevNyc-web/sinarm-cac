/**
 * Lote MANUAL de extracao (PR #47D-1).
 *
 * LIMITE HONESTO — LEIA ANTES DE CONFIAR NESTES TESTES: como no #47C-4, a
 * garantia de exclusao mutua mora no POSTGRES, nao aqui. O que estes testes
 * provam e a POLITICA do lote: o que ele seleciona, o que ele recusa, como conta
 * cada desfecho, e o que ele deixa (ou nao) sair em log. O que eles NAO provam e
 * que duas instancias reais nao processam a mesma linha — isso depende do UPDATE
 * condicional no banco, e o CI roda sem banco.
 *
 * Sem OCR, sem rede, sem agendamento, sem Fase 9.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma, type Row } from "../services/testPrisma";
import {
  EXTRACTION_WORKER_BATCH_SIZE,
  EXTRACTION_WORKER_REASON_CODES,
  runExtractionWorkerOnce,
} from "../../../src/server/workers/documentExtractionWorker";
import {
  MOCK_ENGINE_NAME,
  MOCK_ENGINE_VERSION,
  mockExtractionEngine,
} from "../../../src/server/extraction/mockEngine";
import { TERMINAL_EXTRACTION_STATES } from "../../../src/server/services/requestDocumentExtraction";
import { logger } from "../../../src/lib/logger";

let db: FakePrisma = installFakePrisma();

/** Eventos capturados do logger, com o NIVEL em que foram emitidos. */
type EventoCapturado = { level: "info" | "warn"; payload: Record<string, unknown> };
let eventos: EventoCapturado[] = [];

/**
 * Captura de log instalada UMA vez, para o arquivo inteiro.
 *
 * Nao e so conveniencia de assercao: o lote loga em TODO acionamento, entao sem
 * isto cada teste despejaria JSON no terminal e a suite ficaria ilegivel.
 */
const infoOriginal = logger.info.bind(logger);
const warnOriginal = logger.warn.bind(logger);
(logger as { info: typeof infoOriginal }).info = ((obj: unknown) => {
  eventos.push({ level: "info", payload: obj as Record<string, unknown> });
  return undefined;
}) as typeof infoOriginal;
(logger as { warn: typeof warnOriginal }).warn = ((obj: unknown) => {
  eventos.push({ level: "warn", payload: obj as Record<string, unknown> });
  return undefined;
}) as typeof warnOriginal;

/** Eventos do lote, na ordem de emissao. */
function eventosDoLote(): Record<string, unknown>[] {
  return eventos.map((e) => e.payload).filter((p) => String(p.event ?? "").startsWith("worker_"));
}

function eventosDoTipo(tipo: string): Record<string, unknown>[] {
  return eventosDoLote().filter((p) => p.event === tipo);
}

const BASE = new Date("2026-05-01T10:00:00.000Z");
const emMinutos = (minutos: number) => new Date(BASE.getTime() + minutos * 60_000);

/**
 * Cria um documento + UMA tentativa PENDENTE para ele.
 *
 * Um documento por tentativa, sempre: o indice unico parcial do #47C-4 proibe
 * duas ativas no mesmo documento, entao semear varias PENDENTE no mesmo `doc`
 * montaria um cenario que o Postgres recusaria — e o teste passaria descrevendo
 * um estado impossivel.
 */
function seedPendente(sufixo: string, createdAt: Date, over: Row = {}): Row {
  db.processDocument.seed({
    id: `doc-${sufixo}`,
    processId: `proc-${sufixo}`,
    type: "IDENTIFICACAO_PESSOAL",
  });
  return db.documentExtraction.seed({
    id: `ext-${sufixo}`,
    documentId: `doc-${sufixo}`,
    state: "PENDENTE",
    engine: MOCK_ENGINE_NAME,
    engineVersion: MOCK_ENGINE_VERSION,
    createdAt,
    updatedAt: createdAt,
    ...over,
  });
}

/** Espia a engine: conta chamadas e registra a ORDEM dos documentos. */
function espiarEngine() {
  const original = mockExtractionEngine.extract.bind(mockExtractionEngine);
  const documentos: string[] = [];
  (mockExtractionEngine as { extract: typeof original }).extract = async (input) => {
    documentos.push(input.documentId);
    return original(input);
  };
  return {
    documentos,
    get chamadas() {
      return documentos.length;
    },
    restaurar: () => ((mockExtractionEngine as { extract: typeof original }).extract = original),
  };
}

/** Substitui `findMany` do fake e devolve como restaurar. */
function interceptarFila(
  substituto: (original: FakePrisma["documentExtraction"]["findMany"]) => unknown,
): () => void {
  const original = db.documentExtraction.findMany.bind(db.documentExtraction);
  (db.documentExtraction as { findMany: unknown }).findMany = substituto(original);
  return () => ((db.documentExtraction as { findMany: unknown }).findMany = original);
}

beforeEach(() => {
  db = installFakePrisma();
  eventos = [];
});

/* ------------------------------------------------------------- guardas --- */

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ---------------------------------------------------------- lote vazio --- */

test("lote vazio devolve resumo zerado e nao chama a engine", async () => {
  const espiao = espiarEngine();
  try {
    const resumo = await runExtractionWorkerOnce();

    assert.equal(resumo.scanned, 0);
    assert.equal(resumo.processed, 0);
    assert.equal(resumo.skipped, 0);
    assert.equal(resumo.failed, 0);
    assert.equal(typeof resumo.durationMs, "number");
    assert.ok(resumo.durationMs >= 0);
    assert.equal(espiao.chamadas, 0, "fila vazia nao pode acionar a engine");
    assert.deepEqual(eventosDoTipo("worker_completed"), [], "nada foi processado");
  } finally {
    espiao.restaurar();
  }
});

test("batchSize 0 nao consulta o banco", async () => {
  seedPendente("a", BASE);

  let consultas = 0;
  const restaurar = interceptarFila((original) => async (args: Row) => {
    consultas += 1;
    return original(args);
  });

  try {
    const resumo = await runExtractionWorkerOnce(0);

    assert.equal(consultas, 0, "limite nao-positivo nao pode virar ida ao Postgres");
    assert.equal(resumo.scanned, 0);
  } finally {
    restaurar();
  }
});

/* ------------------------------------------------------- ciclo completo --- */

test("pega PENDENTE e processa com a engine mock ate EXTRAIDA", async () => {
  seedPendente("a", BASE);

  const espiao = espiarEngine();
  try {
    const resumo = await runExtractionWorkerOnce();

    assert.equal(resumo.scanned, 1);
    assert.equal(resumo.processed, 1);
    assert.equal(resumo.skipped, 0);
    assert.equal(resumo.failed, 0);
    assert.equal(espiao.chamadas, 1);
    assert.equal(db.documentExtraction.rows[0].state, "EXTRAIDA");
  } finally {
    espiao.restaurar();
  }
});

test("respeita o batchSize: consome o limite e deixa o resto na fila", async () => {
  for (let i = 0; i < EXTRACTION_WORKER_BATCH_SIZE + 3; i += 1) {
    seedPendente(`a${i}`, emMinutos(i));
  }

  const resumo = await runExtractionWorkerOnce();

  assert.equal(resumo.scanned, EXTRACTION_WORKER_BATCH_SIZE);
  assert.equal(resumo.processed, EXTRACTION_WORKER_BATCH_SIZE);

  const restantes = db.documentExtraction.rows.filter((r) => r.state === "PENDENTE");
  assert.equal(restantes.length, 3, "o excedente permanece PENDENTE para o proximo acionamento");
});

test("o fake aplica take: ordena antes de cortar, e sem take devolve tudo", async () => {
  // Ordem de insercao PROPOSITALMENTE diferente da ordem por createdAt: cortar
  // antes de ordenar devolveria "c"/"a" e passaria despercebido.
  seedPendente("c", emMinutos(30));
  seedPendente("a", emMinutos(10));
  seedPendente("b", emMinutos(20));

  const ordem = [{ createdAt: "asc" }, { id: "asc" }];

  const cortadas = await db.documentExtraction.findMany({ orderBy: ordem, take: 2 });
  assert.deepEqual(
    cortadas.map((r) => r.id),
    ["ext-a", "ext-b"],
    "take corta DEPOIS de ordenar",
  );

  const todas = await db.documentExtraction.findMany({ orderBy: ordem });
  assert.equal(todas.length, 3, "sem take, nada e cortado");

  const excedente = await db.documentExtraction.findMany({ orderBy: ordem, take: 99 });
  assert.equal(excedente.length, 3, "take maior que a tabela nao inventa linha");

  await assert.rejects(
    () => db.documentExtraction.findMany({ skip: 1 } as never),
    /argumento nao suportado/,
    "argumento ignorado em silencio foi o defeito que originou esta trava",
  );
});

test("processa em FIFO: createdAt asc, com desempate por id asc", async () => {
  seedPendente("c", emMinutos(30));
  seedPendente("a", emMinutos(10));
  // Empate de milissegundo com "a": so o desempate por id define quem vem antes.
  seedPendente("b", emMinutos(10));

  const espiao = espiarEngine();
  try {
    await runExtractionWorkerOnce();

    assert.deepEqual(
      espiao.documentos,
      ["doc-a", "doc-b", "doc-c"],
      "a que esperou mais e processada primeiro",
    );
  } finally {
    espiao.restaurar();
  }
});

/* -------------------------------------------------- o que NAO e elegivel --- */

test("nao seleciona PROCESSANDO, por mais antiga que seja", async () => {
  seedPendente("a", emMinutos(-600), { state: "PROCESSANDO" });

  const espiao = espiarEngine();
  try {
    const resumo = await runExtractionWorkerOnce();

    assert.equal(resumo.scanned, 0, "quem ja esta em execucao nao volta para a fila");
    assert.equal(espiao.chamadas, 0);
    assert.equal(db.documentExtraction.rows[0].state, "PROCESSANDO", "intacta");
  } finally {
    espiao.restaurar();
  }
});

test("nao seleciona nenhum estado terminal", async () => {
  for (const terminal of TERMINAL_EXTRACTION_STATES) {
    db = installFakePrisma();
    seedPendente("a", BASE, { state: terminal });

    const espiao = espiarEngine();
    try {
      const resumo = await runExtractionWorkerOnce();

      assert.equal(resumo.scanned, 0, `${terminal}: terminal nao volta para a fila`);
      assert.equal(espiao.chamadas, 0, `${terminal}: engine nao pode ser chamada`);
    } finally {
      espiao.restaurar();
    }
  }
});

/* ------------------------------------------------------- claim perdido --- */

/**
 * Simula a corrida real: entre a leitura da fila e a reserva, outro chamador
 * venceu e a linha ja nao esta mais PENDENTE.
 */
function fazerPerderClaim(): () => void {
  return interceptarFila((original) => async (args: Row) => {
    const rows = await original(args);
    for (const row of db.documentExtraction.rows) {
      if (row.state === "PENDENTE") row.state = "PROCESSANDO";
    }
    return rows;
  });
}

test("claim perdido NAO chama a engine", async () => {
  seedPendente("a", BASE);

  const restaurar = fazerPerderClaim();
  const espiao = espiarEngine();
  try {
    await runExtractionWorkerOnce();

    assert.equal(espiao.chamadas, 0, "engine rodando duas vezes e o defeito que a reserva evita");
  } finally {
    espiao.restaurar();
    restaurar();
  }
});

test("claim perdido conta em skipped, nunca em failed", async () => {
  seedPendente("a", BASE);

  const restaurar = fazerPerderClaim();
  try {
    const resumo = await runExtractionWorkerOnce();

    assert.equal(resumo.scanned, 1);
    assert.equal(resumo.skipped, 1);
    assert.equal(resumo.failed, 0, "perder a corrida e o desenho funcionando, nao falha");
    assert.equal(resumo.processed, 0);

    const [evento] = eventosDoTipo("worker_skipped_claim_lost");
    assert.ok(evento, "silenciar o desvio esconderia contencao real");
    assert.equal(evento.reasonCode, "CLAIM_PERDIDO");
  } finally {
    restaurar();
  }
});

/* -------------------------------------------------------- falhas --- */

test("falha da engine marca FALHOU e o lote CONTINUA", async () => {
  seedPendente("a", emMinutos(10));
  seedPendente("b", emMinutos(20));

  const original = mockExtractionEngine.extract.bind(mockExtractionEngine);
  (mockExtractionEngine as { extract: typeof original }).extract = async (input) =>
    input.documentId === "doc-a"
      ? { ok: false as const, failureReason: "ARQUIVO_ILEGIVEL" as const }
      : original(input);

  try {
    const resumo = await runExtractionWorkerOnce();

    assert.equal(resumo.processed, 2, "engine que roda e da veredito e trabalho FEITO");
    assert.equal(
      resumo.failed,
      0,
      "documento ilegivel e resultado legitimo — contar como failed apontaria o alarme para o lado errado",
    );

    const a = db.documentExtraction.rows.find((r) => r.id === "ext-a");
    const b = db.documentExtraction.rows.find((r) => r.id === "ext-b");
    assert.equal(a?.state, "FALHOU");
    assert.equal(a?.failureReason, "ARQUIVO_ILEGIVEL");
    assert.equal(b?.state, "EXTRAIDA", "a falha da primeira nao pode contaminar a seguinte");
  } finally {
    (mockExtractionEngine as { extract: typeof original }).extract = original;
  }
});

test("execucao com ok:false conta em failed e o lote segue", async () => {
  // Tentativa apontando para documento inexistente: `runDocumentExtraction`
  // devolve `ok: false` sem tocar na engine.
  db.documentExtraction.seed({
    id: "ext-fantasma",
    documentId: "doc-inexistente",
    state: "PENDENTE",
    engine: MOCK_ENGINE_NAME,
    engineVersion: MOCK_ENGINE_VERSION,
    createdAt: emMinutos(5),
    updatedAt: emMinutos(5),
  });
  seedPendente("b", emMinutos(20));

  const resumo = await runExtractionWorkerOnce();

  assert.equal(resumo.scanned, 2);
  assert.equal(resumo.failed, 1);
  assert.equal(resumo.processed, 1, "um item sem veredito nao pode derrubar o lote");
  assert.equal(db.documentExtraction.rows.find((r) => r.id === "ext-b")?.state, "EXTRAIDA");

  const [falha] = eventosDoTipo("worker_failed");
  assert.equal(falha.reasonCode, "EXECUCAO_FALHOU");
  assert.equal(falha.documentId, "doc-inexistente");
});

test("falha ao LER a fila nao lanca: devolve zeros e loga worker_failed", async () => {
  seedPendente("a", BASE);

  const restaurar = interceptarFila(() => async () => {
    throw Object.assign(new Error("Unique constraint failed on the fields: (`document_id`)"), {
      code: "P2002",
      meta: { target: ["document_id"] },
    });
  });

  try {
    const resumo = await runExtractionWorkerOnce();

    assert.deepEqual(
      { ...resumo, durationMs: 0 },
      { scanned: 0, processed: 0, skipped: 0, failed: 0, durationMs: 0 },
      "sem fila lida nao ha item a que atribuir contagem",
    );

    const [falha] = eventosDoTipo("worker_failed");
    assert.ok(falha, "fila ilegivel em silencio pareceria fila vazia");
    assert.equal(falha.reasonCode, "ERRO_INTERNO");
    assert.equal(falha.documentId, undefined, "nao ha documento a que atribuir a falha do lote");
    assert.doesNotMatch(
      JSON.stringify(falha),
      /P2002|constraint|document_id|prisma/i,
      "erro bruto do banco nao pode chegar ao log",
    );
  } finally {
    restaurar();
  }
});

/* ------------------------------------------------------------ PII --- */

test("o resumo nao carrega fields nem PII", async () => {
  seedPendente("a", BASE);

  const resumo = await runExtractionWorkerOnce();

  assert.deepEqual(Object.keys(resumo).sort(), [
    "durationMs",
    "failed",
    "processed",
    "scanned",
    "skipped",
  ]);
  // A linha processada TEM os campos do mock gravados; o resumo nao pode ve-los.
  assert.ok(db.documentExtraction.rows[0].fields, "a engine gravou campos na linha");
  assert.doesNotMatch(JSON.stringify(resumo), /MARIA|000\.000|fict|exemplo|ALTA|MEDIA/i);
});

/** Formatos aceitos por evento — `worker_failed` tem duas formas legitimas. */
const CHAVES_POR_EVENTO: Record<string, { level: "info" | "warn"; formas: string[][] }> = {
  worker_started: { level: "info", formas: [["batchSize", "event"]] },
  worker_completed: {
    level: "info",
    formas: [["documentId", "durationMs", "event", "extractionId", "state"]],
  },
  worker_skipped_claim_lost: {
    level: "info",
    formas: [["documentId", "event", "reasonCode"]],
  },
  worker_failed: {
    level: "warn",
    formas: [
      ["documentId", "durationMs", "event", "reasonCode"],
      // Falha do LOTE (fila ilegivel): nao ha documento a que atribuir.
      ["durationMs", "event", "reasonCode"],
    ],
  },
  worker_batch_completed: {
    level: "info",
    formas: [["batchSize", "count", "durationMs", "event"]],
  },
};

/** Unica lista de chaves que pode sair no log deste lote. */
const PAYLOAD_PERMITIDO = [
  "event",
  "extractionId",
  "documentId",
  "state",
  "reasonCode",
  "count",
  "batchSize",
  "durationMs",
];

test("cada evento usa a allowlist EXATA de chaves, no nivel certo", async () => {
  // Tres cenarios num teste so, para cobrir os cinco eventos.
  seedPendente("a", BASE);
  await runExtractionWorkerOnce();

  db = installFakePrisma();
  seedPendente("b", BASE);
  const restaurarClaim = fazerPerderClaim();
  await runExtractionWorkerOnce();
  restaurarClaim();

  db = installFakePrisma();
  seedPendente("c", BASE);
  const restaurarFila = interceptarFila(() => async () => {
    throw new Error("indisponivel");
  });
  await runExtractionWorkerOnce();
  restaurarFila();

  const tipos = new Set(eventosDoLote().map((p) => String(p.event)));
  assert.deepEqual(
    [...tipos].sort(),
    [
      "worker_batch_completed",
      "worker_completed",
      "worker_failed",
      "worker_skipped_claim_lost",
      "worker_started",
    ],
    "os cinco eventos aprovados, e nenhum a mais",
  );

  for (const { level, payload } of eventos) {
    const nome = String(payload.event ?? "");
    if (!nome.startsWith("worker_")) continue;

    const esperado = CHAVES_POR_EVENTO[nome];
    assert.ok(esperado, `evento nao previsto: ${nome}`);
    assert.equal(level, esperado.level, `${nome}: nivel errado`);

    const chaves = Object.keys(payload).sort();
    assert.ok(
      esperado.formas.some(
        (forma) => forma.length === chaves.length && forma.every((k, i) => k === chaves[i]),
      ),
      `${nome}: chaves ${JSON.stringify(chaves)} fora do formato aprovado`,
    );
    for (const chave of chaves) {
      assert.ok(PAYLOAD_PERMITIDO.includes(chave), `${nome}: chave proibida \`${chave}\``);
    }
  }
});

test("nenhum log carrega PII", async () => {
  seedPendente("a", BASE);

  await runExtractionWorkerOnce();

  const serializado = JSON.stringify(eventosDoLote());
  assert.doesNotMatch(
    serializado,
    /MARIA|000\.000|00\.000\.000|fict|exemplo|ALTA|MEDIA|BAIXA/i,
    "conteudo de documento nunca pode chegar ao log",
  );
  for (const proibida of [
    "fields",
    "key",
    "label",
    "value",
    "confidence",
    "rawOcrText",
    "storageKey",
    "filename",
  ]) {
    for (const payload of eventosDoLote()) {
      assert.ok(!(proibida in payload), `chave proibida no log: ${proibida}`);
    }
  }
});

test("o extractionId logado vem da EXECUCAO, nunca do item da fila", async () => {
  seedPendente("a", emMinutos(10));

  // Entre a leitura da fila e a reserva, a tentativa lida termina e outra nasce
  // no mesmo documento. Quem executa resolve a MAIS RECENTE — o log tem de
  // descrever a que realmente rodou.
  const restaurar = interceptarFila((original) => async (args: Row) => {
    const rows = await original(args);
    const antiga = db.documentExtraction.rows.find((r) => r.id === "ext-a");
    if (antiga && antiga.state === "PENDENTE") {
      antiga.state = "FALHOU";
      db.documentExtraction.seed({
        id: "ext-nova",
        documentId: "doc-a",
        state: "PENDENTE",
        engine: MOCK_ENGINE_NAME,
        engineVersion: MOCK_ENGINE_VERSION,
        createdAt: emMinutos(90),
        updatedAt: emMinutos(90),
      });
    }
    return rows;
  });

  try {
    await runExtractionWorkerOnce();

    const [concluido] = eventosDoTipo("worker_completed");
    assert.ok(concluido, "algo foi processado");
    assert.equal(concluido.extractionId, "ext-nova", "o id tem de ser o da tentativa executada");
    assert.notEqual(
      concluido.extractionId,
      "ext-a",
      "logar o id da fila descreveria o que nao rodou",
    );
  } finally {
    restaurar();
  }
});

/* -------------------------------------------------- travas estaticas --- */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const WORKER = "src/server/workers/documentExtractionWorker.ts";
const REPO = "src/server/repositories/documentExtractionRepository.ts";

test("o lote NAO reserva por conta propria — quem decide o claim e quem executa", () => {
  const code = codeOnly(readFileSync(WORKER, "utf8"));

  assert.doesNotMatch(code, /claimPendingExtraction/, "duas versoes da mesma regra divergem");
  assert.match(code, /runDocumentExtraction\(/, "a execucao continua sendo delegada");
});

test("a fila NAO seleciona fields", () => {
  const code = codeOnly(readFileSync(REPO, "utf8"));
  const fila = code.match(/export function listPendingExtractions[\s\S]*?\n}/)?.[0] ?? "";

  assert.ok(fila, "a funcao de fila precisa existir");
  assert.match(fila, /select: \{ id: true, documentId: true \}/, "o select E o gate de PII");
  assert.doesNotMatch(fila, /fields|confidence|engine:|storageKey/, "nada sensivel sai da tabela");
  assert.match(fila, /take: limit/, "o corte acontece no banco, nao em memoria");
});

test("todo catch do lote e SEM binding — erro bruto nao existe como variavel", () => {
  const code = codeOnly(readFileSync(WORKER, "utf8"));

  assert.doesNotMatch(
    code,
    /catch\s*\(/,
    "capturar o erro numa variavel torna possivel registra-lo por descuido",
  );
  // Dois: a leitura da fila e a rede de seguranca por item. O segundo e
  // inalcancavel hoje (runDocumentExtraction nunca lanca) — por isso a trava
  // dele e ESTATICA, e nao um teste de comportamento que nao existiria.
  assert.equal((code.match(/\} catch \{/g) ?? []).length, 2, "fila + item");
});

test("os codigos de motivo sao um conjunto FECHADO, sem texto livre", () => {
  assert.deepEqual(
    [...EXTRACTION_WORKER_REASON_CODES],
    ["CLAIM_PERDIDO", "EXECUCAO_FALHOU", "ERRO_INTERNO"],
  );
});

test("o lote nao faz rede, OCR real, storage, Gov.br/SINARM/PF nem Fase 9", () => {
  const code = codeOnly(readFileSync(WORKER, "utf8"));

  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
  assert.doesNotMatch(code, /\b(tesseract|openai|anthropic|textract|rekognition)/i, "sem OCR/IA");
  assert.doesNotMatch(code, /gov\.?br|sinarm|policia federal/i, "sem Gov.br/SINARM/PF");
  assert.doesNotMatch(code, /phase9|PHASE9/i, "sem Fase 9");
  assert.doesNotMatch(code, /storageKey|getStorageAdapter|readFile/, "sem storage e sem arquivo");
  assert.doesNotMatch(code, /getEnv|process\.env/, "sem variavel de ambiente nesta fase");
});

test("o lote nao agenda nada: sem setInterval, sem cron, sem schedule", () => {
  const code = codeOnly(readFileSync(WORKER, "utf8"));

  assert.doesNotMatch(code, /setInterval|setTimeout|cron|schedule/i, "o acionamento e manual");
});

function arquivosDe(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return arquivosDe(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * UNICO acionador manual/admin aprovado (#47D-3A).
 *
 * A varredura abaixo existe para impedir que extracao entre no caminho de
 * RENDER. Uma server action nao e render: e handler de POST, protegido por
 * `requirePermission("extraction.run")`. Por isso a isencao e por NOME, e nao um
 * afrouxamento de categoria — nao vale "todo .ts de src/app", nao vale a pasta.
 * Qualquer outro arquivo, inclusive o `page.tsx` vizinho, continua bloqueado.
 */
const ACIONADOR_MANUAL = "src/app/(admin)/admin/extracao/actions.ts";

test("o arquivo isentado existe — isencao orfa vira buraco silencioso", () => {
  // Se o acionador for renomeado ou removido, a isencao passaria a nao proteger
  // nada e ninguem perceberia: a varredura seguiria verde por acidente.
  assert.ok(
    existsSync(ACIONADOR_MANUAL),
    `${ACIONADOR_MANUAL} nao existe — remova a isencao ou corrija o caminho`,
  );
});

test("so o acionador manual importa o lote; o resto de src/app segue bloqueado", () => {
  const proibidos = [...arquivosDe("src/app"), ...arquivosDe("src/components")]
    .filter((file) => file !== ACIONADOR_MANUAL)
    .filter((file) => /documentExtractionWorker|runExtractionWorkerOnce/.test(readFileSync(file, "utf8")));

  assert.deepEqual(proibidos, [], `extracao em lote nao entra no render: ${proibidos.join(", ")}`);
});

test("a isencao vale para UM caminho exato, nao para a pasta", () => {
  // Trava contra a evolucao previsivel: transformar a isencao em prefixo
  // (`startsWith`) liberaria o `page.tsx` vizinho junto, que e justamente o
  // arquivo de render que a varredura precisa continuar pegando.
  const vizinho = "src/app/(admin)/admin/extracao/page.tsx";
  assert.ok(existsSync(vizinho), "a pagina do painel precisa existir");
  assert.notEqual(vizinho, ACIONADOR_MANUAL);
  assert.doesNotMatch(
    readFileSync(vizinho, "utf8"),
    /documentExtractionWorker|runExtractionWorkerOnce/,
    "a pagina chama a action, nunca o lote",
  );
});

test("package.json roda este arquivo em test:documents:unit", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.match(
    pkg.scripts["test:documents:unit"],
    /tests\/unit\/documents\/documentExtractionWorker\.test\.ts/,
    "teste que nao esta no script nunca roda",
  );
});
