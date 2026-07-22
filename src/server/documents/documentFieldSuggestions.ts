/**
 * Modulo de documentos — SUGESTOES de preenchimento do processo.
 *
 * Transforma a conferencia (mock/dev) em sugestoes para campos do processo.
 * Funcoes PURAS: nao gravam, nao alteram o processo, nao chamam rede/OCR/IA.
 * NADA e aplicado automaticamente — toda sugestao carrega
 * `requiresHumanConfirmation: true` e `canApplyAutomatically: false`.
 *
 * Honestidade sobre o modelo atual: so os campos de DESTINO existem hoje
 * (model `Destination`). Dados pessoais, endereco de origem e registro CAC ainda
 * NAO tem coluna — essas sugestoes ficam como CAMPO_FUTURO em vez de fingir que
 * ha onde aplicar.
 */
import type { DocumentReview } from "./documentExtractionReview";
import type { ConfidenceLevel } from "./documentExtractionStatus";
import type { DocumentKind } from "./documentTypes";

/** Campo do processo que uma sugestao pretende preencher. */
export const PROCESS_FIELD_TARGETS = [
  "applicant.name",
  "applicant.cpf",
  "applicant.rg",
  "origin.uf",
  "origin.city",
  "origin.street",
  "origin.number",
  "destination.name",
  "destination.uf",
  "destination.city",
  "destination.street",
  "destination.number",
  "cac.registrationNumber",
  "cac.validUntil",
] as const;

export type ProcessFieldTarget = (typeof PROCESS_FIELD_TARGETS)[number];

/** Area de agrupamento na tela. */
export const SUGGESTION_AREAS = ["PESSOAIS", "CAC", "ORIGEM", "DESTINO"] as const;

export type SuggestionArea = (typeof SUGGESTION_AREAS)[number];

export const SUGGESTION_AREA_LABELS: Record<SuggestionArea, string> = {
  PESSOAIS: "Dados pessoais",
  CAC: "Registro CAC",
  ORIGEM: "Origem / endereço",
  DESTINO: "Destino / evento",
};

/**
 * Status da sugestao.
 * - PRONTA_PARA_REVISAO: o campo existe no processo; falta uma pessoa aplicar.
 * - CAMPO_FUTURO: o campo ainda nao existe no modelo — nao ha onde aplicar.
 */
export const SUGGESTION_STATUSES = ["PRONTA_PARA_REVISAO", "CAMPO_FUTURO"] as const;

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  PRONTA_PARA_REVISAO: "Pronta para revisão",
  CAMPO_FUTURO: "Campo ainda não existe",
};

/** De onde a sugestao veio — hoje sempre a conferencia de demonstracao. */
export const SUGGESTION_SOURCES = ["CONFERENCIA_MOCK"] as const;

export type SuggestionSource = (typeof SUGGESTION_SOURCES)[number];

export const SUGGESTION_SOURCE_LABELS: Record<SuggestionSource, string> = {
  CONFERENCIA_MOCK: "Conferência de demonstração",
};

export interface DocumentFieldSuggestion {
  /** Estavel por (documento, campo de origem). */
  id: string;
  sourceDocumentId: string;
  sourceDocumentType: DocumentKind;
  sourceField: string;
  source: SuggestionSource;
  targetField: ProcessFieldTarget;
  area: SuggestionArea;
  label: string;
  suggestedValue: string;
  /** Valor atual do processo; `null` quando o campo ainda nao existe. */
  currentValue: string | null;
  confidence: ConfidenceLevel;
  status: SuggestionStatus;
  /** Invariante: nenhuma sugestao se aplica sem uma pessoa confirmar. */
  requiresHumanConfirmation: true;
  /** Invariante: nada nesta etapa pode ser aplicado por automacao. */
  canApplyAutomatically: false;
  /** Explicacao curta mostrada ao usuario. */
  reason: string;
}

/** Mapa (tipo de documento, campo extraido) -> campo do processo. */
const TARGET_BY_SOURCE: Partial<Record<DocumentKind, Record<string, ProcessFieldTarget>>> = {
  IDENTIFICACAO_PESSOAL: {
    nome: "applicant.name",
    cpf: "applicant.cpf",
    rg: "applicant.rg",
    // `dataNascimento` nao tem campo-alvo previsto — nao inventamos destino.
  },
  CR_REGISTRO_CAC: {
    numeroRegistro: "cac.registrationNumber",
    validade: "cac.validUntil",
  },
  COMPROVANTE_ORIGEM_ENDERECO: {
    uf: "origin.uf",
    cidade: "origin.city",
    logradouro: "origin.street",
    numero: "origin.number",
  },
  DECLARACAO_DESTINO_EVENTO: {
    nomeLocalEvento: "destination.name",
    uf: "destination.uf",
    cidade: "destination.city",
    logradouro: "destination.street",
    numero: "destination.number",
  },
  // COMPLEMENTAR nao mapeia para nenhum campo do processo — de proposito.
};

