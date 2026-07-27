/**
 * Repositorio de usuarios — fundacao de auth.
 *
 * Ponto UNICO de leitura de usuario a partir do banco. `session.ts` consome daqui;
 * `guards.ts`/`permissions.ts` seguem intocados, porque continuam recebendo um
 * `AuthUser` e nao sabem de onde ele veio.
 *
 * NAO ha senha, sessao nem MFA aqui: isto e fundacao, nao auth real. O provedor
 * real e o `passwordHash` entram no PR seguinte (docs/23 §5, itens 1 e 2).
 */
import { cache } from "react";
import { type AuthUser } from "@/server/auth/mockUsers";
import { type Role } from "@/server/auth/roles";
import { getPrisma } from "@/server/db/prisma";

/** Colunas expostas ao app. Nunca selecionar mais do que o necessario. */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
} as const;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

/** Converte a linha do banco no contrato que o app ja usa. */
function toAuthUser(row: UserRow): AuthUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role as Role };
}

/**
 * Busca um usuario ATIVO por id.
 *
 * `cache` do React deduplica a chamada dentro da MESMA requisicao: uma pagina que
 * chame `requireUser()` e depois `hasPermission()` faz uma consulta, nao duas.
 *
 * Usuario inativo devolve `null` — desativar em `users.active` derruba o acesso
 * sem apagar a trilha (por isso a FK e `Restrict`).
 */
export const findUserById = cache(async (id: string): Promise<AuthUser | null> => {
  const row = await getPrisma().user.findFirst({
    where: { id, active: true },
    select: USER_SELECT,
  });
  return row ? toAuthUser(row) : null;
});

/** Busca um usuario ATIVO por e-mail (base para o login real do proximo PR). */
export const findUserByEmail = cache(async (email: string): Promise<AuthUser | null> => {
  const row = await getPrisma().user.findFirst({
    where: { email: email.toLowerCase(), active: true },
    select: USER_SELECT,
  });
  return row ? toAuthUser(row) : null;
});

/**
 * Busca varios usuarios por id, ATIVOS OU NAO, e devolve um mapa id -> usuario.
 *
 * Inativo entra de proposito: quem assinou uma nota ou marcou um item de
 * checklist continua tendo nome na trilha depois de desativado. Auditoria nao
 * pode perder o autor porque a conta saiu.
 *
 * Uma consulta so, para evitar N+1 ao rotular atores de uma pagina inteira.
 */
export async function findUsersByIds(ids: readonly string[]): Promise<Map<string, AuthUser>> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  if (unique.length === 0) return new Map();

  const rows = await getPrisma().user.findMany({
    where: { id: { in: unique } },
    select: USER_SELECT,
  });
  return new Map(rows.map((row) => [row.id, toAuthUser(row)]));
}

/** Lista usuarios ativos — usada pelo seletor de perfil do login em modo mock. */
export const listActiveUsers = cache(async (): Promise<readonly AuthUser[]> => {
  const rows = await getPrisma().user.findMany({
    where: { active: true },
    select: USER_SELECT,
    orderBy: { email: "asc" },
  });
  return rows.map(toAuthUser);
});
