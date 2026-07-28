/**
 * ORIGEM da extracao e o que a tela AFIRMA sobre ela (PR #47C-3).
 *
 * O projeto inteiro se apoia em nao fingir leitura de documento. Ate aqui a tela
 * dizia "nao foram lidos do seu arquivo" em qualquer caso — verdade enquanto so
 * existia a engine mock, e mentira no dia em que um motor real gravasse campos.
 *
 * Estes testes travam as DUAS inversoes, que sao igualmente graves:
 *   - dizer que LEMOS quando o dado e demonstracao/simulacao;
 *   - dizer que NAO LEMOS quando um motor real leu.
 *
 * Sem OCR, sem rede, sem banco: microcopy e funcoes puras.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  REVIEW_SOURCES,
  REVIEW_SOURCE_BADGES,
  REVIEW_SOURCE_HELP,
  REVIEW_STATUSES,
  REVIEW_STATUS_HELP,
  REVIEW_STATUS_LABELS,
  sourceReadTheFile,
  type ReviewSource,
} from "../../../src/server/documents/documentExtractionStatus";
import {
  SUGGESTION_ORIGIN_LABELS,
  buildFieldSuggestions,
} from "../../../src/server/documents/documentFieldSuggestions";
import {
  aggregateReviewSource,
  buildExtractionReview,
  reviewForDocument,
  NO_EXTRACTION_FIELDS,
  type DocumentReview,
  type ReviewDocument,
} from "../../../src/server/documents/documentExtractionReview";
import { sourceForEngine } from "../../../src/server/extraction/reviewSource";
import { MOCK_ENGINE_NAME } from "../../../src/server/extraction/mockEngine";

/**
 * Frases que so podem existir quando o arquivo FOI lido.
 *
 * O lookbehind de negacao e essencial: "Seu arquivo NAO foi lido" contem a
 * palavra "lido" e e justamente a frase oposta. Sem ele, o teste acusaria de
 * mentira exatamente o texto honesto.
 */
const AFIRMA_LEITURA =
  /(?<!não )(?<!nao )\b(foi|foram) lid[oa]s?\b|lid[oa]s? automaticamente|leitura autom|extraíd\w+ do seu arquivo/i;

/** Frases que so podem existir quando o arquivo NAO foi lido. */
const AFIRMA_NAO_LEITURA = /não foi lido|nao foi lido|nenhum arquivo foi lido|não há OCR|nao ha OCR/i;

function doc(over: Partial<ReviewDocument> = {}): ReviewDocument {
  return {
    id: "d1",
    originalFileName: "fake.pdf",
    type: "DECLARACAO_DESTINO_EVENTO",
    status: "APROVADO",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    rejectionReason: null,
    ...over,
  };
}

const CAMPOS = [
  {
    key: "nomeLocalEvento",
    label: "Nome do local / evento",
    value: "Clube (exemplo)",
    confidence: "ALTA" as const,
  },
];

function reviewCom(source: Exclude<ReviewSource, "MOCK_FALLBACK">): DocumentReview {
  return reviewForDocument(doc(), { fields: CAMPOS, source });
}

/* ------------------------------------------------- vocabulario completo --- */

test("todo ReviewSource tem badge, ajuda e rotulo de origem", () => {
  for (const source of REVIEW_SOURCES) {
    assert.equal(typeof REVIEW_SOURCE_BADGES[source], "string", `${source}: badge`);
    assert.ok(REVIEW_SOURCE_HELP[source].length > 0, `${source}: ajuda`);
    assert.ok(SUGGESTION_ORIGIN_LABELS[source].length > 0, `${source}: origem da sugestao`);
  }
});

test("EXTRAIDA_MOCK deixou de existir — status nao fala mais de origem", () => {
  assert.ok(!(REVIEW_STATUSES as readonly string[]).includes("EXTRAIDA_MOCK"));
  assert.ok((REVIEW_STATUSES as readonly string[]).includes("EXTRAIDA"));

  // Nenhum texto de STATUS pode afirmar nada sobre ter lido o arquivo: isso e
  // assunto da ORIGEM. Era exatamente a fusao que gerava a mentira.
  for (const status of REVIEW_STATUSES) {
    assert.doesNotMatch(REVIEW_STATUS_HELP[status], AFIRMA_LEITURA, `${status}: ajuda`);
    assert.doesNotMatch(REVIEW_STATUS_HELP[status], AFIRMA_NAO_LEITURA, `${status}: ajuda`);
    assert.doesNotMatch(REVIEW_STATUS_LABELS[status], AFIRMA_LEITURA, `${status}: rotulo`);
  }
});

/* ------------------------------------------------ microcopy por origem --- */

