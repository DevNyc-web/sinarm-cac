import { type DocumentStatus } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";

/**
 * Repositorio de documentos do processo (docs/12 §3.6) — Fase 4 dev/ficticio.
 * Apenas metadados + sha256; os bytes ficam no storage adapter.
 */

export type CreateDocumentData = {
  processId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  uploadedByMockUserId: string;
};

export function createDocument(data: CreateDocumentData) {
  return getPrisma().processDocument.create({
    data: {
      ...data,
      // type usa o default IDENTIFICACAO_PESSOAL; status o default ENVIADO.
    },
  });
}

/** Documentos do processo, mais recentes primeiro. */
export function listDocumentsForProcess(processId: string) {
  return getPrisma().processDocument.findMany({
    where: { processId },
    orderBy: { createdAt: "desc" },
  });
}

export function findDocumentById(id: string) {
  return getPrisma().processDocument.findUnique({
    where: { id },
    include: { process: true },
  });
}

export type ReviewDocumentData = {
  documentId: string;
  status: Extract<DocumentStatus, "APROVADO" | "REJEITADO" | "EM_ANALISE">;
  reviewedByMockUserId: string;
  reviewedByRole: string;
  /** Obrigatorio na rejeicao; SEM reproduzir PII do documento. */
  rejectionReason?: string;
};

export function updateDocumentReview(data: ReviewDocumentData) {
  return getPrisma().processDocument.update({
    where: { id: data.documentId },
    data: {
      status: data.status,
      reviewedByMockUserId: data.reviewedByMockUserId,
      reviewedByRole: data.reviewedByRole,
      reviewedAt: new Date(),
      rejectionReason: data.status === "REJEITADO" ? (data.rejectionReason ?? null) : null,
    },
  });
}
