/**
 * Modulo de documentos — STATUS DA CONFERENCIA humana dos dados extraidos.
 *
 * Distinto de `EXTRACTION_STATES` (documentExtractionTypes.ts), que descreve o
 * ciclo da EXTRACAO futura (o pipeline). Aqui o assunto e a CONFERENCIA: o que
 * uma pessoa ja disse sobre os dados de um documento.
 *
 * NADA aqui e persistido: hoje o status e DERIVADO do `DocumentStatus` que ja
 * existe no banco. Sem OCR, sem IA, sem rede.
 */

/**
 * Status da conferencia de um documento (dominio).
 *
 * `EXTRAIDA` chamava-se `EXTRAIDA_MOCK`. O "MOCK" saiu porque nunca foi sobre o
 * STATUS: era sobre a ORIGEM dos dados, que agora tem vocabulario proprio
 * (`ReviewSource`). Manter os dois fundidos num nome era o que fazia a tela
 * afirmar "demonstracao" mesmo quando a fonte deixasse de ser.
 */
export const REVIEW_STATUSES = [
  "NAO_INICIADA",
  "EXTRAIDA",
  "PRECISA_REVISAO",
  "CONFIRMADA",
  "REJEITADA",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  NAO_INICIADA: "Não iniciada",
  EXTRAIDA: "A conferir",
  PRECISA_REVISAO: "Precisa de revisão",
  CONFIRMADA: "Conferida pela equipe",
  REJEITADA: "Documento rejeitado",
};

/**
 * Explicacao curta por STATUS — sobre a CONFERENCIA, nunca sobre a origem.
 *
 * O que a tela diz a respeito de ter lido ou nao o arquivo vem de
 * `REVIEW_SOURCE_HELP`. Separar evita a armadilha antiga: um texto de status que
 * prometia "nao foram lidos do seu arquivo" e viraria mentira no dia em que um
 * motor real gravasse campos.
 */
export const REVIEW_STATUS_HELP: Record<ReviewStatus, string> = {
  NAO_INICIADA: "Nenhum arquivo anexado para este documento ainda.",
  EXTRAIDA: "Aguardando conferência.",
  PRECISA_REVISAO: "Algum campo está com confiança baixa.",
  CONFIRMADA: "Uma pessoa da equipe conferiu o documento.",
  REJEITADA: "O documento foi recusado na conferência da equipe.",
};

/* ------------------------------------------------------------------ origem --- */

/**
 * ORIGEM dos valores exibidos — de onde o dado veio, nao em que ponto da
 * conferencia ele esta.
 *
 * Existe porque a UI faz uma afirmacao forte ao usuario: se o arquivo dele foi
 * ou nao lido. Essa frase precisa acompanhar a fonte real, nos DOIS sentidos —
 * nunca dizer que lemos quando e demonstracao, e nunca dizer que nao lemos
 * quando um motor real leu.
 */
export const REVIEW_SOURCES = [
  /** Sem linha persistida utilizavel: valores de demonstracao. */
  "MOCK_FALLBACK",
  /** Linha persistida gravada pela engine mock — houve registro, NAO leitura. */
  "PERSISTED_MOCK_ENGINE",
  /** Linha persistida por motor que leu o arquivo. Inalcancavel nesta fase. */
  "PERSISTED_REAL_ENGINE",
] as const;

export type ReviewSource = (typeof REVIEW_SOURCES)[number];

/** Rotulo curto de origem — vira badge ao lado do documento. */
export const REVIEW_SOURCE_BADGES: Record<ReviewSource, string> = {
  MOCK_FALLBACK: "demonstração",
  PERSISTED_MOCK_ENGINE: "simulação",
  PERSISTED_REAL_ENGINE: "leitura automática",
};

/** Explicacao por origem — e AQUI que se fala em ler ou nao ler o arquivo. */
export const REVIEW_SOURCE_HELP: Record<ReviewSource, string> = {
  MOCK_FALLBACK:
    "Valores de exemplo. Seu arquivo não foi lido — servem para mostrar como será a conferência.",
  PERSISTED_MOCK_ENGINE:
    "Extração simulada (ambiente de desenvolvimento). Seu arquivo não foi lido por OCR ou IA; os valores continuam sendo de exemplo.",
  PERSISTED_REAL_ENGINE:
    "Valores lidos automaticamente do seu arquivo. Precisam ser conferidos por uma pessoa antes de qualquer uso.",
};

/**
 * `true` SOMENTE quando o arquivo foi de fato lido.
 *
 * Fonte UNICA da decisao para toda a UI: nenhum componente pode decidir por
 * conta propria se pode dizer "lemos". `PERSISTED_MOCK_ENGINE` e `false` de
 * proposito — houve tentativa registrada, nao leitura.
 */
export function sourceReadTheFile(source: ReviewSource): boolean {
  return source === "PERSISTED_REAL_ENGINE";
}

/** Nivel de confianca MOCK — rotulo grosseiro, nunca medida real de OCR. */
export const CONFIDENCE_LEVELS = ["ALTA", "MEDIA", "BAIXA"] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  ALTA: "Confiança alta",
  MEDIA: "Confiança média",
  BAIXA: "Confiança baixa",
};

/** `true` se o nivel exige olhar humano antes de qualquer uso. */
export function needsReview(level: ConfidenceLevel): boolean {
  return level === "BAIXA";
}

export function reviewStatusLabel(status: ReviewStatus): string {
  return REVIEW_STATUS_LABELS[status];
}
