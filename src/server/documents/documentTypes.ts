/**
 * Modulo de documentos — TIPOS de documento (dominio).
 *
 * Camada de DOMINIO em TypeScript espelhada no enum Prisma `DocumentType`.
 * Desde a Fase de upload por tipo, o enum persiste IDENTIFICACAO_PESSOAL,
 * CR_REGISTRO_CAC, COMPROVANTE_ORIGEM_ENDERECO e DECLARACAO_DESTINO_EVENTO com
 * o proprio valor; apenas COMPLEMENTAR persiste como OUTRO (docs/12 §3.6).
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

/** `true` se o valor recebido (ex.: de um formulario) e um tipo de dominio valido. */
export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === "string" && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/**
 * Ponte de persistencia dominio -> Prisma.
 * Todos os tipos tem valor proprio no enum, exceto COMPLEMENTAR, que persiste
 * como OUTRO (valor generico ja existente — evita dois valores com o mesmo
 * significado no enum).
 */
export function toPrismaDocumentType(kind: DocumentKind): PrismaDocumentType {
  return kind === "COMPLEMENTAR" ? "OUTRO" : kind;
}

/**
 * Volta de Prisma -> dominio. OUTRO vira COMPLEMENTAR: e o unico tipo de
 * dominio que persiste como OUTRO, entao a ida e a volta sao consistentes.
 */
export function fromPrismaDocumentType(type: PrismaDocumentType): DocumentKind {
  return type === "OUTRO" ? "COMPLEMENTAR" : type;
}
