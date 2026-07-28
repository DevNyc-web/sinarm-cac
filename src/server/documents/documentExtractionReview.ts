/**
 * Modulo de documentos — CONFERENCIA dos dados de um documento.
 *
 * Funcoes PURAS: recebem os documentos ja persistidos MAIS os campos extraidos
 * ja lidos, e devolvem a visao de conferencia. NAO leem arquivo, NAO fazem OCR,
 * NAO chamam IA, NAO acessam rede e NAO gravam nada. O status vem DERIVADO do
 * `DocumentStatus` que ja existe no banco — nao ha tabela de conferencia
 * (decisao: sem mudanca de schema).
 *
 * FONTE DOS CAMPOS (PR #47C): os campos vem INJETADOS pelo chamador, nunca lidos
 * aqui. Quem tem I/O (a pagina do processo, o service de aplicacao) carrega o
 * mapa com `loadOwnerExtractionFields` e o passa adiante; quem e puro (o
 * adaptador da fila) passa um mapa vazio. Manter a leitura fora daqui e o que
 * permite este modulo continuar SINCRONO — se ele virasse async, os quatro
 * consumidores e a fila do admin teriam de virar tambem, e o adaptador de
 * prontidao perderia a pureza que o mantem livre de N+1.
 *
 * Documento AUSENTE do mapa cai em `mockFieldsFor`. Isso e o que torna a troca do
 * #47C neutra: hoje nada cria linha de extracao em producao, entao o mapa chega
 * sempre vazio e a saida e identica a de antes, campo a campo.
 */
import type { IntakeDocument } from "./documentIntake";
import {
  needsReview,
  type ConfidenceLevel,
  type ReviewSource,
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
  /** ORIGEM dos valores — o que autoriza (ou proibe) a tela dizer "lemos". */
  source: ReviewSource;
  fields: readonly ReviewField[];
  /** `true` quando algum campo esta com confianca baixa. */
  hasLowConfidence: boolean;
}

/**
 * Uma extracao persistida ja lida: os campos MAIS de onde vieram.
 *
 * A origem viaja junto com os campos de proposito. Se a UI tivesse de descobrir
 * a fonte por outro caminho, os dois poderiam divergir — e a divergencia
 * apareceria como uma frase errada na tela do cliente sobre o documento dele.
 */
export type PersistedExtraction = {
  fields: readonly MockExtractionField[];
  /** Sempre um `PERSISTED_*`: quem esta no mapa veio do banco. */
  source: Extract<ReviewSource, `PERSISTED_${string}`>;
};

/**
 * Extracoes persistidas por `documentId`.
 *
 * Documento AUSENTE significa "sem extracao confiavel" — e nao "extraiu zero
 * campos". O loader so poe no mapa tentativas em estado utilizavel com JSON
 * valido, entao PENDENTE/PROCESSANDO/FALHOU e linha corrompida chegam aqui como
 * ausencia, e caem em `MOCK_FALLBACK`.
 */
export type ExtractionFieldsByDocument = ReadonlyMap<string, PersistedExtraction>;

/** Mapa vazio para quem nao le extracao persistida (adaptador da fila). */
export const NO_EXTRACTION_FIELDS: ExtractionFieldsByDocument = new Map();

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
      return hasLowConfidence ? "PRECISA_REVISAO" : "EXTRAIDA";
  }
}

/**
 * Conferencia de UM documento.
 *
 * `extraction` e a extracao persistida ja lida; `null` (ou ausencia) cai nos
 * valores de DEMONSTRACAO, que nao saem do arquivo enviado — ver
 * `documentExtractionMock.ts` — e a origem vira `MOCK_FALLBACK`.
 */
export function reviewForDocument(
  document: ReviewDocument,
  extraction: PersistedExtraction | null,
): DocumentReview {
  const kind = fromPrismaDocumentType(document.type);
  // Sem extracao confiavel => mock, exatamente como antes do #47C.
  const fields = extraction?.fields ?? mockFieldsFor(kind);
  const hasLowConfidence = fields.some((field) => needsReview(field.confidence));

  return {
    documentId: document.id,
    kind,
    originalFileName: document.originalFileName,
    status: statusFor(document, hasLowConfidence),
    source: extraction?.source ?? "MOCK_FALLBACK",
    // Nenhum campo nasce confirmado: a conferencia humana ainda nao e gravada.
    fields: fields.map((field) => ({ ...field, confirmed: false })),
    hasLowConfidence,
  };
}

/**
 * Conferencia de todos os documentos enviados, mais recentes primeiro.
 * Lista VAZIA quando nao ha documento — a tela nao inventa dados sem arquivo.
 *
 * `extractionFields` e OBRIGATORIO de proposito. Um parametro opcional deixaria
 * a troca do #47C acontecer pela metade em silencio; obrigatorio, o compilador
 * recusa o build ate os quatro consumidores migrarem no MESMO commit. Quem nao
 * le extracao persistida passa `NO_EXTRACTION_FIELDS`.
 */
export function buildExtractionReview(
  documents: readonly ReviewDocument[],
  extractionFields: ExtractionFieldsByDocument,
): readonly DocumentReview[] {
  return [...documents]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((document) => reviewForDocument(document, extractionFields.get(document.id) ?? null));
}

/** Origem comum a TODOS os documentos, ou `"MISTA"`, ou `null` se nao ha nenhum. */
export type AggregateSource = ReviewSource | "MISTA" | null;

/**
 * Origem do conjunto, para o texto de PAINEL.
 *
 * A origem e por documento, mas o painel tem avisos que falam do conjunto. Sem
 * este agregado, o unico jeito de escrever esse aviso seria escolher uma fonte
 * e torcer — que e como o texto fixo "Nenhum arquivo foi lido" existia. Com
 * fontes MISTAS o painel nao pode afirmar nada global: tem de mandar olhar o
 * rotulo de cada documento.
 */
export function aggregateReviewSource(
  reviews: readonly DocumentReview[],
): AggregateSource {
  const [first, ...rest] = reviews;
  if (!first) return null;
  return rest.every((review) => review.source === first.source) ? first.source : "MISTA";
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
