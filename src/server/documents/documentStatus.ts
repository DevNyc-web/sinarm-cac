/**
 * Fundacao do modulo de documentos — STATUS de documento (dominio).
 *
 * Superset do enum Prisma `DocumentStatus` (PENDENTE, ENVIADO, EM_ANALISE,
 * APROVADO, REJEITADO). Os estados extras SUBSTITUIR e DISPENSADO sao de
 * DOMINIO/UI por enquanto — NAO existem no schema e nao sao persistidos ate
 * uma decisao de migration (docs/12 §10). Nada aqui altera o banco.
 */
import type { DocumentStatus as PrismaDocumentStatus } from "@prisma/client";

/** Estados de documento do dominio (amigaveis para a UI). */
export const DOCUMENT_STATES = [
  "PENDENTE",
  "ENVIADO",
  "EM_ANALISE",
  "APROVADO",
  "REJEITADO",
  "SUBSTITUIR",
  "DISPENSADO",
] as const;

export type DocumentState = (typeof DOCUMENT_STATES)[number];

/** Rotulos amigaveis exibidos ao usuario/operador. */
export const DOCUMENT_STATE_LABELS: Record<DocumentState, string> = {
  PENDENTE: "Pendente",
  ENVIADO: "Enviado",
  EM_ANALISE: "Em análise",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  SUBSTITUIR: "Enviar nova versão",
  DISPENSADO: "Dispensado",
};

/**
 * Estados que HOJE existem no enum Prisma e podem ser persistidos.
 * SUBSTITUIR e DISPENSADO ficam de fora ate uma decisao de schema.
 */
export const PERSISTED_DOCUMENT_STATES: readonly DocumentState[] = [
  "PENDENTE",
  "ENVIADO",
  "EM_ANALISE",
  "APROVADO",
  "REJEITADO",
];

export function documentStateLabel(state: DocumentState): string {
  return DOCUMENT_STATE_LABELS[state];
}

/** `true` se o estado pode ser gravado no banco sem mudanca de schema. */
export function isPersistedState(state: DocumentState): boolean {
  return (PERSISTED_DOCUMENT_STATES as readonly string[]).includes(state);
}

/** Converte o status persistido (Prisma) para o estado de dominio (nomes coincidem). */
export function fromPrismaDocumentStatus(status: PrismaDocumentStatus): DocumentState {
  return status;
}
