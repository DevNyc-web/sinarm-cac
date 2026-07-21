/**
 * Fundacao do modulo de documentos — TIPOS de documento (dominio).
 *
 * Esta e uma camada de DOMINIO em TypeScript, um superset conceitual do enum
 * Prisma `DocumentType` (que hoje so tem IDENTIFICACAO_PESSOAL e OUTRO). Nao
 * altera o schema: para persistir, `toPrismaDocumentType` mapeia o tipo de
 * dominio para o valor persistivel mais proximo (docs/12 §3.6).
 *
 * Sem OCR, sem IA, sem rede. So contrato/rotulo.
 */
import type { DocumentType as PrismaDocumentType } from "@prisma/client";

/** Tipos de documento do dominio (Guia de Trafego e futuros). */
export const DOCUMENT_KINDS = [
  "IDENTIFICACAO_PESSOAL",
  "CR_REGISTRO_CAC",
  "COMPROVANTE_ORIGEM_ENDERECO",
  "DECLARACAO_DESTINO_EVENTO",
  "COMPLEMENTAR",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Rotulos amigaveis em portugues (identificadores em ingles/enum — docs/16 §5). */
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  IDENTIFICACAO_PESSOAL: "Documento de identificação pessoal",
  CR_REGISTRO_CAC: "CR / registro / autorização (CAC)",
  COMPROVANTE_ORIGEM_ENDERECO: "Comprovante de origem / endereço",
  DECLARACAO_DESTINO_EVENTO: "Declaração do destino / evento / clube",
  COMPLEMENTAR: "Documento complementar",
};

export function documentKindLabel(kind: DocumentKind): string {
  return DOCUMENT_KIND_LABELS[kind];
}

/**
 * Ponte de persistencia (SEM alterar o schema): o enum Prisma so tem
 * IDENTIFICACAO_PESSOAL e OUTRO. Qualquer tipo de dominio que nao seja
 * identificacao persiste como OUTRO ate uma decisao de schema.
 */
export function toPrismaDocumentType(kind: DocumentKind): PrismaDocumentType {
  return kind === "IDENTIFICACAO_PESSOAL" ? "IDENTIFICACAO_PESSOAL" : "OUTRO";
}
