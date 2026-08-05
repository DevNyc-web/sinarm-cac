/**
 * Rotas de ENTRADA e de DESTINO por perfil — separacao cliente/equipe
 * (docs/61 §4.D, docs/64 §6.1).
 *
 * Vive fora das Server Actions por dois motivos:
 * 1. arquivo `"use server"` so pode exportar funcao async — estas sao puras;
 * 2. sendo puras, o teste checa a regra sem subir Next, sessao ou banco.
 *
 * ATENCAO — isto e ROTEAMENTO, NAO AUTORIZACAO. Mandar alguem para `/admin`
 * nao concede acesso a `/admin`: quem decide e `requireAdminRole` /
 * `requirePermission` no servidor (docs/68 §3.1). Se um dia estas funcoes
 * mentirem, o pior caso e um redirect errado que termina em `/login?motivo=perfil`
 * — nunca um acesso indevido.
 *
 * Modulo PURO: sem I/O, sem rede, sem Prisma, sem React.
 */
import { isInternalRole, type Role } from "./roles";

/** Para onde o perfil vai DEPOIS de entrar. */
export function destinationFor(role: Role): string {
  return isInternalRole(role) ? "/admin" : "/dashboard";
}

/**
 * Porta de ENTRADA do perfil — para onde devolver depois do logout.
 *
 * Sem isto, quem opera sai do painel e cai na tela do cliente, com "criar minha
 * conta" e "acompanhar seus pedidos": a mistura que o bloco D desfaz.
 */
export function entryPathFor(role: Role): string {
  return isInternalRole(role) ? "/equipe" : "/login";
}

/**
 * Traduz o campo `origem` do formulario na porta correspondente.
 *
 * ALLOWLIST, nao passagem: o valor vem do cliente e vira alvo de `redirect`.
 * Devolver a string crua seria open redirect — qualquer coisa fora do conjunto
 * conhecido cai em `/login`.
 */
export function originEntryPath(origem: unknown): string {
  return origem === "equipe" ? "/equipe" : "/login";
}
