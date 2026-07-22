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

/** Status da conferencia de um documento (dominio). */
export const REVIEW_STATUSES = [
  "NAO_INICIADA",
  "EXTRAIDA_MOCK",
  "PRECISA_REVISAO",
  "CONFIRMADA",
  "REJEITADA",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  NAO_INICIADA: "Não iniciada",
  EXTRAIDA_MOCK: "Demonstração — a conferir",
  PRECISA_REVISAO: "Precisa de revisão",
  CONFIRMADA: "Conferida pela equipe",
  REJEITADA: "Documento rejeitado",
};

/**
 * Explicacao curta por status — a UI nunca deve sugerir que houve leitura real
 * do arquivo, nem prometer aprovacao.
 */
export const REVIEW_STATUS_HELP: Record<ReviewStatus, string> = {
  NAO_INICIADA: "Nenhum arquivo anexado para este documento ainda.",
  EXTRAIDA_MOCK: "Valores de demonstração — não foram lidos do seu arquivo.",
  PRECISA_REVISAO: "Algum campo de demonstração está com confiança baixa.",
  CONFIRMADA: "Uma pessoa da equipe conferiu o documento.",
  REJEITADA: "O documento foi recusado na conferência da equipe.",
};

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
