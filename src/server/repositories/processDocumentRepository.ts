import { type DocumentStatus, type DocumentType } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";

/**
 * Repositorio de documentos do processo (docs/12 §3.6) — Fase 4 dev/ficticio.
 * Apenas metadados + sha256; os bytes ficam no storage adapter.
 *
 * NEED-TO-KNOW (docs/11 §3/§19): as leituras do painel usam `select` explicito.
 * Colunas que o perfil nao pode ver NAO SAO BUSCADAS — nao basta esconder na
 * UI, porque o dado buscado ainda trafega (payload RSC em dev, logs, futura API).
 * `storageKey` nunca sai nas leituras de tela: so o download/expurgo precisa dele.
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

/** Campos nao sensiveis — sempre visiveis a qualquer perfil interno. */
const DOCUMENT_BASE_SELECT = {
  id: true,
  type: true,
  status: true,
  createdAt: true,
  uploadedByMockUserId: true,
  reviewedByMockUserId: true,
  reviewedByRole: true,
  reviewedAt: true,
} as const;

/** Metadados restritos a quem tem `process.pii.viewFull`. */
const DOCUMENT_SENSITIVE_SELECT = {
  originalFileName: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  rejectionReason: true,
} as const;

export type DocumentRow = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  createdAt: Date;
  uploadedByMockUserId: string;
  reviewedByMockUserId: string | null;
  reviewedByRole: string | null;
  reviewedAt: Date | null;
  // Presentes apenas quando `includeMetadata` e true.
  originalFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  rejectionReason?: string | null;
};

/**
 * Documentos do processo para o PAINEL ADMIN, mais recentes primeiro.
 * `includeMetadata` false => nome do arquivo, mime, tamanho, sha256 e motivo de
 * rejeicao nem chegam a ser lidos do banco.
 */
export function listDocumentsForAdmin(
  processId: string,
  includeMetadata: boolean,
): Promise<DocumentRow[]> {
  return getPrisma().processDocument.findMany({
    where: { processId },
    select: includeMetadata
      ? { ...DOCUMENT_BASE_SELECT, ...DOCUMENT_SENSITIVE_SELECT }
      : DOCUMENT_BASE_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

export type OwnerDocumentRow = Required<Omit<DocumentRow, "rejectionReason">> & {
  rejectionReason: string | null;
};

/**
 * Documentos para o PROPRIO DONO do processo: sempre com metadados (sao os
 * dados dele), mas sem `storageKey` — a tela nao precisa da chave do storage.
 */
export function listDocumentsForOwner(processId: string): Promise<OwnerDocumentRow[]> {
  return getPrisma().processDocument.findMany({
    where: { processId },
    select: { ...DOCUMENT_BASE_SELECT, ...DOCUMENT_SENSITIVE_SELECT },
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
