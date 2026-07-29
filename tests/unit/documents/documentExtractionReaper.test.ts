/**
 * Varredura global de PROCESSANDO abandonadas (PR #47D-2).
 *
 * LIMITE HONESTO: como no #47C-4 e no #47D-1, a atomicidade real do UPDATE e a
 * existencia dos indices vivem no POSTGRES, e o CI roda sem banco. O que estes
 * testes provam e a POLITICA — o que a varredura toca, o que ela recusa, o que
 * ela devolve e o que sai (ou nao) em log. O que eles NAO provam e o desempenho
 * dos indices nem o comportamento sob concorrencia real; isso exige verificacao
 * manual, registrada no PR.
 *
 * Sem OCR, sem rede, sem agendamento, sem Fase 9.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import { installFakePrisma, prismaIsFake, type FakePrisma, type Row } from "../services/testPrisma";
import { runExtractionReaperOnce } from "../../../src/server/workers/documentExtractionReaper";
import { failStaleProcessingExtractionsEverywhere } from "../../../src/server/repositories/documentExtractionRepository";
import {
  PROCESSING_TIMEOUT_MS,
  TERMINAL_EXTRACTION_STATES,
} from "../../../src/server/services/requestDocumentExtraction";
import { EXTRACTION_FAILURE_REASONS } from "../../../src/server/documents/documentExtractionTypes";
import {
  MOCK_ENGINE_NAME,
  MOCK_ENGINE_VERSION,
  mockExtractionEngine,
} from "../../../src/server/extraction/mockEngine";
import { logger } from "../../../src/lib/logger";

let db: FakePrisma = installFakePrisma();

type EventoCapturado = { level: "info" | "warn"; payload: Record<string, unknown> };
let eventos: EventoCapturado[] = [];

/** Captura de log para o arquivo inteiro — tambem evita despejar JSON na suite. */
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

function eventosDaVarredura(): Record<string, unknown>[] {
  return eventos
    .map((e) => e.payload)
    .filter((p) => String(p.event ?? "").startsWith("extraction_processing_reap"));
}

const AGORA = Date.now();
/** Passou do limite com folga — deve ser encerrada. */
const VELHO = new Date(AGORA - PROCESSING_TIMEOUT_MS - 60_000);
/** Dentro do limite — trabalho vivo. */
const RECENTE = new Date(AGORA - 60_000);
const CUTOFF = new Date(AGORA - PROCESSING_TIMEOUT_MS);

