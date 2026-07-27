/**
 * Usuarios FICTICIOS de desenvolvimento — Fase 2 (docs/15 §3.8/§3.9).
 *
 * ATENCAO:
 * - Nenhum dado aqui e real. Sem CPF, sem PII, sem conta real (docs/16 §12).
 * - Estes usuarios NAO devem existir em producao. Quando o provedor real de auth
 *   entrar, a lista some — o tipo `AuthUser` e que permanece.
 *
 * PAPEL DEPOIS DA FUNDACAO DE AUTH: a fonte de verdade passou a ser a tabela
 * `users` (ver `userRepository.ts`). Este arquivo continua por dois motivos:
 *
 * 1. **`AuthUser` e o contrato estavel** consumido por `guards.ts` e por varios
 *    services — mante-lo aqui evita cascata de tipos no PR de fundacao;
 * 2. **`MOCK_USERS` e o fallback de DEV**: o seletor de perfil do login e o
 *    `getCurrentUser` degradam para esta lista quando o banco esta fora do ar,
 *    seguindo o padrao do resto do app ("degradar com aviso, sem quebrar").
 *
 * O fallback vale SOMENTE em `AUTH_MODE === "mock"`. Quando o modo real entrar,
 * ele precisa ser removido junto — fallback estatico em auth real seria um
 * bypass de autenticacao.
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

/**
 * Ids esperados no seed. Travado por teste: se alguem renomear um id aqui sem
 * atualizar `prisma/seed.ts`, a FK `processes.user_id` passa a apontar para um
 * usuario inexistente no banco recem-semeado.
 */
export const SEEDED_USER_IDS: readonly string[] = MOCK_USERS.map((user) => user.id);
