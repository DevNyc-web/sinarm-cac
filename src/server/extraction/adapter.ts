/**
 * Contrato do motor de extracao documental (PR #47B).
 *
 * ARQUITETURA OBRIGATORIA (mesma de `payments/adapter.ts` e `storage.ts`): o
 * dominio so conhece esta interface. Trocar a engine mock por OCR local ou por
 * um servico externo = nova implementacao registrada na fabrica, sem reescrever
 * services.
 *
 * Nesta fase existe APENAS a engine "mock": sem OCR, sem IA, sem rede, sem
 * nuvem. Ela nao le o arquivo — devolve os mesmos valores de demonstracao que a
 * UI ja mostra hoje, para que a troca de fonte no PR #47C nao mude comportamento.
 */
import type { ConfidenceLevel } from "@/server/documents/documentExtractionStatus";
import type { ExtractionFailureReason } from "@/server/documents/documentExtractionTypes";
import type { DocumentKind } from "@/server/documents/documentTypes";

export type ExtractionInput = {
  documentId: string;
  kind: DocumentKind;
  mimeType: string;
  /**
   * Bytes do arquivo. OPCIONAL de proposito: a engine mock nao os recebe nem os
   * usa, entao nao ha caminho pelo qual ela possa vazar conteudo de documento.
   * Uma engine real declarara que precisa deles.
   */
  bytes?: Buffer;
};

/** Um campo lido. Espelha `MockExtractionField` para a troca do #47C ser neutra. */
export type ExtractedFieldResult = {
  key: string;
  label: string;
  value: string;
  confidence: ConfidenceLevel;
};

export type ExtractionResult =
  | {
      ok: true;
      fields: ExtractedFieldResult[];
      /** Agregado do PIOR campo — atalho gravado em `document_extractions`. */
      confidence: ConfidenceLevel;
    }
  | {
      ok: false;
      /** Codigo FECHADO. Nunca texto livre, nunca trecho do documento. */
      failureReason: ExtractionFailureReason;
    };

export interface ExtractionEngine {
  readonly name: string;
  readonly version: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

/** Ordem de severidade: o agregado de um conjunto e o PIOR campo. */
const CONFIDENCE_SEVERITY: Record<ConfidenceLevel, number> = {
  ALTA: 0,
  MEDIA: 1,
  BAIXA: 2,
};

/**
 * Confianca agregada de um conjunto de campos.
 *
 * Pior campo vence: um documento com nome legivel e CPF duvidoso NAO e um
 * documento de confianca alta — tratar como alta esconderia justamente o campo
 * que precisa de olho humano.
 *
 * Conjunto vazio => BAIXA (nada lido nao e evidencia de qualidade).
 */
export function aggregateConfidence(
  fields: readonly ExtractedFieldResult[],
): ConfidenceLevel {
  if (fields.length === 0) return "BAIXA";
  return fields.reduce<ConfidenceLevel>(
    (pior, field) =>
      CONFIDENCE_SEVERITY[field.confidence] > CONFIDENCE_SEVERITY[pior] ? field.confidence : pior,
    "ALTA",
  );
}
