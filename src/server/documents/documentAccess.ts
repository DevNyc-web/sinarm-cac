/**
 * Acesso ao ARQUIVO de um documento do processo — decisao e headers (dominio puro).
 *
 * A rota `/api/documents/[documentId]/file` fica fina de proposito: toda a regra
 * de quem pode abrir o arquivo e de como o header e montado vive aqui, onde da
 * para testar sem banco, sem storage e sem HTTP.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */
import { roleHasPermission } from "@/server/auth/permissions";
import type { Role } from "@/server/auth/roles";

/**
 * Permissao que libera o arquivo para a equipe interna.
 *
 * E a MESMA de aprovar/rejeitar (`document.review`): quem decide sobre o
 * documento precisa ve-lo, e quem nao decide nao tem motivo para baixa-lo.
 * Perfis internos sem essa permissao nao passam.
 */
export const DOCUMENT_FILE_PERMISSION = "document.review" as const;

export type DocumentAccessInput = {
  actorId: string;
  actorRole: Role;
  /** Dono do processo ao qual o documento pertence. */
  ownerUserId: string;
};

export type DocumentAccessDecision = { allowed: true; as: "REVISOR" | "DONO" } | { allowed: false };

/**
 * Quem pode abrir o arquivo: o revisor autorizado ou o proprio dono do processo.
 *
 * Checar a permissao primeiro deixa claro que o acesso interno NAO depende de o
 * revisor ser dono de nada.
 */
export function decideDocumentAccess(input: DocumentAccessInput): DocumentAccessDecision {
  if (roleHasPermission(input.actorRole, DOCUMENT_FILE_PERMISSION)) {
    return { allowed: true, as: "REVISOR" };
  }
  if (input.actorId === input.ownerUserId) {
    return { allowed: true, as: "DONO" };
  }
  return { allowed: false };
}

/**
 * Tipos que aceitamos DEVOLVER. Espelha a allowlist do upload; qualquer outra
 * coisa vira octet-stream em vez de ser servida com o Content-Type gravado — o
 * mimeType veio do cliente no upload e nao vale confiar nele para renderizar.
 */
export const SERVABLE_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export const FALLBACK_MIME_TYPE = "application/octet-stream";

export function safeContentType(mimeType: string): string {
  return (SERVABLE_MIME_TYPES as readonly string[]).includes(mimeType)
    ? mimeType
    : FALLBACK_MIME_TYPE;
}

/** Caracteres de controle (CR/LF inclusos) — vetor de header injection. */
// eslint-disable-next-line no-control-regex -- o alvo do saneamento sao os proprios controles
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Fora da faixa ASCII imprimivel — sem lugar no `filename=` legado. */
const NON_ASCII_PRINTABLE = /[^\u0020-\u007e]/g;

/** Aspas e barra invertida quebrariam o valor entre aspas do header. */
const QUOTES_AND_BACKSLASH = /["\\]/g;

/**
 * Nome exibido no download.
 *
 * O nome ORIGINAL veio do cliente e vai para dentro de um header: remover CR/LF
 * e demais controles evita header injection; descartar diretorios, aspas e barra
 * invertida evita quebrar o header e evita sugerir caminho. Este nome nunca toca
 * o filesystem — a chave real do storage e outra.
 */
export function safeDownloadFileName(originalFileName: string): string {
  const base = originalFileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(CONTROL_CHARS, "")
    .replace(QUOTES_AND_BACKSLASH, "")
    .trim()
    .slice(0, 100);
  return cleaned || "documento";
}

/** Versao so-ASCII para o `filename=` legado (o `filename*` carrega o original). */
export function asciiDownloadFileName(fileName: string): string {
  const ascii = fileName.replace(NON_ASCII_PRINTABLE, "_").replace(QUOTES_AND_BACKSLASH, "");
  return ascii.trim() || "documento";
}

/**
 * Percent-encoding para a `ext-value` do `filename*` (RFC 8187 §3.2).
 *
 * `encodeURIComponent` NAO codifica `'`, `(`, `)` e `*`, que estao fora do
 * `attr-char` da RFC. O apostrofo e o pior deles: e o proprio delimitador de
 * `UTF-8''<valor>`, entao um nome como "Joao's doc.pdf" produziria um header
 * fora da gramatica. Os quatro sao codificados na mao.
 */
export function encodeExtValue(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export type DocumentHeadersInput = {
  mimeType: string;
  originalFileName: string;
  /** Tamanho REAL dos bytes lidos — nao o valor gravado no banco. */
  byteLength: number;
};

/**
 * Headers da resposta do arquivo.
 *
 * `attachment` + `nosniff` + CSP `sandbox`: mesmo que um dia entre um tipo
 * inesperado no storage, o navegador baixa em vez de executar no nosso dominio.
 * `no-store` porque documento de terceiro nao deve ficar em cache compartilhado.
 */
export function buildDocumentFileHeaders(input: DocumentHeadersInput): Record<string, string> {
  const fileName = safeDownloadFileName(input.originalFileName);
  const ascii = asciiDownloadFileName(fileName);

  return {
    "Content-Type": safeContentType(input.mimeType),
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeExtValue(fileName)}`,
    "Content-Length": String(input.byteLength),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "private, no-store",
  };
}

/** Caminho da rota do arquivo — fonte unica para a UI nao montar URL na mao. */
export function documentFileHref(documentId: string): string {
  return `/api/documents/${encodeURIComponent(documentId)}/file`;
}
