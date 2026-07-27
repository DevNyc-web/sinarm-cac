/**
 * Repositorio de usuarios — fundacao de auth.
 *
 * Ponto UNICO de leitura de usuario a partir do banco. `session.ts` consome daqui;
 * `guards.ts`/`permissions.ts` seguem intocados, porque continuam recebendo um
 * `AuthUser` e nao sabem de onde ele veio.
 *
 * `passwordHash` existe no banco mas SO SAI daqui pelas funcoes marcadas
 * `...WithSecrets`, consumidas exclusivamente pelo servico de auth. As demais
 * devolvem `AuthUser`, que nao tem o campo — a barreira e o tipo.
 *
 * MFA continua pendente (docs/23 §5, item 2).
 */
import { cache } from "react";
import { normalizeEmail } from "@/server/auth/authenticate";
import { type Role } from "@/server/auth/roles";
import { type AuthUser } from "@/server/auth/types";
import { getPrisma } from "@/server/db/prisma";

/** Colunas expostas ao app. Nunca selecionar mais do que o necessario. */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
} as const;

/** Acrescenta o hash. Uso restrito ao servico de auth. */
const USER_SELECT_WITH_SECRETS = { ...USER_SELECT, passwordHash: true } as const;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

type UserRowWithSecrets = UserRow & { passwordHash: string | null };

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

/**
 * Busca por e-mail, usando a MESMA normalizacao da escrita (`normalizeEmail`).
 *
 * Antes daqui a leitura fazia `toLowerCase()` e a escrita nao normalizava nada —
 * com indice unico case-sensitive, isso deixaria `Fulano@Example.com` gravado e
 * inencontravel no login. Agora as duas pontas usam a mesma funcao.
 *
 * NAO filtra por `active`: o servico de auth precisa distinguir "nao existe" de
 * "existe e esta inativo" para tratar os dois com a MESMA resposta, mas gastando
 * o mesmo tempo. Filtrar aqui devolveria `null` cedo demais e encurtaria o
 * caminho do usuario inativo — diferenca de tempo observavel.
 */
export async function findUserByEmailWithSecrets(
  email: string,
): Promise<(AuthUser & { passwordHash: string | null; active: boolean }) | null> {
  const row = (await getPrisma().user.findUnique({
    where: { email: normalizeEmail(email) },
    select: USER_SELECT_WITH_SECRETS,
  })) as UserRowWithSecrets | null;

  if (!row) return null;
  return { ...toAuthUser(row), passwordHash: row.passwordHash, active: row.active };
}

/** Variante publica: nunca devolve hash, e so usuario ativo. */
export const findUserByEmail = cache(async (email: string): Promise<AuthUser | null> => {
  const row = await getPrisma().user.findFirst({
    where: { email: normalizeEmail(email), active: true },
    select: USER_SELECT,
  });
  return row ? toAuthUser(row) : null;
});

/** Como `findUserById`, porem com o hash — uso exclusivo do servico de auth. */
export async function findUserByIdWithSecrets(
  id: string,
): Promise<(AuthUser & { passwordHash: string | null; active: boolean }) | null> {
  const row = (await getPrisma().user.findUnique({
    where: { id },
    select: USER_SELECT_WITH_SECRETS,
  })) as UserRowWithSecrets | null;

  if (!row) return null;
  return { ...toAuthUser(row), passwordHash: row.passwordHash, active: row.active };
}

/**
 * Cria um CLIENTE. `role` e literal `"USER"` no tipo e no `data` — perfil interno
 * nao nasce de cadastro publico, e nenhum campo do formulario alcanca este valor.
 */
export async function createClientUser(data: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<AuthUser> {
  const row = await getPrisma().user.create({
    data: {
      name: data.name,
      email: normalizeEmail(data.email),
      passwordHash: data.passwordHash,
      role: "USER",
      active: true,
    },
    select: USER_SELECT,
  });
  return toAuthUser(row);
}

/** Regrava o hash — usado na migracao transparente de custo/algoritmo no login. */
export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await getPrisma().user.update({ where: { id: userId }, data: { passwordHash } });
}

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
