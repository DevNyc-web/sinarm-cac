/**
 * Contratos de autenticacao — validos em modo mock E em modo real.
 *
 * Este arquivo existe para que o caminho de auth REAL nao precise importar de
 * `mockUsers.ts`. O tipo morava la por historia, e um modulo de login de producao
 * dependendo de um arquivo chamado "mock" e exatamente o acoplamento que depois
 * confunde o que e desenvolvimento e o que e producao.
 */
import { type Role } from "./roles";

/**
 * Usuario como o APP o enxerga. Fronteira de saida do servico de auth.
 *
 * Repare no que NAO esta aqui: `passwordHash` e `active`. O tipo e a barreira
 * mais barata contra vazar hash em DTO, log ou payload RSC.
 */
export type AuthUser = {
  id: string;
  name: string;
  /** Sempre normalizado (minusculo, sem espaco nas pontas). */
  email: string;
  role: Role;
};
