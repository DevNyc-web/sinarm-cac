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
 */
export function snapshotFromRow(row: AutomationReadinessRow): AutomationReadinessSnapshot {
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
  const suggestions = buildFieldSuggestions(buildExtractionReview(reviewDocuments), {
    destination: row.destination,
  });

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
