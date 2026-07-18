/**
 * Guards de rota — Fase 2.
 *
 * Toda pagina protegida chama um destes helpers no topo do Server Component.
 * A logica de perfil/permissao vive aqui e em `permissions.ts`; paginas nao
 * comparam `role` na mao.
 */
import { redirect } from "next/navigation";
import { type AuthUser } from "./mockUsers";
import { type Permission, permissionsForRole, roleHasPermission } from "./permissions";
import { INTERNAL_ROLES, isInternalRole, type InternalRole, type Role } from "./roles";
import { getCurrentUser } from "./session";

export { getCurrentUser };

/** Usuario autenticado do perfil informado? */
export function hasRole(user: AuthUser | null, role: Role): boolean {
  return user?.role === role;
}

/** Usuario tem a permissao (via matriz RBAC do docs/11 §3)? */
export function hasPermission(user: AuthUser | null, permission: Permission): boolean {
  return user ? roleHasPermission(user.role, permission) : false;
}

/** Permissoes efetivas do usuario — usado para exibir o que o perfil pode fazer. */
export function permissionsOf(user: AuthUser | null): readonly Permission[] {
  return user ? permissionsForRole(user.role) : [];
}

/**
 * Exige qualquer usuario autenticado (rotas de usuario).
 * Sem sessao -> /login.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?motivo=sessao");
  return user;
}

/**
 * Exige um perfil interno permitido (rotas admin).
 * Sem sessao -> /login; com sessao de perfil nao autorizado -> /login?motivo=perfil.
 *
 * @param allowed perfis internos aceitos; por padrao, qualquer perfil interno.
 */
export async function requireAdminRole(
  allowed: readonly InternalRole[] = INTERNAL_ROLES,
): Promise<AuthUser & { role: InternalRole }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?motivo=sessao");
  if (!isInternalRole(user.role) || !allowed.includes(user.role)) {
    redirect("/login?motivo=perfil");
  }
  return user as AuthUser & { role: InternalRole };
}

/**
 * Exige uma permissao especifica (granularidade da matriz RBAC).
 * Util quando a acao — nao a rota — e o que precisa ser protegido.
 */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?motivo=sessao");
  if (!roleHasPermission(user.role, permission)) redirect("/login?motivo=permissao");
  return user;
}
