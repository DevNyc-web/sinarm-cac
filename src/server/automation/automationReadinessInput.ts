/**
 * Adaptador: linha do banco (select restrito) -> snapshot de prontidao.
 *
 * Centraliza a montagem do `AutomationReadinessSnapshot` a partir do retrato
 * minimo lido do banco, para que a FILA e o GATE de envio usem exatamente o
 * mesmo caminho — as REGRAS continuam so em `deriveAutomationReadiness`.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede. Recebe dados ja lidos.
 */
import { type DocumentStatus, type DocumentType, type PaymentStatus } from "@prisma/client";
import {
  buildExtractionReview,
  buildFieldSuggestions,
  type ExtractionFieldsByDocument,
  type IntakeDocument,
  type ReviewDocument,
} from "@/server/documents";
import { type AutomationReadinessSnapshot } from "./automationReadiness";

/** Retrato minimo lido do banco (mesmo `select` da fila e do detalhe). */
export interface AutomationReadinessRow {
  processType: { code: string };
  destination: {
    eventName: string;
    uf: string;
    city: string;
    street: string;
    number: string;
  } | null;
  /** So a EXISTENCIA importa — `firearm: { id }` ou `null`. */
  firearm: { id: string } | null;
  documents: ReadonlyArray<{ type: DocumentType; status: DocumentStatus; createdAt: Date }>;
  payments: ReadonlyArray<{ status: PaymentStatus }>;
}

/**
 * Monta o snapshot para `deriveAutomationReadiness`.
 *
 * `rejectionReason`/`originalFileName`/`id` de documento NAO sao buscados
 * (need-to-know) e NAO afetam a prontidao — usamos placeholders. As sugestoes
 * sao regeradas no servidor, exatamente como na tela do usuario.
 *
 * `extractionFields` e OBRIGATORIO para que a troca do #47C nao possa esquecer
 * este caminho, mas os dois chamadores de hoje passam `NO_EXTRACTION_FIELDS`, e
 * isso e DELIBERADO:
 *
 *   1. Os ids de documento aqui sao FABRICADOS (`doc-0`, `doc-1`) porque o
 *      `select` da fila nao busca `documents.id`. Um mapa chaveado por id real
 *      nunca casaria com eles.
 *   2. Trazer os campos exigiria por `fields` — PII — no `select` da FILA do
 *      admin, uma lista de muitos processos, num caminho que nao checa
 *      `process.pii.viewFull`. Isso e decisao de exposicao de PII, nao fiacao.
 *
 * Enquanto so existir a engine mock, mapa vazio aqui produz exatamente a mesma
 * prontidao de antes. A leitura real neste caminho tem PR proprio, ANTES do
 * worker do #47D — ate la, a fila deriva do mock de propósito.
 */
export function snapshotFromRow(
  row: AutomationReadinessRow,
  extractionFields: ExtractionFieldsByDocument,
): AutomationReadinessSnapshot {
  const documents: IntakeDocument[] = row.documents.map((doc) => ({
    type: doc.type,
    status: doc.status,
    createdAt: doc.createdAt,
    rejectionReason: null,
  }));

  const reviewDocuments: ReviewDocument[] = row.documents.map((doc, index) => ({
    id: `doc-${index}`,
    originalFileName: "",
    type: doc.type,
    status: doc.status,
    createdAt: doc.createdAt,
    rejectionReason: null,
  }));
  const suggestions = buildFieldSuggestions(
    buildExtractionReview(reviewDocuments, extractionFields),
    { destination: row.destination },
  );

  const paymentStatus = row.payments.some((payment) => payment.status === "PAGO")
    ? "PAGO"
    : (row.payments[0]?.status ?? null);

  return {
    processTypeCode: row.processType.code,
    destination: row.destination,
    hasFirearmPce: row.firearm !== null,
    documents,
    suggestions,
    paymentStatus,
  };
}