test("MOCK_FALLBACK e PERSISTED_MOCK_ENGINE NUNCA afirmam leitura", () => {
  for (const source of ["MOCK_FALLBACK", "PERSISTED_MOCK_ENGINE"] as const) {
    assert.doesNotMatch(REVIEW_SOURCE_HELP[source], AFIRMA_LEITURA, `${source}: ajuda`);
    assert.doesNotMatch(REVIEW_SOURCE_BADGES[source], AFIRMA_LEITURA, `${source}: badge`);
    assert.doesNotMatch(SUGGESTION_ORIGIN_LABELS[source], AFIRMA_LEITURA, `${source}: origem`);
    assert.match(REVIEW_SOURCE_HELP[source], AFIRMA_NAO_LEITURA, `${source}: diz que nao leu`);
    assert.equal(sourceReadTheFile(source), false);
  }
});

test("PERSISTED_REAL_ENGINE afirma leitura E exige conferencia humana", () => {
  const ajuda = REVIEW_SOURCE_HELP.PERSISTED_REAL_ENGINE;

  assert.match(ajuda, AFIRMA_LEITURA, "precisa dizer que leu");
  assert.doesNotMatch(ajuda, AFIRMA_NAO_LEITURA, "nao pode dizer que nao leu");
  assert.match(ajuda, /conferid\w+ por uma pessoa/i, "leitura automatica exige pessoa");
  assert.equal(sourceReadTheFile("PERSISTED_REAL_ENGINE"), true);
});

test("simulacao e demonstracao sao distinguiveis entre si", () => {
  assert.notEqual(
    REVIEW_SOURCE_HELP.MOCK_FALLBACK,
    REVIEW_SOURCE_HELP.PERSISTED_MOCK_ENGINE,
    "houve tentativa registrada num caso e nao no outro — a tela nao pode empatar",
  );
  assert.match(REVIEW_SOURCE_HELP.PERSISTED_MOCK_ENGINE, /simulad/i);
});

/* ---------------------------------------------------------- agregacao --- */

test("agregado so afirma algo global quando TODOS compartilham a origem", () => {
  assert.equal(aggregateReviewSource([]), null, "sem documento, nada a afirmar");

  const soFallback = buildExtractionReview([doc()], NO_EXTRACTION_FIELDS);
  assert.equal(aggregateReviewSource(soFallback), "MOCK_FALLBACK");

  const soReal = [reviewCom("PERSISTED_REAL_ENGINE")];
  assert.equal(aggregateReviewSource(soReal), "PERSISTED_REAL_ENGINE");

  const mistura = [reviewCom("PERSISTED_REAL_ENGINE"), ...soFallback];
  assert.equal(aggregateReviewSource(mistura), "MISTA", "origens diferentes => nada global");
});

test("o painel NAO usa texto global quando a origem e mista", () => {
  // Trava de codigo: os dois paineis tem de ramificar em MISTA. Um texto fixo
  // ali seria uma afirmacao sobre documentos que nao a compartilham.
  for (const arquivo of PAINEIS) {
    const code = readFileSync(arquivo, "utf8");
    assert.match(code, /aggregateReviewSource/, `${arquivo}: agrega`);
    assert.match(code, /"MISTA"/, `${arquivo}: trata origem mista`);
  }
});

const PAINEIS = [
  "src/components/documents/DocumentExtractionReviewPanel.tsx",
  "src/components/documents/DocumentFieldSuggestionsPanel.tsx",
];

test("nenhum painel afirma nao-leitura de forma incondicional", () => {
  // O defeito original: `Notice` fixa dizendo "Nenhum arquivo foi lido". Agora
  // toda frase desse tipo tem de estar sob ramo de origem.
  for (const arquivo of PAINEIS) {
    const code = readFileSync(arquivo, "utf8");
    assert.match(code, /leuOArquivo \?/, `${arquivo}: precisa de ramo para leitura real`);
  }
});

