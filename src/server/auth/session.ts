/**
 * Sessao do PRODUTO — dois modos, sem ponte entre eles.
 *
 * - **mock** (`AUTH_MODE=mock`): cookie com o id de um perfil ficticio. NAO e
 *   autenticacao: sem senha, sem assinatura, sem MFA. So destrava a navegacao em
 *   desenvolvimento.
 * - **real** (`AUTH_MODE=real`): cookie `<token>.<hmac>`; o banco guarda apenas o
 *   SHA-256 do token. Cookie adulterado morre na verificacao do HMAC, antes de
 *   qualquer consulta.
 *
 * REGRA DURA: **o modo real NUNCA cai no fallback estatico.** Os dois caminhos usam
 * cookies de nomes diferentes e funcoes diferentes; nao ha ramo em que o modo real
 * alcance `findMockUser`.
 *
 * A sessao aqui e do NOSSO app. Sessao/cookie de Gov.br/SINARM continua proibida
 * de ser criada ou persistida (docs/00 §8).
 */
import { cookies } from "next/headers";
import {
  createSession,
  deleteSessionByTokenHash,
  findSessionByTokenHash,
  touchSession,
} from "@/server/repositories/sessionRepository";
import { findUserById, findUserByIdWithSecrets } from "@/server/repositories/userRepository";
import { resolveSession, revokeSession } from "./authenticate";
import { getAuthMode, getSessionSecret, isMockAuth } from "./config";
import { findMockUser } from "./mockUsers";
import {
  assertSessionSecret,
  issueSessionToken,
  parseSessionCookie,
  sessionExpiryFrom,
} from "./sessionToken";
import { type AuthUser } from "./types";

/** Cookie do modo MOCK. Nome distinto de proposito: os modos nao se misturam. */
export const SESSION_COOKIE = "cac_mock_session";

/** Cookie do modo REAL. */
export const REAL_SESSION_COOKIE = "cac_session";

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    // Em dev o app roda em http://localhost; `secure` ali impediria o cookie.
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

// ----------------------------------------------------------------- modo mock

/**
 * Resolve o usuario do cookie mock.
 *
 * O banco e a autoridade: `null` dele significa "nao existe ou esta inativo" e
 * NEGA. O fallback estatico so cobre banco indisponivel — e so existe aqui.
 */
async function resolveMockUser(userId: string): Promise<AuthUser | null> {
  try {
    return await findUserById(userId);
  } catch {
    return findMockUser(userId);
  }
}

// ----------------------------------------------------------------- modo real

/** Le a sessao real: valida o HMAC, consulta o banco, confere validade e usuario. */
async function resolveRealUser(cookieValue: string | undefined): Promise<AuthUser | null> {
  const parsed = parseSessionCookie(cookieValue, getSessionSecret());
  if (!parsed) return null;

  const user = await resolveSession(parsed.tokenHash, {
    findSessionByTokenHash,
    findUserById: findUserByIdWithSecrets,
    deleteSessionByTokenHash,
  });

  if (user) void touchSession(parsed.tokenHash);
  return user;
}

/**
 * Inicia a sessao real de um usuario JA autenticado por `login()`.
 * Token novo a cada chamada — fecha fixacao de sessao.
 */
export async function startRealSession(userId: string): Promise<void> {
  const secret = getSessionSecret();
  assertSessionSecret(secret);

  const { cookieValue, tokenHash } = issueSessionToken(secret);
  await createSession({ userId, tokenHash, expiresAt: sessionExpiryFrom(new Date()) });

  const store = await cookies();
  store.set(REAL_SESSION_COOKIE, cookieValue, cookieOptions());
}

// -------------------------------------------------------------------- comum

/** Le a sessao atual. `null` quando nao ha usuario autenticado. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();

  if (isMockAuth()) {
    const userId = store.get(SESSION_COOKIE)?.value;
    return userId ? resolveMockUser(userId) : null;
  }

  return resolveRealUser(store.get(REAL_SESSION_COOKIE)?.value);
}

/**
 * Inicia sessao mock. Recusa em modo real — nao pode existir atalho que ignore
 * senha quando o produto esta em producao.
 */
export async function signInAsMockUser(userId: string): Promise<boolean> {
  if (!isMockAuth()) return false;
  if (!(await resolveMockUser(userId))) return false;

  const store = await cookies();
  store.set(SESSION_COOKIE, userId, cookieOptions());
  return true;
}

/**
 * Encerra a sessao. No modo real REVOGA a linha no banco antes de limpar o
 * cookie — logout sem revogacao deixaria o token valido em quem o copiou.
 *
 * O cookie e apagado mesmo se a revogacao falhar.
 */
export async function signOut(): Promise<void> {
  const store = await cookies();

  if (getAuthMode() === "real") {
    const parsed = parseSessionCookie(store.get(REAL_SESSION_COOKIE)?.value, getSessionSecret());
    try {
      await revokeSession(parsed?.tokenHash ?? null, { deleteSessionByTokenHash });
    } catch {
      // Banco fora do ar nao pode impedir o usuario de sair da sessao local.
    }
  }

  store.delete(REAL_SESSION_COOKIE);
  store.delete(SESSION_COOKIE);
}
