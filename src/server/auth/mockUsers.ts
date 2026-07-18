/**
 * Usuarios FICTICIOS de desenvolvimento — Fase 2 (docs/15 §3.8/§3.9).
 *
 * ATENCAO:
 * - Nenhum dado aqui e real. Sem CPF, sem PII, sem conta real (docs/16 §12).
 * - Estes usuarios NAO devem existir em producao. Quando o provedor real de auth
 *   entrar, este arquivo e deletado inteiro — nada mais depende dele alem de
 *   `session.ts`.
 */
import { type Role } from "./roles";

export type AuthUser = {
  id: string;
  /** Nome ficticio, apenas para navegar a UI. */
  name: string;
  /** E-mail ficticio em dominio de exemplo (RFC 2606). */
  email: string;
  role: Role;
};

export const MOCK_USERS: readonly AuthUser[] = [
  {
    id: "mock-user",
    name: "Usuario Exemplo",
    email: "usuario@example.com",
    role: "USER",
  },
  {
    id: "mock-admin",
    name: "Admin Exemplo",
    email: "admin@example.com",
    role: "ADMIN",
  },
  {
    id: "mock-operador",
    name: "Operador Exemplo",
    email: "operador@example.com",
    role: "OPERADOR",
  },
  {
    id: "mock-financeiro",
    name: "Financeiro Exemplo",
    email: "financeiro@example.com",
    role: "FINANCEIRO",
  },
  {
    id: "mock-suporte",
    name: "Suporte Exemplo",
    email: "suporte@example.com",
    role: "SUPORTE",
  },
];

export function findMockUser(id: string): AuthUser | null {
  return MOCK_USERS.find((user) => user.id === id) ?? null;
}