/** Cria um documento e uma tentativa para ele. Um documento por tentativa. */
function seedTentativa(sufixo: string, over: Row = {}): Row {
  db.processDocument.seed({
    id: `doc-${sufixo}`,
    processId: `proc-${sufixo}`,
    type: "IDENTIFICACAO_PESSOAL",
  });
  return db.documentExtraction.seed({
    id: `ext-${sufixo}`,
    documentId: `doc-${sufixo}`,
    state: "PROCESSANDO",
    engine: MOCK_ENGINE_NAME,
    engineVersion: MOCK_ENGINE_VERSION,
    createdAt: VELHO,
    updatedAt: VELHO,
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
  eventos = [];
});

/* ------------------------------------------------------------- guardas --- */

test("o fake esta instalado — nenhum PrismaClient real foi construido", () => {
  assert.ok(prismaIsFake());
});

/* ------------------------------------------------- o que a varredura toca --- */

test("expira PROCESSANDO antiga em VARIOS documentos de uma vez", async () => {
  seedTentativa("a");
  seedTentativa("b");
  seedTentativa("c");

  const encerradas = await failStaleProcessingExtractionsEverywhere(CUTOFF);

  assert.equal(encerradas, 3, "a varredura global nao para no primeiro documento");
  for (const linha of db.documentExtraction.rows) {
    assert.equal(linha.state, "FALHOU");
    assert.equal(linha.failureReason, "TIMEOUT");
  }
});

test("preserva PROCESSANDO recente — o relogio e updatedAt, nao createdAt", async () => {
  // Pedida ha muito tempo, mas o processamento COMECOU agora: trabalho vivo.
  seedTentativa("viva", { createdAt: VELHO, updatedAt: RECENTE });

  assert.equal(await failStaleProcessingExtractionsEverywhere(CUTOFF), 0);
  assert.equal(db.documentExtraction.rows[0].state, "PROCESSANDO");
});

test("preserva PENDENTE, por mais antiga que seja", async () => {
  seedTentativa("pendente", { state: "PENDENTE" });

  assert.equal(await failStaleProcessingExtractionsEverywhere(CUTOFF), 0);
  assert.equal(db.documentExtraction.rows[0].state, "PENDENTE");
});

test("preserva cada estado TERMINAL", async () => {
  // EXTRAIDA, PRECISA_REVISAO, CONFIRMADA e FALHOU — nao existe CANCELADA.
  for (const terminal of TERMINAL_EXTRACTION_STATES) {
    db = installFakePrisma();
    seedTentativa("t", { state: terminal });

    assert.equal(await failStaleProcessingExtractionsEverywhere(CUTOFF), 0, `${terminal}`);
    assert.equal(db.documentExtraction.rows[0].state, terminal, `${terminal} intacto`);
  }
});

test("nao toca documento nenhum quando so ha PROCESSANDO recente e terminais", async () => {
  seedTentativa("viva", { updatedAt: RECENTE });
  seedTentativa("pronta", { state: "EXTRAIDA" });
  seedTentativa("pendente", { state: "PENDENTE" });

  assert.equal(await failStaleProcessingExtractionsEverywhere(CUTOFF), 0);
});

test("e idempotente — a segunda passada encontra 0", async () => {
  seedTentativa("a");

  assert.equal(await failStaleProcessingExtractionsEverywhere(CUTOFF), 1);
  assert.equal(await failStaleProcessingExtractionsEverywhere(CUTOFF), 0);
});

test("devolve CONTAGEM, nunca linhas nem PII", async () => {
  seedTentativa("a", {
    fields: [{ key: "cpf", label: "CPF", value: "000.000.000-00", confidence: "ALTA" }],
  });

  const resultado = await failStaleProcessingExtractionsEverywhere(CUTOFF);

  assert.equal(typeof resultado, "number", "quem limpa nao recebe a linha de volta");
  assert.doesNotMatch(JSON.stringify(resultado), /cpf|000\.000|ALTA/);
});

test("o motivo gravado e um codigo FECHADO do dominio", async () => {
  seedTentativa("a");
  await failStaleProcessingExtractionsEverywhere(CUTOFF);

  assert.ok(
    (EXTRACTION_FAILURE_REASONS as readonly string[]).includes(
      String(db.documentExtraction.rows[0].failureReason),
    ),
    "nunca texto livre",
  );
});

/* ------------------------------------------------------------- wrapper --- */

test("o wrapper usa PROCESSING_TIMEOUT_MS: encerra logo acima do limite e preserva logo abaixo", async () => {
  seedTentativa("passou", { updatedAt: new Date(Date.now() - PROCESSING_TIMEOUT_MS - 1_000) });
  seedTentativa("dentro", { updatedAt: new Date(Date.now() - PROCESSING_TIMEOUT_MS + 60_000) });

  const resumo = await runExtractionReaperOnce();

  assert.equal(resumo.reaped, 1, "o corte e exatamente a constante compartilhada");
  assert.equal(db.documentExtraction.rows.find((r) => r.id === "ext-passou")?.state, "FALHOU");
  assert.equal(db.documentExtraction.rows.find((r) => r.id === "ext-dentro")?.state, "PROCESSANDO");
});

test("o resumo traz reaped e durationMs, e mais nada", async () => {
  seedTentativa("a");

  const resumo = await runExtractionReaperOnce();

  assert.deepEqual(Object.keys(resumo).sort(), ["durationMs", "reaped"]);
  assert.equal(typeof resumo.durationMs, "number");
  assert.ok(resumo.durationMs >= 0);
});

test("o wrapper loga warn quando encerrou alguma coisa", async () => {
  seedTentativa("a");

  await runExtractionReaperOnce();

  const [evento] = eventosDaVarredura();
  assert.ok(evento, "expiracao silenciosa esconderia queda de processamento");
  assert.equal(evento.event, "extraction_processing_reaped");
  assert.equal(evento.count, 1);
  assert.equal(evento.reasonCode, "TIMEOUT");
  assert.equal(eventos[0].level, "warn");
});

test("o wrapper fica SILENCIOSO quando nada expirou", async () => {
  seedTentativa("viva", { updatedAt: RECENTE });

  const resumo = await runExtractionReaperOnce();

  assert.equal(resumo.reaped, 0);
  assert.deepEqual(eventosDaVarredura(), [], "sem ruido quando nao havia o que fazer");
});

test("falha de banco NAO lanca, devolve zero e loga evento PROPRIO de falha", async () => {
  seedTentativa("a");

  const original = db.documentExtraction.updateMany.bind(db.documentExtraction);
  (db.documentExtraction as { updateMany: unknown }).updateMany = async () => {
    throw Object.assign(new Error("Unique constraint failed on the fields: (`document_id`)"), {
      code: "P2002",
      meta: { target: ["document_id"] },
    });
  };

  try {
    const resumo = await runExtractionReaperOnce();

    assert.equal(resumo.reaped, 0, "nada foi encerrado, e isso e verdade");
    assert.equal(typeof resumo.durationMs, "number");

    const [falha] = eventosDaVarredura();
    assert.ok(falha, "falha de infraestrutura em silencio e indistinguivel de tabela limpa");
    assert.equal(
      falha.event,
      "extraction_processing_reap_failed",
      "usar o evento de sucesso com contagem zero faria o log mentir",
    );
    assert.equal(falha.reasonCode, "ERRO_INTERNO");
    assert.doesNotMatch(
      JSON.stringify(falha),
      /P2002|constraint|document_id|prisma/i,
      "erro bruto do banco nao pode chegar ao log",
    );
  } finally {
    (db.documentExtraction as { updateMany: unknown }).updateMany = original;
  }
});

test("a varredura NAO chama a engine", async () => {
  seedTentativa("a");

  const espiao = espiarEngine();
  try {
    await runExtractionReaperOnce();
    assert.equal(espiao.chamadas, 0, "encerrar por timeout nao processa nada");
  } finally {
    espiao.restaurar();
  }
});

/* ----------------------------------------------------------------- log --- */

/** Formatos aceitos por evento. */
const CHAVES_POR_EVENTO: Record<string, string[]> = {
  extraction_processing_reaped: ["count", "cutoffIso", "durationMs", "event", "reasonCode"],
  extraction_processing_reap_failed: ["durationMs", "event", "reasonCode"],
};

const PAYLOAD_PERMITIDO = ["event", "count", "reasonCode", "cutoffIso", "durationMs"];

test("cada evento usa a allowlist EXATA de chaves, sempre em warn", async () => {
  seedTentativa("a");
  await runExtractionReaperOnce();

  db = installFakePrisma();
  seedTentativa("b");
  const original = db.documentExtraction.updateMany.bind(db.documentExtraction);
  (db.documentExtraction as { updateMany: unknown }).updateMany = async () => {
    throw new Error("indisponivel");
  };
  await runExtractionReaperOnce();
  (db.documentExtraction as { updateMany: unknown }).updateMany = original;

  const tipos = new Set(eventosDaVarredura().map((p) => String(p.event)));
  assert.deepEqual(
    [...tipos].sort(),
    ["extraction_processing_reap_failed", "extraction_processing_reaped"],
    "os dois eventos aprovados, e nenhum a mais",
  );

  for (const { level, payload } of eventos) {
    const nome = String(payload.event ?? "");
    if (!nome.startsWith("extraction_processing_reap")) continue;

    assert.equal(level, "warn", `${nome}: expiracao e sintoma, nao rotina`);

    const esperado = CHAVES_POR_EVENTO[nome];
    assert.ok(esperado, `evento nao previsto: ${nome}`);
    assert.deepEqual(Object.keys(payload).sort(), esperado, `${nome}: chaves fora do formato`);
    for (const chave of Object.keys(payload)) {
      assert.ok(PAYLOAD_PERMITIDO.includes(chave), `${nome}: chave proibida \`${chave}\``);
    }
  }
});

test("nenhum log carrega PII, documentId ou extractionId", async () => {
  seedTentativa("a", {
    fields: [{ key: "nome", label: "Nome", value: "MARIA DA SILVA", confidence: "ALTA" }],
  });

  await runExtractionReaperOnce();

  const serializado = JSON.stringify(eventosDaVarredura());
  assert.doesNotMatch(serializado, /MARIA|SILVA|ALTA|doc-a|ext-a/i);
  for (const proibida of [
    "documentId",
    "extractionId",
    "fields",
    "key",
    "label",
    "value",
    "confidence",
    "rawOcrText",
    "storageKey",
    "filename",
  ]) {
    for (const payload of eventosDaVarredura()) {
      assert.ok(!(proibida in payload), `chave proibida no log: ${proibida}`);
    }
  }
});

test("o cutoffIso registrado e o limiar realmente usado", async () => {
  seedTentativa("a");

  const antes = Date.now();
  await runExtractionReaperOnce();
  const depois = Date.now();

  const [evento] = eventosDaVarredura();
  const cutoff = new Date(String(evento.cutoffIso)).getTime();

  assert.ok(
    cutoff >= antes - PROCESSING_TIMEOUT_MS - 5_000 && cutoff <= depois - PROCESSING_TIMEOUT_MS + 5_000,
    "sem o limiar, um reap em massa nao se distingue de constante ou relogio errados",
  );
});

/* -------------------------------------------------- travas estaticas --- */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const REAPER = "src/server/workers/documentExtractionReaper.ts";
const REPO = "src/server/repositories/documentExtractionRepository.ts";
const MIGRATIONS_DIR = "prisma/migrations";
const INDICE_PARCIAL = "document_extractions_one_active_per_document";

test("a varredura global NAO filtra por documentId", () => {
  const code = codeOnly(readFileSync(REPO, "utf8"));
  const global =
    code.match(/export async function failStaleProcessingExtractionsEverywhere[\s\S]*?\n}/)?.[0] ??
    "";

  assert.ok(global, "a funcao global precisa existir");
  assert.doesNotMatch(global, /documentId/, "escopo global nao recebe nem filtra documento");
  assert.match(global, /state: "PROCESSANDO"/, "so PROCESSANDO");
  assert.match(global, /updatedAt: \{ lt: cutoff \}/, "o relogio e updatedAt");
});

