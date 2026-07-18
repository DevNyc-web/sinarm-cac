/**
 * Perfis de usuario e perfis internos — Fase 2 (docs/11 §2, docs/15 §3.9).
 *
 * Nao depende de provedor de auth. Quando o provedor real entrar, estes tipos
 * continuam valendo — muda apenas de onde vem o `role` da sessao.
 */

/** Perfil do usuario final do app (cliente). */
export const USER_ROLE = "USER" as const;

/** Perfis internos da operacao (docs/11 §2). */
export const INTERNAL_ROLES = ["ADMIN", "OPERADOR", "FINANCEIRO", "SUPORTE"] as const;

export type InternalRole = (typeof INTERNAL_ROLES)[number];
export type Role = typeof USER_ROLE | InternalRole;

export const ROLES: readonly Role[] = [USER_ROLE, ...INTERNAL_ROLES];

/** Rotulos em portugues para a UI (identificadores ficam em ingles — docs/16 §5). */
export const ROLE_LABELS: Record<Role, string> = {
  USER: "Usuario",
  ADMIN: "Admin",
  OPERADOR: "Operador",
  FINANCEIRO: "Financeiro",
  SUPORTE: "Suporte",
};

export function isInternalRole(role: Role): role is InternalRole {
  return (INTERNAL_ROLES as readonly string[]).includes(role);
}
