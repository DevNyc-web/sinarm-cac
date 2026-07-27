/**
 * Modo de autenticacao do app.
 *
 * - `"mock"` — perfis ficticios de desenvolvimento (docs/15 §3.8/§3.9). Sem senha,
 *   sem MFA, sem verificacao de identidade. **Nao usar em producao.**
 * - `"real"` — e-mail/senha do PRODUTO, com sessao opaca assinada.
 *
 * A senha do modo real e do NOSSO app. Credencial de Gov.br/SINARM continua
 * proibida (docs/00 §8): aquele login o usuario faz na janela oficial, e nos
 * nunca vemos, recebemos ou guardamos.
 *
 * MFA continua PENDENTE e e obrigatorio antes de producao (docs/23 §5, item 2).
 */
import { getEnv } from "@/server/config/env";

export type AuthMode = "mock" | "real";

/**
 * Lido de env A CADA chamada, e nao numa constante de modulo: constante seria
 * capturada no import e ficaria congelada entre ambientes.
 *
 * Usa `getEnv()`, que VALIDA o ambiente inteiro — logo, so pode ser chamado em
 * runtime de requisicao. Para renderizacao (que o `next build` executa no
 * prerender, sem `DATABASE_URL`), use `isMockAuthForDisplay`.
 */
export function getAuthMode(): AuthMode {
  return getEnv().AUTH_MODE;
}

/** `true` no modo de desenvolvimento com perfis ficticios. Decisao de SEGURANCA. */
export function isMockAuth(): boolean {
  return getAuthMode() === "mock";
}

/**
 * Versao para RENDERIZACAO: le `process.env` direto, sem disparar a validacao
 * completa do ambiente.
 *
 * Existe porque `getEnv()` no caminho de render quebra o `next build`: o
 * prerender roda sem `DATABASE_URL` (o CI nao tem banco) e a validacao aborta a
 * exportacao das paginas. Isso foi verificado removendo o `.env` e rodando o
 * build — falhou em `/admin/processos` com "DATABASE_URL: Required".
 *
 * NAO usar para autorizacao: o padrao aqui e "mock", que e o modo PERMISSIVO.
 * Decisao de acesso usa `isMockAuth()`, que falha ruidosamente se o ambiente
 * estiver mal configurado.
 */
export function isMockAuthForDisplay(): boolean {
  return (process.env.AUTH_MODE ?? "mock") !== "real";
}

/** Segredo de assinatura da sessao. `undefined` so e aceitavel em modo mock. */
export function getSessionSecret(): string | undefined {
  return getEnv().AUTH_SESSION_SECRET;
}

/** Aviso unico para deixar explicito em log que a auth NAO e real. */
export const AUTH_MODE_NOTICE =
  "Auth em modo mock/dev: sem provedor real, sem MFA, sem dados reais. Nao usar em producao.";
