import { type DocumentStatus, type DocumentType, type Prisma } from "@prisma/client";
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
  /** Tipo persistido. Omitido => default IDENTIFICACAO_PESSOAL do schema. */
  type?: DocumentType;
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
      // status usa o default ENVIADO — a conferencia continua sendo humana.
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

/**
 * Ordem da FILA de enfileiramento: mais antigos primeiro.
 *
 * ASC porque e FIFO — o documento que espera ha mais tempo nao pode ser preterido
 * por trabalho novo. O desempate por `id` existe pelo mesmo motivo do repositorio
 * de extracoes: `created_at` e TIMESTAMP(3), duas linhas no mesmo milissegundo
 * empatam, e sem criterio declarado a mesma fila sairia em ordens diferentes.
 */
const OLDEST_FIRST: Prisma.ProcessDocumentOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];

/**
 * Documentos que JA TEM ARQUIVO e ainda nao foram conferidos, excluindo os que
 * ja possuem tentativa de extracao ativa.
 *
 * `ENVIADO`/`EM_ANALISE` NAO e criterio novo: e a mesma leitura que
 * `automationReadiness` e `documentExtractionReview` ja fazem — "ha arquivo, mas
 * ninguem aprovou/conferiu". `APROVADO` ja passou por pessoa e extrair depois nao
 * muda decisao; `REJEITADO` esta fora; e `PENDENTE` e estado de DOMINIO para
 * "exigido mas nao enviado" — nao ha arquivo, nao ha o que extrair.
 *
 * A exclusao vem por lista, nao por filtro de relacao: o conjunto de ativos e
 * pequeno (uma por documento, pelo indice parcial) e a consulta fica expressavel
 * sem relacao — mais simples de ler e de cobrir por teste.
 *
 * `select: { id: true }` E O GATE: `originalFileName`, `sha256`, `storageKey` e
 * ate `processId` nem chegam a sair da tabela. Quem enfileira nao precisa saber
 * de quem e o documento — precisa saber que ele existe e esta esperando.
 */
export function listDocumentsAwaitingExtraction(
  limit: number,
  excludeDocumentIds: readonly string[],
): Promise<{ id: string }[]> {
  if (limit <= 0) return Promise.resolve([]);

  return getPrisma().processDocument.findMany({
    where: {
      status: { in: ["ENVIADO", "EM_ANALISE"] },
      id: { notIn: [...excludeDocumentIds] },
    },
    orderBy: OLDEST_FIRST,
    take: limit,
    select: { id: true },
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

/**
 * Desfaz a revisao do documento: volta para `ENVIADO` e LIMPA os campos que
 * descrevem a revisao (docs/50 §5).
 *
 * Limpar nao e apagar historico: quem revisou e quando continua na trilha
 * append-only de `ProcessStatusEvent`. Estes campos descrevem a revisao ATUAL —
 * mante-los depois de desfaze-la faria o documento afirmar uma conferencia que
 * deixou de valer.
 *
 * `rejectionReason` entra na limpeza pelo mesmo motivo: e parte da revisao
 * desfeita. `updateDocumentReview` ja o anula em toda aprovacao.
 */
export function reopenDocumentForReview(documentId: string) {
  return getPrisma().processDocument.update({
    where: { id: documentId },
    data: {
      status: "ENVIADO",
      reviewedByMockUserId: null,
      reviewedByRole: null,
      reviewedAt: null,
      rejectionReason: null,
    },
  });
}

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
