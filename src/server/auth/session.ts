/**
 * Sessao MOCK/DEV — Fase 2 (docs/15 §3.8).
 *
 * Guarda apenas o id de um usuario ficticio num cookie. NAO e autenticacao:
 * nao ha senha, token assinado, MFA nem verificacao de identidade. Serve so
 * para destravar guards, layout autenticado e navegacao com dados ficticios.
 *
 * PONTO DE SUBSTITUICAO: quando o provedor real (Supabase Auth / Auth.js / outro)
 * for decidido, apenas `getCurrentUser` precisa passar a ler a sessao real —
 * `guards.ts` e `permissions.ts` seguem inalterados.
 *
 * MFA e provedor real sao OBRIGATORIOS antes de producao (docs/15 §8).
 */
import { cookies } from "next/headers";
import { findUserById } from "@/server/repositories/userRepository";
import { AUTH_MODE } from "./config";
import { findMockUser, type AuthUser } from "./mockUsers";

export const SESSION_COOKIE = "cac_mock_session";

/**
 * Resolve o usuario da sessao.
 *
 * Fonte de verdade: a tabela `users`. O fallback para a lista estatica cobre o
 * banco fora do ar em dev — mesmo padrao do resto do app ("degradar com aviso,
 * sem quebrar") — e vale SOMENTE em modo mock.
 *
 * REMOVER O FALLBACK junto com o modo real: em auth real, cair para uma lista
 * estatica quando o banco falha seria bypass de autenticacao, nao resiliencia.
 */
async function resolveUser(userId: string): Promise<AuthUser | null> {
  try {
    const user = await findUserById(userId);
    if (user) return user;
  } catch {
    // Banco indisponivel: em modo mock, segue para o fallback estatico.
  }
  return AUTH_MODE === "mock" ? findMockUser(userId) : null;
}

/** Le a sessao atual. Retorna null quando nao ha usuario "logado". */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (AUTH_MODE !== "mock") return null;

  const store = await cookies();
  const userId = store.get(SESSION_COOKIE)?.value;
  if (!userId) return null;

  return resolveUser(userId);
}

/** Inicia sessao mock. So pode ser chamado de Server Action / Route Handler. */
export async function signInAsMockUser(userId: string): Promise<boolean> {
  if (!(await resolveUser(userId))) return false;

  const store = await cookies();
  store.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return true;
}

/** Encerra a sessao mock. So pode ser chamado de Server Action / Route Handler. */
export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