test("a decisao de AFIRMAR leitura passa por sourceReadTheFile, nunca por comparacao", () => {
  // Sem esta trava, um `ReviewSource` novo que signifique leitura real cairia no
  // `else` das cadeias ternarias — que e o texto de demonstracao — e a tela
  // NEGARIA uma leitura que aconteceu. A regra tem de viver num lugar so.
  for (const arquivo of PAINEIS) {
    const code = readFileSync(arquivo, "utf8");

    assert.match(code, /sourceReadTheFile\(/, `${arquivo}: usa o helper`);
    assert.ok(
      !code.includes('=== "PERSISTED_REAL_ENGINE"'),
      `${arquivo}: comparar literalmente burla a regra unica`,
    );
  }
});

test("sourceReadTheFile NAO e codigo morto", () => {
  const usos = PAINEIS.filter((arquivo) =>
    /sourceReadTheFile\(/.test(readFileSync(arquivo, "utf8")),
  );

  assert.deepEqual(usos, PAINEIS, "um helper de regra que ninguem chama nao e regra nenhuma");
});

/* ------------------------------------------- classificacao pelo engine --- */

test("engine mock => PERSISTED_MOCK_ENGINE; qualquer outra => PERSISTED_REAL_ENGINE", () => {
  assert.equal(sourceForEngine(MOCK_ENGINE_NAME), "PERSISTED_MOCK_ENGINE");

  for (const engine of ["tesseract-local", "ocr-v2", "", "MOCK", "mock-2"]) {
    assert.equal(sourceForEngine(engine), "PERSISTED_REAL_ENGINE", `${engine}`);
  }
});

test("ausencia de linha utilizavel => MOCK_FALLBACK", () => {
  const [review] = buildExtractionReview([doc()], NO_EXTRACTION_FIELDS);
  assert.equal(review.source, "MOCK_FALLBACK");
});

test("PERSISTED_REAL_ENGINE e INALCANCAVEL em producao nesta fase", () => {
  // So a engine mock existe e so ela grava linha. O valor existe no tipo para o
  // #47D, e nenhum codigo de producao o produz literalmente.
  const producao = [
    "src/server/services/loadOwnerExtractionFields.ts",
    "src/server/automation/readinessExtractionFields.ts",
    "src/server/documents/documentExtractionReview.ts",
  ];
  for (const arquivo of producao) {
    const code = readFileSync(arquivo, "utf8");
    assert.ok(
      !code.includes('"PERSISTED_REAL_ENGINE"'),
      `${arquivo}: a origem real so pode vir de sourceForEngine, nunca escrita a mao`,
    );
  }
});

/* ----------------------------------------- sugestao herda, nao inventa --- */

test("a sugestao HERDA a origem do review", () => {
  for (const source of REVIEW_SOURCES) {
    const reviews =
      source === "MOCK_FALLBACK"
        ? buildExtractionReview([doc()], NO_EXTRACTION_FIELDS)
        : [reviewCom(source)];

    const suggestions = buildFieldSuggestions(reviews, {});
    assert.ok(suggestions.length > 0, `${source}: controle`);
    for (const suggestion of suggestions) {
      assert.equal(suggestion.source, source, "origem da sugestao e a do review");
    }
  }
});

test("SUGGESTION_SOURCES deixou de existir — vocabulario unico", async () => {
  const modulo = await import("../../../src/server/documents/documentFieldSuggestions");
  assert.ok(!("SUGGESTION_SOURCES" in modulo), "enum paralelo removido");
  assert.ok(!("SUGGESTION_SOURCE_LABELS" in modulo), "rotulo antigo removido");

  // `codeOnly`: o cabecalho EXPLICA que `CONFERENCIA_MOCK` foi removido — citar
  // em prosa nao e usar. O que nao pode e a origem voltar a ser escrita a mao.
  const code = readFileSync("src/server/documents/documentFieldSuggestions.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.ok(!code.includes("CONFERENCIA_MOCK"), "origem escrita a mao removida");
  assert.match(code, /source: review\.source/, "herda do review");
});

/* --------------------------------------------------- nao-regressao --- */

test("checkSuggestionApplication NAO le a origem", () => {
  // Se lesse, mudar rotulo mudaria o que pode ser aplicado — e este PR e de
  // display. A aplicacao continua governada por status/allowlist/valor.
  const code = readFileSync("src/server/documents/documentSuggestionApply.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.doesNotMatch(code, /\.source\b|ReviewSource/, "aplicacao nao depende da origem");
});

test("a origem NAO altera o que e aplicavel", () => {
  // MESMOS campos, so a origem muda — e o unico jeito de isolar a variavel. Usar
  // o fallback aqui compararia conjuntos de campos diferentes (mock tem outros),
  // e o teste passaria ou falharia pelo motivo errado.
  const base = reviewForDocument(doc(), { fields: CAMPOS, source: "PERSISTED_MOCK_ENGINE" });

  const porOrigem = REVIEW_SOURCES.map((source) =>
    buildFieldSuggestions([{ ...base, source }], {}).map(
      ({ source: _ignorado, ...resto }) => resto,
    ),
  );

  for (const outra of porOrigem.slice(1)) {
    assert.deepEqual(outra, porOrigem[0], "so a origem muda; decisao e valores, nao");
  }
});

test("nenhum texto novo promete OCR, IA ou envio automatico", () => {
  const textos = [
    ...Object.values(REVIEW_SOURCE_HELP),
    ...Object.values(REVIEW_SOURCE_BADGES),
    ...Object.values(SUGGESTION_ORIGIN_LABELS),
    ...Object.values(REVIEW_STATUS_HELP),
  ];

  for (const texto of textos) {
    // NAO se varre "OCR"/"IA" cru: os textos honestos dizem justamente "não foi
    // lido por OCR ou IA". O que se proibe e PROMETER que estao ativos.
    assert.doesNotMatch(texto, /OCR ativ|com OCR|via OCR|usando IA|com IA\b/i, texto);
    assert.doesNotMatch(texto, /enviado automaticamente para|envia(?:mos|do) ao órgão/i, texto);
    assert.doesNotMatch(texto, /gov\.?br|sinarm|polícia federal/i, texto);
  }
});
