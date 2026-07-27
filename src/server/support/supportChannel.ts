/**
 * Canal de suporte por WhatsApp (dominio quase puro — le apenas uma env).
 *
 * NENHUM numero real vive no codigo. O link vem de `SUPPORT_WHATSAPP_URL`; sem
 * essa env o botao aparece desabilitado, com a explicacao de que o canal ainda
 * nao foi configurado neste ambiente.
 *
 * Le `process.env` DIRETO, e nao `getEnv()`, pelo mesmo motivo documentado em
 * `isMockAuthForDisplay` (src/server/auth/config.ts): este valor e consumido no
 * caminho de RENDER, que o `next build` executa no prerender sem
 * `DATABASE_URL`. Disparar a validacao completa do ambiente ali quebraria o
 * build. A env tambem esta declarada em `envSchema` (documentacao + validacao
 * nos caminhos de runtime).
 *
 * FAIL-SOFT de proposito: link mal configurado degrada para "sem canal", nunca
 * para um link quebrado ou para um destino que nao controlamos.
 */

/** Hosts aceitos. Fora dessa lista, o valor e tratado como invalido. */
const ALLOWED_WHATSAPP_HOSTS = ["wa.me", "api.whatsapp.com", "web.whatsapp.com"] as const;

export type SupportChannel =
  | { available: true; url: string }
  | { available: false; reason: "nao-configurado" | "url-invalida" };

/**
 * Resolve o canal de suporte a partir do valor bruto da env.
 *
 * Aceita apenas `https://` em um dos hosts de WhatsApp conhecidos. Qualquer
 * outra coisa (http, host estranho, texto solto, numero cru) e recusada.
 */
export function resolveWhatsAppSupport(
  rawUrl: string | undefined = process.env.SUPPORT_WHATSAPP_URL,
): SupportChannel {
  const value = rawUrl?.trim();
  if (!value) return { available: false, reason: "nao-configurado" };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { available: false, reason: "url-invalida" };
  }

  if (parsed.protocol !== "https:") return { available: false, reason: "url-invalida" };

  const host = parsed.hostname.toLowerCase();
  if (!(ALLOWED_WHATSAPP_HOSTS as readonly string[]).includes(host)) {
    return { available: false, reason: "url-invalida" };
  }

  return { available: true, url: parsed.toString() };
}

/** Mensagem exibida quando nao ha canal utilizavel, por motivo. */
export const SUPPORT_UNAVAILABLE_TEXT: Record<
  Extract<SupportChannel, { available: false }>["reason"],
  string
> = {
  "nao-configurado": "O canal de suporte ainda não está configurado neste ambiente.",
  "url-invalida":
    "O canal de suporte está configurado com um endereço inválido e foi desativado por segurança.",
};

/** Aviso de seguranca que acompanha o botao de suporte. */
export const SUPPORT_SAFETY_NOTE =
  "Nossa equipe nunca pede senha, código ou token do Gov.br — por nenhum canal. Se receber um pedido desses, não responda e nos avise.";