test("o reap POR DOCUMENTO continua escopado — a funcao global nao o afrouxou", () => {
  const code = codeOnly(readFileSync(REPO, "utf8"));
  const local =
    code.match(/export async function failStaleProcessingExtractions\([\s\S]*?\n}/)?.[0] ?? "";

  assert.ok(local, "a funcao por documento continua existindo");
  assert.match(local, /where: \{ documentId, state: "PROCESSANDO"/, "documentId no where");
});

test("todo catch do wrapper e SEM binding — erro bruto nao existe como variavel", () => {
  const code = codeOnly(readFileSync(REAPER, "utf8"));

  assert.doesNotMatch(code, /catch\s*\(/, "capturar em variavel torna possivel registrar por descuido");
  assert.equal((code.match(/\} catch \{/g) ?? []).length, 1);
});

test("todo ponto de log do wrapper passa por satisfies ReaperLogPayload", () => {
  const code = codeOnly(readFileSync(REAPER, "utf8"));

  const sitios = (code.match(/logger\.(info|warn)\(/g) ?? []).length;
  const tipados = (code.match(/satisfies ReaperLogPayload/g) ?? []).length;
  assert.equal(sitios, tipados, "log sem o tipo escaparia da allowlist do compilador");
  assert.equal(sitios, 2, "sucesso e falha");
});

test("o wrapper nao cria constante propria de timeout", () => {
  const code = codeOnly(readFileSync(REAPER, "utf8"));

  assert.match(code, /PROCESSING_TIMEOUT_MS/, "reusa a constante existente");
  assert.doesNotMatch(code, /\d+\s*\*\s*60\s*\*\s*1000/, "um segundo timeout divergiria em silencio");
});

test("a varredura nao faz rede, OCR real, storage, Gov.br/SINARM/PF nem Fase 9", () => {
  const code = codeOnly(readFileSync(REAPER, "utf8"));

  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
  assert.doesNotMatch(code, /\b(tesseract|openai|anthropic|textract|rekognition)/i, "sem OCR/IA");
  assert.doesNotMatch(code, /gov\.?br|sinarm|policia federal/i, "sem Gov.br/SINARM/PF");
  assert.doesNotMatch(code, /phase9|PHASE9/i, "sem Fase 9");
  assert.doesNotMatch(code, /storageKey|getStorageAdapter|readFile/, "sem storage e sem arquivo");
  assert.doesNotMatch(code, /getEnv|process\.env/, "sem variavel de ambiente");
});

test("a varredura nao agenda nada: sem setInterval, cron ou schedule", () => {
  const code = codeOnly(readFileSync(REAPER, "utf8"));
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
 * Mesma politica da trava do lote: a varredura protege o caminho de RENDER, e
 * uma server action nao e render. Isencao por NOME, nunca por pasta ou extensao
 * — o `page.tsx` vizinho continua bloqueado.
 */
const ACIONADOR_MANUAL = "src/app/(admin)/admin/extracao/actions.ts";

test("o arquivo isentado existe — isencao orfa vira buraco silencioso", () => {
  assert.ok(
    existsSync(ACIONADOR_MANUAL),
    `${ACIONADOR_MANUAL} nao existe — remova a isencao ou corrija o caminho`,
  );
});

test("so o acionador manual importa a varredura; o resto de src/app segue bloqueado", () => {
  const proibidos = [...arquivosDe("src/app"), ...arquivosDe("src/components")]
    .filter((file) => file !== ACIONADOR_MANUAL)
    .filter((file) => /documentExtractionReaper|runExtractionReaperOnce/.test(readFileSync(file, "utf8")));

  assert.deepEqual(proibidos, [], `manutencao nao entra no render: ${proibidos.join(", ")}`);
});

test("a isencao vale para UM caminho exato, nao para a pasta", () => {
  const vizinho = "src/app/(admin)/admin/extracao/page.tsx";
  assert.ok(existsSync(vizinho), "a pagina do painel precisa existir");
  assert.doesNotMatch(
    readFileSync(vizinho, "utf8"),
    /documentExtractionReaper|runExtractionReaperOnce/,
    "a pagina chama a action, nunca a varredura",
  );
});

/* ------------------------------------------------------------ migration --- */

/**
 * SQL sem os comentarios `--`.
 *
 * Necessario de verdade: o cabecalho desta migration EXPLICA por que
 * `CONCURRENTLY` nao e usado, entao procurar a palavra no arquivo cru acusaria o
 * proprio aviso. O que se quer proibir e a INSTRUCAO, nao a mencao — mesma
 * distincao que `codeOnly` faz nos arquivos TypeScript.
 */
function sqlOnly(source: string): string {
  return source
    .split("\n")
    .filter((linha) => !linha.trimStart().startsWith("--"))
    .join("\n");
}

function todasAsMigrations(): { arquivo: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      arquivo: `${MIGRATIONS_DIR}/${entry.name}/migration.sql`,
      sql: readFileSync(`${MIGRATIONS_DIR}/${entry.name}/migration.sql`, "utf8"),
    }));
}

/**
 * A trava mais importante deste PR.
 *
 * As travas de migration existentes apontam para um CAMINHO FIXO, entao uma
 * migration FUTURA que dropasse o indice parcial passaria despercebida. O indice
 * nao esta no schema.prisma — nao pode estar, o Prisma nao expressa `WHERE` —,
 * entao um `migrate dev` pode propor remove-lo a qualquer momento. Esta varredura
 * cobre o repositorio inteiro, hoje e no futuro.
 */
test("NENHUMA migration do repositorio dropa o indice unico parcial", () => {
  const proibido = new RegExp(
    `DROP\\s+INDEX\\s+(IF\\s+EXISTS\\s+)?("?[\\w.]*"?\\.)?"?${INDICE_PARCIAL}"?`,
    "i",
  );

  const culpadas = todasAsMigrations()
    .filter(({ sql }) => proibido.test(sql))
    .map(({ arquivo }) => arquivo);

  assert.deepEqual(
    culpadas,
    [],
    `sem o indice parcial o banco volta a aceitar duas ativas por documento: ${culpadas.join(", ")}`,
  );
});

test("a migration nova cria os dois indices esperados", () => {
  const sql = readFileSync(
    `${MIGRATIONS_DIR}/20260730000000_extraction_reaper_indexes/migration.sql`,
    "utf8",
  );

  assert.match(
    sql,
    /CREATE INDEX "document_extractions_state_updated_at_idx"[\s\S]*?"state", "updated_at"/,
    "indice do reaper global",
  );
  assert.match(
    sql,
    /CREATE INDEX "document_extractions_state_created_at_id_idx"[\s\S]*?"state", "created_at", "id"/,
    "indice da fila PENDENTE",
  );
  // Na INSTRUCAO, nao no aviso: o cabecalho explica por que CONCURRENTLY nao e
  // usado, e o Prisma aplica cada migration dentro de uma transacao — onde
  // `CREATE INDEX CONCURRENTLY` nao roda.
  assert.doesNotMatch(sqlOnly(sql), /CONCURRENTLY/, "Prisma aplica migration em transacao");
});

test("a migration nova avisa sobre o indice parcial e sobre db:push", () => {
  const sql = readFileSync(
    `${MIGRATIONS_DIR}/20260730000000_extraction_reaper_indexes/migration.sql`,
    "utf8",
  );

  assert.match(sql, new RegExp(INDICE_PARCIAL), "aponta o indice que nao pode sumir");
  assert.match(sql, /db push|db:push/, "o aviso precisa estar onde alguem le");
  assert.match(sql, /db:migrate|db:deploy/, "aponta o caminho correto");
});

test("o schema declara os dois indices novos e continua avisando do parcial", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(schema, /@@index\(\[state, updatedAt\]\)/, "indice do reaper");
  assert.match(schema, /@@index\(\[state, createdAt, id\]\)/, "indice da fila");
  assert.match(schema, new RegExp(INDICE_PARCIAL), "o aviso do parcial permanece");
});

test("package.json roda este arquivo em test:documents:unit", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.match(
    pkg.scripts["test:documents:unit"],
    /tests\/unit\/documents\/documentExtractionReaper\.test\.ts/,
    "teste que nao esta no script nunca roda",
  );
});
