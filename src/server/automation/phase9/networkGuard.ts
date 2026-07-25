/**
 * Fase 9 — Guard de rede / allowlist (docs/35 §10).
 *
 * Por padrao:
 * - externalAccessAllowed = false
 * - allowedHosts = ["localhost", "127.0.0.1"]
 *
 * Qualquer host fora disso e BLOQUEADO. Alem disso, dominios oficiais conhecidos
 * (Gov.br/SINARM/PF) sao SEMPRE bloqueados aqui — mesmo que alguem os coloque na
 * allowlist — porque a execucao real ainda NAO esta autorizada (docs/34 §16).
 * NAO adicionar Gov/SINARM na allowlist agora.
 */
import type { Phase9NetworkPolicy, Phase9UrlCheck } from "./types";

/** Allowlist default: apenas loopback local. */
export const PHASE9_DEFAULT_ALLOWED_HOSTS: readonly string[] = ["localhost", "127.0.0.1"];

/**
 * Dominios que NUNCA passam nesta fase, ainda que na allowlist (trava dura).
 * Enquanto a Fase 9 real nao for autorizada, nenhum acesso oficial e permitido.
 */
const FORBIDDEN_HOST_PATTERN = /(^|\.)(gov\.br|servicos\.pf|sinarm|acesso\.gov)$|gov\.br$|servicos\.pf|sinarm|acesso\.gov/i;

/** Esquemas que nao sao egress de rede (nao precisam de allowlist). */
const NON_NETWORK_SCHEME = /^(about|data|blob):/i;

/**
 * Cria a politica de rede da Fase 9. Sem argumentos: default seguro (so localhost,
 * sem acesso externo). Overrides sao permitidos para testes, mas o guard mantem a
 * trava dura contra dominios oficiais mesmo assim.
 */
export function createPhase9NetworkPolicy(
  overrides?: Partial<Phase9NetworkPolicy>,
): Phase9NetworkPolicy {
  return {
    externalAccessAllowed: false,
    allowedHosts: [...PHASE9_DEFAULT_ALLOWED_HOSTS],
    ...overrides,
  };
}

/** `true` somente se a politica habilitar acesso externo. Default: `false`. */
export function isExternalAccessAllowed(
  policy: Phase9NetworkPolicy = createPhase9NetworkPolicy(),
): boolean {
  return policy.externalAccessAllowed === true;
}

function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Decide se uma URL pode ser acessada sob a politica da Fase 9.
 * Nunca lanca excecao crua — retorna sempre um `Phase9UrlCheck`.
 */
export function assertUrlAllowed(
  url: string,
  policy: Phase9NetworkPolicy = createPhase9NetworkPolicy(),
): Phase9UrlCheck {
  if (typeof url !== "string" || url.trim() === "") {
    return { allowed: false, host: null, reason: "URL vazia ou invalida." };
  }

  // Esquemas nao-rede (about:/data:/blob:) nao sao egress — liberados.
  if (NON_NETWORK_SCHEME.test(url)) {
    return { allowed: true, host: null, reason: "Esquema nao-rede (sem egress)." };
  }

  const host = extractHost(url);
  if (host === null) {
    return { allowed: false, host: null, reason: "URL nao parseavel — bloqueada." };
  }

  // Trava dura: dominios oficiais NUNCA passam nesta fase.
  if (FORBIDDEN_HOST_PATTERN.test(host)) {
    return {
      allowed: false,
      host,
      reason: "Host oficial (Gov.br/SINARM/PF) bloqueado — Fase 9 real nao autorizada.",
    };
  }

  if (policy.allowedHosts.includes(host)) {
    return { allowed: true, host, reason: "Host na allowlist." };
  }

  return {
    allowed: false,
    host,
    reason: "Host fora da allowlist da Fase 9 — bloqueado.",
  };
}