const AREA_BY_TARGET_PREFIX: Record<string, SuggestionArea> = {
  applicant: "PESSOAIS",
  cac: "CAC",
  origin: "ORIGEM",
  destination: "DESTINO",
};

/**
 * Campos que EXISTEM no modelo atual (`Destination`). Os demais targets sao
 * preparacao para uma etapa futura: nao ha coluna para receber o valor.
 */
const TARGETS_AVAILABLE_TODAY: readonly ProcessFieldTarget[] = [
  "destination.name",
  "destination.uf",
  "destination.city",
  "destination.street",
  "destination.number",
];

export function isTargetAvailableToday(target: ProcessFieldTarget): boolean {
  return TARGETS_AVAILABLE_TODAY.includes(target);
}

/** Valores atuais do processo que a tela consegue comparar hoje. */
export interface ProcessCurrentValues {
  destination?: {
    eventName: string;
    uf: string;
    city: string;
    street: string;
    number: string;
  } | null;
}

/** Valor atual do campo, ou `null` se o campo nao existe / nao esta preenchido. */
function currentValueFor(
  target: ProcessFieldTarget,
  current: ProcessCurrentValues,
): string | null {
  const destination = current.destination;
  if (!destination) return null;

  switch (target) {
    case "destination.name":
      return destination.eventName || null;
    case "destination.uf":
      return destination.uf || null;
    case "destination.city":
      return destination.city || null;
    case "destination.street":
      return destination.street || null;
    case "destination.number":
      return destination.number || null;
    default:
      // Campos de pessoa/origem/CAC ainda nao existem no modelo.
      return null;
  }
}

function areaFor(target: ProcessFieldTarget): SuggestionArea {
  const prefix = target.split(".")[0];
  return AREA_BY_TARGET_PREFIX[prefix] ?? "PESSOAIS";
}

function reasonFor(status: SuggestionStatus): string {
  return status === "CAMPO_FUTURO"
    ? "Este campo ainda não existe no processo — sugestão preparada para etapa futura."
    : "A aplicação será habilitada após persistência e revisão humana.";
}

/**
 * Sugestoes a partir das conferencias.
 *
 * So documentos com conferencia CONFIRMADA geram sugestao: dado nao conferido
 * por uma pessoa nao vira proposta de preenchimento. Campos sem alvo mapeado
 * (ex.: observacoes de documento complementar) sao ignorados.
 *
 * NAO altera o processo, NAO grava nada e NAO retorna nada aplicavel sozinho.
 */
export function buildFieldSuggestions(
  reviews: readonly DocumentReview[],
  current: ProcessCurrentValues = {},
): readonly DocumentFieldSuggestion[] {
  const suggestions: DocumentFieldSuggestion[] = [];

  for (const review of reviews) {
    if (review.status !== "CONFIRMADA") continue;

    const targets = TARGET_BY_SOURCE[review.kind];
    if (!targets) continue;

    for (const field of review.fields) {
      const targetField = targets[field.key];
      if (!targetField) continue;

      const status: SuggestionStatus = isTargetAvailableToday(targetField)
        ? "PRONTA_PARA_REVISAO"
        : "CAMPO_FUTURO";

      suggestions.push({
        id: `${review.documentId}:${field.key}`,
        sourceDocumentId: review.documentId,
        sourceDocumentType: review.kind,
        sourceField: field.key,
        source: "CONFERENCIA_MOCK",
        targetField,
        area: areaFor(targetField),
        label: field.label,
        suggestedValue: field.value,
        currentValue: currentValueFor(targetField, current),
        confidence: field.confidence,
        status,
        requiresHumanConfirmation: true,
        canApplyAutomatically: false,
        reason: reasonFor(status),
      });
    }
  }

  return suggestions;
}

export interface SuggestionGroup {
  area: SuggestionArea;
  label: string;
  suggestions: readonly DocumentFieldSuggestion[];
}

/** Agrupa por area, na ordem de `SUGGESTION_AREAS`; areas vazias sao omitidas. */
export function groupSuggestionsByArea(
  suggestions: readonly DocumentFieldSuggestion[],
): readonly SuggestionGroup[] {
  return SUGGESTION_AREAS.map((area) => ({
    area,
    label: SUGGESTION_AREA_LABELS[area],
    suggestions: suggestions.filter((suggestion) => suggestion.area === area),
  })).filter((group) => group.suggestions.length > 0);
}
