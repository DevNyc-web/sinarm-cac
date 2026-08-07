/**
 * Guard de rede do laboratório LOCAL de Playwright — regra FECHADA de loopback.
 *
 * Independente de propósito: não importa `phase9/networkGuard.ts` nem
 * `sessionContract.ts`. O padrão de duplicar o mesmo regex proibido por módulo
 * já existe no resto da Fase 2 (ver comentário em `sessionContract.ts`) — é
 * assim que cada camada continua podendo ser auditada sozinha, sem depender de
 * mudança em módulo alheio.
 *
 * Módulo PURO: só faz parsing de URL — nada de rede, nada de Playwright, nada
 * de I/O. `attachLoopbackRequestGuard` (que TOCA Playwright) mora no adaptador,
 * não aqui.
 *
 * Regra: só `http://localhost[:porta]` e `http://127.0.0.1[:porta]` passam.
 * HTTPS externo, domínio, subdomínio, IP não loopback, esquema desconhecido e
 * qualquer host da lista proibida (Gov.br/SINARM/PF/acesso.gov) são recusados
 * — mesmo vindo de parâmetro ou variável de ambiente, ANTES de abrir o
 * navegador.
 */

/** Únicos hosts aceitos. Lista fechada — não é allow-list ampla. */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);

/** Espelha o padrão proibido do resto da Fase 2 — bloqueio duro, mesmo se o host parecer loopback. */
const FORBIDDEN_HOST_PATTERN = /gov\.br|servicos\.pf|sinarm|acesso\.gov/i;

/** Esquemas sem rede real — nunca contam como "saiu do loopback". */
const NON_NETWORK_SCHEME_PATTERN = /^(about|data|blob):/i;

export interface LoopbackUrlCheck {
  allowed: boolean;
  host: string | null;
  reason: string;
}

/**
 * `true` só para `http://localhost[:porta]/...` e `http://127.0.0.1[:porta]/...`
 * (e `about:`/`data:`/`blob:`, que não são rede). Qualquer outra coisa — HTTPS,
 * domínio, subdomínio, IP remoto, esquema desconhecido — é `false`.
 */
export function isLoopbackUrl(rawUrl: string): boolean {
  return checkLoopbackUrl(rawUrl).allowed;
}

/** Mesma regra, com o motivo — para evidência/violação tipada em vez de um booleano cego. */
export function checkLoopbackUrl(rawUrl: string): LoopbackUrlCheck {
  if (NON_NETWORK_SCHEME_PATTERN.test(rawUrl)) {
    return { allowed: true, host: null, reason: "esquema sem rede (about/data/blob)" };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, host: null, reason: "URL malformada" };
  }

  if (FORBIDDEN_HOST_PATTERN.test(rawUrl)) {
    return { allowed: false, host: url.hostname, reason: "host proibido (Gov.br/SINARM/PF/acesso.gov)" };
  }

  if (url.protocol !== "http:") {
    return { allowed: false, host: url.hostname, reason: `esquema não aceito: ${url.protocol}` };
  }

  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    return { allowed: false, host: url.hostname, reason: "host fora do loopback (localhost/127.0.0.1)" };
  }

  return { allowed: true, host: url.hostname, reason: "loopback" };
}

/**
 * Valida a base URL do adaptador ANTES de qualquer `chromium.launch()`. Mesmo
 * que a URL venha de parâmetro ou `process.env`, ela passa por aqui primeiro —
 * o navegador nunca abre para uma origem recusada.
 */
export function assertLoopbackBaseUrl(rawUrl: string): LoopbackUrlCheck {
  const check = checkLoopbackUrl(rawUrl);
  if (check.host === null && check.allowed) {
    // about:/data:/blob: não é uma base URL válida para navegar o laboratório.
    return { allowed: false, host: null, reason: "base URL precisa ser http://localhost ou http://127.0.0.1" };
  }
  return check;
}
