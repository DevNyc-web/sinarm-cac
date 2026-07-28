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
  documents: ReadonlyArray<{
    /** Chave real do documento — casa com o mapa de extracao (#47C-2). */
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    createdAt: Date;
  }>;
  payments: ReadonlyArray<{ status: PaymentStatus }>;
}

/**
 * Monta o snapshot para `deriveAutomationReadiness`.
 *
 * `rejectionReason`/`originalFileName` de documento NAO sao buscados
 * (need-to-know) e NAO afetam a prontidao — usamos placeholders. `id` passou a
 * ser buscado no #47C-2 por ser a chave da extracao, e nao PII. As sugestoes
 * sao regeradas no servidor, exatamente como na tela do usuario.
 *
 * `extractionFields` chega PRONTO do chamador — este modulo continua sem I/O.
 * Desde o #47C-2 a fila e o gate passam o mapa REAL, chaveado pelo `id` do
 * documento (que o `select` agora busca), e nao mais um mapa vazio.
 *
 * REGRA QUE SUSTENTA ISSO: permissao governa DIVULGACAO, nao COMPUTACAO. Os
 * campos extraidos entram aqui como insumo de decisao e saem reduzidos a
 * contagem de bloqueios; nenhum valor chega ao DTO da fila, ao payload RSC ou a
 * log. E por isso que a prontidao pode ler PII sem `process.pii.viewFull` — e
 * tambem por isso que ela NAO pode variar por perfil: prontidao e fato sobre o
 * processo, nao sobre quem esta olhando.
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

  const reviewDocuments: ReviewDocument[] = row.documents.map((doc) => ({
    // Id REAL: e o que faz o mapa de extracao casar. Antes do #47C-2 era um
    // placeholder (`doc-0`), porque o select da fila nao trazia a chave.
    id: doc.id,
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
