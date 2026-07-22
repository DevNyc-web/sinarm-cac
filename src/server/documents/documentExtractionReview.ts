/**
 * Modulo de documentos — CONFERENCIA (mock/dev) dos dados de um documento.
 *
 * Funcoes PURAS: recebem os documentos ja persistidos e devolvem a visao de
 * conferencia. NAO leem arquivo, NAO fazem OCR, NAO chamam IA, NAO acessam rede
 * e NAO gravam nada. O status vem DERIVADO do `DocumentStatus` que ja existe no
 * banco — nao ha tabela de conferencia (decisao: sem mudanca de schema).
 */
import type { IntakeDocument } from "./documentIntake";
import {
  needsReview,
  type ConfidenceLevel,
  type ReviewStatus,
} from "./documentExtractionStatus";
import { mockFieldsFor, type MockExtractionField } from "./documentExtractionMock";
import { fromPrismaDocumentType, type DocumentKind } from "./documentTypes";

/** Documento persistido, com o que a tela de conferencia precisa identificar. */
export interface ReviewDocument extends IntakeDocument {
  id: string;
  originalFileName: string;
}

export interface ReviewField extends MockExtractionField {
  /** Sempre `false` hoje: nao ha persistencia de conferencia por campo. */
  confirmed: boolean;
}

export interface DocumentReview {
  documentId: string;
  kind: DocumentKind;
  originalFileName: string;
  status: ReviewStatus;
  fields: readonly ReviewField[];
  /** `true` quando algum campo esta com confianca baixa. */
  hasLowConfidence: boolean;
}

/** Status da conferencia derivado do status do documento + confianca mock. */
function statusFor(document: ReviewDocument, hasLowConfidence: boolean): ReviewStatus {
  switch (document.status) {
    case "REJEITADO":
      return "REJEITADA";
    case "APROVADO":
      return "CONFIRMADA";
    case "PENDENTE":
      return "NAO_INICIADA";
    default:
      // ENVIADO / EM_ANALISE: ha arquivo, mas ninguem conferiu ainda.
      return hasLowConfidence ? "PRECISA_REVISAO" : "EXTRAIDA_MOCK";
  }
}

/**
 * Conferencia de UM documento. Os valores sao de DEMONSTRACAO (mock) e nao
 * saem do arquivo enviado — ver `documentExtractionMock.ts`.
 */
export function reviewForDocument(document: ReviewDocument): DocumentReview {
  const kind = fromPrismaDocumentType(document.type);
  const mockFields = mockFieldsFor(kind);
  const hasLowConfidence = mockFields.some((field) => needsReview(field.confidence));

  return {
    documentId: document.id,
    kind,
    originalFileName: document.originalFileName,
    status: statusFor(document, hasLowConfidence),
    // Nenhum campo nasce confirmado: a conferencia humana ainda nao e gravada.
    fields: mockFields.map((field) => ({ ...field, confirmed: false })),
    hasLowConfidence,
  };
}

/**
 * Conferencia de todos os documentos enviados, mais recentes primeiro.
 * Lista VAZIA quando nao ha documento — a tela nao inventa dados sem arquivo.
 */
export function buildExtractionReview(
  documents: readonly ReviewDocument[],
): readonly DocumentReview[] {
  return [...documents]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(reviewForDocument);
}

/** Onde um dado conferido poderia, no futuro, ajudar a preencher o processo. */
export type SuggestionTarget = "IDENTIFICACAO" | "ORIGEM" | "DESTINO" | "REGISTRO_CAC";

const TARGET_BY_KIND: Partial<Record<DocumentKind, SuggestionTarget>> = {
  IDENTIFICACAO_PESSOAL: "IDENTIFICACAO",
  COMPROVANTE_ORIGEM_ENDERECO: "ORIGEM",
  DECLARACAO_DESTINO_EVENTO: "DESTINO",
  CR_REGISTRO_CAC: "REGISTRO_CAC",
};

export interface ProcessFieldSuggestion {
  target: SuggestionTarget;
  field: string;
  label: string;
  value: string;
  confidence: ConfidenceLevel;
  /** Invariante: nenhuma sugestao pode ser aplicada sem uma pessoa confirmar. */
  requiresHumanConfirmation: true;
}

/**
 * PREPARACAO para o preenchimento assistido futuro (docs/25): transforma a
 * conferencia em SUGESTOES.
 *
 * Nao aplica nada, nao toca no processo, nao grava e nao e chamada por nenhuma
 * tela hoje — e uma funcao pura que so descreve o que PODERIA ser sugerido.
 * So documentos ja CONFIRMADOS pela equipe geram sugestao; documentos
 * complementares nunca geram, porque nao mapeiam para campo do processo.
 */
export function toProcessFieldSuggestions(
  reviews: readonly DocumentReview[],
): readonly ProcessFieldSuggestion[] {
  const suggestions: ProcessFieldSuggestion[] = [];

  for (const review of reviews) {
    if (review.status !== "CONFIRMADA") continue;
    const target = TARGET_BY_KIND[review.kind];
    if (!target) continue;

    for (const field of review.fields) {
      suggestions.push({
        target,
        field: field.key,
        label: field.label,
        value: field.value,
        confidence: field.confidence,
        requiresHumanConfirmation: true,
      });
    }
  }

  return suggestions;
}
