/**
 * Modo de autenticacao do app.
 *
 * Fase 2 roda em "mock": sessao local de desenvolvimento com usuarios ficticios
 * (docs/15 §3.8/§3.9). O provedor real ainda e PENDENTE e, junto com MFA, e
 * OBRIGATORIO antes de producao (docs/15 §8, item 6).
 *
 * Quando o provedor real entrar, este union ganha "real" e a escolha passa a vir
 * de env — hoje seria uma flag sem implementacao do outro lado.
 */
export type AuthMode = "mock";

export const AUTH_MODE: AuthMode = "mock";

/** Aviso unico para deixar explicito em log que a auth NAO e real. */
export const AUTH_MODE_NOTICE =
  "Auth em modo mock/dev: sem provedor real, sem MFA, sem dados reais. Nao usar em producao.";
