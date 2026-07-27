/**
 * Token de sessao OPACO + HMAC no cookie.
 *
 * Desenho:
 * - `token`     — 32 bytes de CSPRNG, base64url. E o segredo que vive no cookie.
 * - `tokenHash` — SHA-256 do token, em hex. E o que vai para o banco. Vazamento
 *                 da tabela `sessions` NAO concede sessao, porque o token nao
 *                 esta la.
 * - `cookie`    — `<token>.<hmac>`. O HMAC permite rejeitar cookie adulterado
 *                 ANTES de consultar o banco — e, tao importante quanto, torna o
 *                 teste de adulteracao executavel SEM Postgres (o CI nao tem).
 *
 * Nada aqui tem relacao com sessao de Gov.br/SINARM: e a sessao do NOSSO app.
 * Cookie/token de orgao oficial continua proibido (docs/00 §8).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Entropia do token. 32 bytes = 256 bits. */
export const SESSION_TOKEN_BYTES = 32;

/** Comprimento minimo do segredo de assinatura (espelha o envSchema). */
export const SESSION_SECRET_MIN_LENGTH = 32;

/** Validade padrao da sessao. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PART_SEPARATOR = ".";

/**
 * Falha FECHADA: sem segredo utilizavel, nao emitimos nem validamos sessao.
 * Chamado no modo real; o modo mock nunca chega aqui.
 */
export function assertSessionSecret(secret: string | undefined): asserts secret is string {
  if (typeof secret !== "string" || secret.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(
      `AUTH_SESSION_SECRET ausente ou curto demais (minimo ${SESSION_SECRET_MIN_LENGTH} caracteres).`,
    );
  }
}

/** SHA-256 do token, em hex — o valor que o banco guarda. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function sign(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token, "utf8").digest("base64url");
}

export interface IssuedSession {
  /** Vai para o cookie. */
  cookieValue: string;
  /** Vai para o banco. */
  tokenHash: string;
}

/**
 * Emite uma sessao nova. Chamado a cada login — token novo sempre, o que fecha
 * fixacao de sessao.
 */
export function issueSessionToken(secret: string): IssuedSession {
  assertSessionSecret(secret);
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  return {
    cookieValue: `${token}${PART_SEPARATOR}${sign(token, secret)}`,
    tokenHash: hashSessionToken(token),
  };
}

/**
 * Valida o cookie e devolve o `tokenHash` para consulta.
 *
 * `null` para qualquer defeito — formato errado, assinatura invalida, segredo
 * ausente. NUNCA lanca: cookie e entrada hostil, e um throw viraria 500.
 */
export function parseSessionCookie(
  cookieValue: string | undefined,
  secret: string | undefined,
): { tokenHash: string } | null {
  if (typeof cookieValue !== "string" || cookieValue.length === 0) return null;
  if (typeof secret !== "string" || secret.length < SESSION_SECRET_MIN_LENGTH) return null;

  // Exatamente duas partes: `token.hmac`. Ponto a mais e cookie forjado.
  const parts = cookieValue.split(PART_SEPARATOR);
  if (parts.length !== 2) return null;
  const [token, providedSignature] = parts;
  if (!token || !providedSignature) return null;

  const expected = Buffer.from(sign(token, secret), "utf8");
  const provided = Buffer.from(providedSignature, "utf8");
  // Comparar comprimento primeiro: `timingSafeEqual` lanca com tamanhos diferentes.
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  return { tokenHash: hashSessionToken(token) };
}

/** Instante de expiracao a partir de agora. */
export function sessionExpiryFrom(now: Date, ttlMs: number = SESSION_TTL_MS): Date {
  return new Date(now.getTime() + ttlMs);
}

/** `true` quando a sessao ja passou da validade. */
export function isSessionExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}
