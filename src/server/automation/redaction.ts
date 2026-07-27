/**
 * Fase 8D — Redacao/sanitizacao para o LABORATORIO SINTETICO (docs/37).
 *
 * Transforma qualquer valor (string/objeto/array) numa versao SEGURA para log e
 * relatorio: chaves de segredo viram `[REDACTED]` e valores sensiveis em claro
 * (CPF, RG, e-mail, telefone, sequencias longas de digitos) sao MASCARADOS.
 *
 * Modulo PURO: sem I/O, sem rede, sem Prisma, sem banco, sem React, sem
 * Playwright. Nao depende de nenhum modulo da Fase 9 — a implementacao aqui e
 * propria e independente (docs/37 §"relacao com o PR #1").
 *
 * Regra permanente (docs/00 §8): senha/OTP/cookie/token JAMAIS sao registrados,
 * nem mesmo mascarados — a CHAVE inteira e substituida, o valor nao sobrevive.
 *
 * DUAS camadas, com alcances diferentes (docs/41 §5):
 * 1. por CHAVE (`isSecretKey`) — o valor nunca e visitado;
 * 2. por CONTEUDO (`CREDENTIAL_PATTERNS`) — pega credencial escrita DENTRO de uma
 *    string: `Bearer <token>`, JWT, `senha=...`, `set-cookie: ...`, OTP por
 *    contexto.
 *
 * O que a camada 2 NAO promete: adivinhar segredo em prosa sem par
 * `chave=valor` — "a senha do usuario e Trov@dor2026" nao tem forma
 * reconhecivel e continua passando. Nesse caso a protecao e a camada 1: o campo
 * precisa ter nome de segredo. Nao ha backstop universal para texto livre.
 */

/** Marcador unico para chave de segredo removida. */
export const LAB_REDACTED = "[REDACTED]";

/** Marcadores de estrutura (nao sao segredo — sinalizam limite de travessia). */
export const LAB_CIRCULAR = "[CIRCULAR]";
export const LAB_DEPTH_LIMIT = "[DEPTH_LIMIT]";

/** Profundidade maxima de travessia; alem disso o ramo vira `LAB_DEPTH_LIMIT`. */
const MAX_DEPTH = 8;

/** Valor JSON seguro devolvido pela redacao. */
export type LabSafeValue =
  | string
  | number
  | boolean
  | null
  | LabSafeValue[]
  | { [key: string]: LabSafeValue };

export interface LabRedactionSummary {
  /** Chaves de segredo substituidas por `[REDACTED]`. */
  redactedKeys: number;
  /** Ocorrencias de padrao sensivel mascaradas dentro de valores. */
  maskedValues: number;
  /** Soma das duas — o total de itens redigidos. */
  total: number;
}

export interface LabRedactionResult<T = LabSafeValue> {
  value: T;
  summary: LabRedactionSummary;
}

/** Erro ja sanitizado (sem stack: caminhos/argv podem carregar segredo). */
export interface LabRedactedError {
  name: string;
  message: string;
}

// ------------------------------------------------------------------ chaves

/**
 * Termos INEQUIVOCOS de segredo: batem por SUBSTRING na chave normalizada, para
 * pegar tambem `govbrpassword`, `xAuthToken`, `set-cookie` etc.
 *
 * Criterio para entrar aqui: o termo nao pode aparecer DENTRO de uma palavra
 * legitima do dominio. Quando aparece, o termo vai para
 * `SECRET_KEY_EXACT_TOKENS` (ver a nota sobre `pin` lá embaixo).
 */
const SECRET_KEY_SUBSTRINGS = [
  "password",
  "passwd",
  "pwd",
  "senha",
  "token",
  "cookie",
  "authorization",
  "secret",
  "credential",
  "credencial",
  "bearer",
  "apikey",
  "accesskey",
  "privatekey",
  "sessionid",
  // --- ampliacao do hardening (docs/41 §5, achados A2/A3) ---
  "recoverycode",
  "signature",
  "assinatura",
  "hmac",
  "certificado",
  "chaveprivada",
  "chavesecreta",
] as const;

/**
 * Termos CURTOS/AMBIGUOS: so batem como TOKEN inteiro da chave. Evita que
 * `passo`/`passos` (portugues, usado nos steps do lab) seja confundido com
 * `pass`, e que `author` vire `auth`.
 *
 * `pin` esta AQUI, e nao nas substrings, de proposito: por substring ele casaria
 * dentro de `espingarda` (es-PIN-garda), `labStepInput` (Ste-pIn-put) e
 * `processTypeMapping` (Map-pin-g) — tipo de arma e nome de etapa sao EVIDENCIA
 * de auditoria e nao podem virar `[REDACTED]`.
 *
 * `codigo` e `chave` tambem sao tokens exatos. A tokenizacao quebra camelCase,
 * entao `codigoVerificacao` e `chavePrivada` continuam pegos pelo token; o
 * codebase usa `code`/`processTypeCode` em ingles para o codigo NAO sensivel,
 * de modo que reservar `codigo` para segredo nao conflita com o dominio.
 */
const SECRET_KEY_EXACT_TOKENS = new Set([
  "pass",
  "otp",
  "auth",
  "sessao",
  "session",
  "jwt",
  // --- ampliacao do hardening (docs/41 §5, achado A2) ---
  "codigo",
  "pin",
  "mfa",
  "totp",
  "chave",
]);

/** Quebra `xAuthToken`/`x-auth-token`/`x_auth_token` em tokens minusculos. */
function tokenizeKey(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

/** `true` se a chave designa um segredo — o VALOR nunca deve ser registrado. */
export function isSecretKey(key: string): boolean {
  const tokens = tokenizeKey(key);
  if (tokens.some((token) => SECRET_KEY_EXACT_TOKENS.has(token))) return true;

  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SECRET_KEY_SUBSTRINGS.some((term) => normalized.includes(term));
}

// ----------------------------------------------------------------- valores

/**
 * Regra de mascaramento. `replace` e string fixa OU funcao — a funcao existe para
 * preservar a parte NAO sensivel do casamento (ex.: manter a chave `senha` visivel
 * como evidencia e matar so o valor).
 */
interface RedactionRule {
  pattern: RegExp;
  replace: string | ((match: string, ...groups: (string | undefined)[]) => string);
}

/**
 * Esquemas de autenticacao HTTP cujo valor E a credencial (RFC 7235 e uso comum).
 * `Bearer` sozinho nao basta: `Basic` carrega `base64(usuario:senha)` e foi o
 * furo encontrado na 1a revisao do PR de hardening.
 */
const HTTP_AUTH_SCHEME_ALTERNATION = ["Bearer", "Basic", "Digest", "Negotiate", "Token"].join("|");

/**
 * Separador entre esquema e credencial. Alem de espaco, aceita as formas
 * CODIFICADAS (`%20` de URL, `+` de formulario) e separadores degenerados
 * (`,`/`;`) — sem isso, `authorization=Bearer%20<token>` escapava das DUAS
 * regras: o esquema exigia espaco literal e o lookahead abaixo bloqueava o par
 * `chave=valor`. O esquema virava escudo do atacante (2a revisao adversarial).
 */
const AUTH_SCHEME_SEPARATOR = String.raw`(?:\s+|%20|\+|,|;)`;

/**
 * Termos que, num par `chave=valor` escrito em TEXTO LIVRE, marcam o VALOR como
 * segredo. Espelham `SECRET_KEY_*`, mas se aplicam a conteudo de string — nao a
 * nome de campo.
 *
 * DUAS familias, pelo mesmo motivo que a camada por chave tem duas listas.
 *
 * FAMILIA A — termos INEQUIVOCOS: aceitam PREFIXO e SUFIXO, porque nome composto
 * e a forma mais comum de credencial em log (`accessToken=`, `govbrPassword=`,
 * `clientSecret=`, `setCookie=`). Sem prefixo livre, o `\b` inicial impedia o
 * casamento — em `accessToken` nao ha fronteira antes de `Token` — e a
 * credencial vazava, ainda que a camada por CHAVE protegesse o mesmo nome.
 */
const FREE_TEXT_SECRET_TERMS_A = [
  "senhas?",
  "password",
  "passwd",
  "pwd",
  "tokens?",
  "secret",
  "segredo",
  "api[_-]?key",
  "access[_-]?key",
  "private[_-]?key",
  "session[_-]?id",
  "credential",
  "credencial",
  "authorization",
  "cookie",
  "assinatura",
  "signature",
  "hmac",
  "certificado",
  "chave[_-]?privada",
  "c[oó]digo[_-]?(?:verifica[cç][aã]o|acesso)",
  "recovery[_-]?code",
].join("|");

/**
 * FAMILIA B — termos CURTOS/AMBIGUOS: exigem fronteira dos DOIS lados, sem
 * prefixo nem sufixo. Prefixo livre destruiria evidencia de dominio (`pin`
 * casaria em `espingarda`, `shipping`, `processTypeMapping`); sufixo livre faria
 * `auth` casar em `author` e `pass` em `passo` — ambos campos legitimos do lab.
 */
const FREE_TEXT_SECRET_TERMS_B = [
  "otp",
  "c[oó]digo",
  "pin",
  "jwt",
  "bearer",
  "auth",
  "pass",
  "chave",
  "mfa",
  "totp",
  "sess(?:ion|ao|ão)",
].join("|");

/** Nome de chave sensivel em texto livre: familia A com afixos, B ancorada. */
const FREE_TEXT_SECRET_KEY =
  `(?:[a-z0-9_-]*(?:${FREE_TEXT_SECRET_TERMS_A})[a-z0-9_-]*` +
  `|(?:${FREE_TEXT_SECRET_TERMS_B})\\b)`;

/**
 * CREDENCIAL EM TEXTO LIVRE — o que faltava antes do hardening (docs/41 §5).
 *
 * A redacao por CHAVE nao alcanca segredo escrito dentro de uma string: a
 * `message` de um passo ou o texto de um erro podiam carregar `Bearer <token>`,
 * um JWT ou `senha=...` e sobreviver intactos. Estas regras fecham isso.
 *
 * Alta confianca (valem tambem no modo "identifiers"): a forma so ocorre em
 * credencial, entao mascarar nunca destroi caminho de artefato.
 */
const CREDENTIAL_PATTERNS: readonly RedactionRule[] = [
  /**
   * `Digest <k=v, k=v>` PRIMEIRO: o valor do Digest e uma LISTA de parametros com
   * espaco e virgula, entao a regra de token unico (abaixo) casaria so `username=`
   * e deixaria `admin, response=...` em claro. Consome pares `k=v` enquanto
   * houver; prosa depois da lista nao casa (`palavra` sem `=` encerra).
   */
  {
    pattern: new RegExp(
      String.raw`\b(Digest)\s+(?:[A-Za-z0-9_-]+\s*=\s*(?:"[^"]*"|[^,\s]*)(?:\s*,\s*)?)+`,
      "gi",
    ),
    replace: (_match, scheme) => `${scheme ?? "Digest"} ${LAB_REDACTED}`,
  },
  /**
   * `<esquema> <credencial>` para os esquemas HTTP auth (RFC 7235 + uso comum).
   * O ESQUEMA fica como evidencia; a credencial morre. Cobre tanto o header
   * completo (`Authorization: Basic ...`, `proxy-authorization=Basic ...`) quanto
   * o esquema solto no meio do texto.
   *
   * `Basic` e o caso critico: carrega `base64(usuario:senha)` — o par inteiro.
   *
   * Vies deliberado: `Token invalido` tambem vira `Token ${LAB_REDACTED}`. Este
   * modulo resolve duvida MASCARANDO (mesma politica das heuristicas de valor);
   * perder uma palavra de diagnostico e aceitavel, vazar credencial nao.
   */
  {
    pattern: new RegExp(
      String.raw`\b(${HTTP_AUTH_SCHEME_ALTERNATION})${AUTH_SCHEME_SEPARATOR}[A-Za-z0-9\-._~+/%]+=*`,
      "gi",
    ),
    replace: (_match, scheme) => `${scheme ?? ""} ${LAB_REDACTED}`.trim(),
  },
  // JWT: header base64url de `{"alg"...}` comeca sempre com `eyJ`
  { pattern: /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]*)?/g, replace: LAB_REDACTED },
  /**
   * `chave=valor` / `chave: valor` com chave sensivel. A CHAVE fica (evidencia de
   * auditoria, mesma politica do `isSecretKey`); o VALOR morre. Cobre
   * `senha=...`, `token=...`, `set-cookie: ...`, `session=...`,
   * `authorization: ...`.
   *
   * O lookahead evita DOIS defeitos: remarcar valor ja redigido, e comer so a
   * palavra do esquema (`Basic`, `Bearer`...) deixando a credencial crua atras
   * dela — o valor aqui para no espaco, entao `authorization=Basic dXNl` viraria
   * `authorization=[REDACTED] dXNl`. Com o esquema no lookahead, o caso fica para
   * a regra de esquema acima, que consome a credencial inteira.
   *
   * O lookahead exige o SEPARADOR depois do esquema (`Bearer ` / `Bearer%20`),
   * nao so a fronteira de palavra: senao `authorization=Bearer%20<token>` era
   * bloqueado aqui e ignorado la, e ninguem redigia nada.
   */
  {
    pattern: new RegExp(
      String.raw`\b(${FREE_TEXT_SECRET_KEY})(\s*[:=]\s*)(?!\[REDACTED\]|(?:${HTTP_AUTH_SCHEME_ALTERNATION})${AUTH_SCHEME_SEPARATOR})("[^"]*"|'[^']*'|[^\s,;&)\]}]+)`,
      "gi",
    ),
    replace: (_match, key, separator) => `${key ?? ""}${separator ?? ""}${LAB_REDACTED}`,
  },
];

/**
 * Identificadores de ALTA CONFIANCA: a forma so ocorre em dado pessoal, entao
 * mascarar aqui nunca e falso positivo.
 *
 * Ordem importa: e-mail primeiro (pode conter digitos que o CPF comeria).
 */
const STRONG_IDENTIFIER_PATTERNS: readonly RedactionRule[] = [
  // e-mail
  { pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replace: "[EMAIL]" },
  // CPF com ou sem pontuacao
  { pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replace: "***.***.***-**" },
  // RG formatado (o nao formatado cai na heuristica de sequencia longa)
  { pattern: /\b\d{1,2}\.\d{3}\.\d{3}[-\s]?[\dxX]\b/g, replace: "**.***.***-*" },
];

/**
 * HEURISTICAS: qualquer sequencia longa de digitos pode ser telefone/RG cru/
 * numero de serie — mas tambem pode ser um timestamp ou um id tecnico. Em texto
 * livre a duvida se resolve mascarando; em NOME DE ARQUIVO nao, porque destruiria
 * o caminho do artefato (ver `redactLabText` modo "identifiers").
 */
const HEURISTIC_PATTERNS: readonly RedactionRule[] = [
  /**
   * OTP/codigo curto identificado por CONTEXTO. Numero solto de 4-5 digitos NAO e
   * mascarado (poderia ser qualquer coisa); mascara-se quando um termo sensivel
   * aparece perto — `codigo OTP enviado: 4839`. Heuristica, logo fora do modo
   * "identifiers".
   */
  {
    pattern: new RegExp(
      String.raw`\b(?:otp|c[oó]digo|pin|token|senha|password)\b[^\n\d]{0,24}?(\d{4,8})\b`,
      "gi",
    ),
    replace: (match, digits) => (digits ? match.replace(digits, "******") : match),
  },
  /**
   * Token opaco de 3 segmentos base64url (JWT sem o header `eyJ`, ou similar).
   * Heuristica: exige 3 segmentos longos, o que um nome de arquivo de artefato
   * pode acidentalmente satisfazer — por isso NAO entra no modo "identifiers".
   */
  { pattern: /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replace: LAB_REDACTED },
  // telefone BR, com ou sem DDI/DDD/nono digito
  { pattern: /(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g, replace: "[TELEFONE]" },
  // qualquer sequencia longa de digitos (RG cru, serie, referencia...)
  { pattern: /\b\d{6,}\b/g, replace: "******" },
];

/** Credencial vem primeiro: mata o valor inteiro antes que outra regra o fatie. */
const IDENTIFIER_RULES: readonly RedactionRule[] = [
  ...CREDENTIAL_PATTERNS,
  ...STRONG_IDENTIFIER_PATTERNS,
];

const VALUE_PATTERNS: readonly RedactionRule[] = [...IDENTIFIER_RULES, ...HEURISTIC_PATTERNS];

/**
 * `"full"` (padrao) — credenciais + identificadores + heuristicas; use em texto
 * livre.
 * `"identifiers"` — credenciais e identificadores de alta confianca apenas; use
 * quando mascarar digitos legitimos quebraria o valor (nome de arquivo, caminho
 * de artefato). Credencial e mascarada nos DOIS modos.
 */
export type LabRedactionMode = "full" | "identifiers";

/** Numero com esta quantidade de digitos ja e tratado como identificador. */
const LONG_NUMBER_DIGITS = 6;

export interface LabTextRedaction {
  text: string;
  masked: number;
}

/** Mascara os padroes sensiveis de um texto e conta as ocorrencias. */
export function redactLabText(text: string, mode: LabRedactionMode = "full"): LabTextRedaction {
  let masked = 0;
  let output = text;
  const rules = mode === "identifiers" ? IDENTIFIER_RULES : VALUE_PATTERNS;

  for (const { pattern, replace } of rules) {
    // `pattern` e global: recria o lastIndex a cada uso para nao depender de estado.
    output = output.replace(new RegExp(pattern.source, pattern.flags), (match, ...args) => {
      masked += 1;
      if (typeof replace === "string") return replace;
      // `args` termina com (offset, stringCompleta): fora os grupos capturados.
      const groups = args.slice(0, Math.max(0, args.length - 2)) as (string | undefined)[];
      return replace(match, ...groups);
    });
  }

  return { text: output, masked };
}

/** `true` se o numero tem digitos suficientes para ser um identificador. */
function isLongNumber(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return Math.abs(Math.trunc(value)).toString().length >= LONG_NUMBER_DIGITS;
}

// --------------------------------------------------------------- travessia

function emptySummary(): LabRedactionSummary {
  return { redactedKeys: 0, maskedValues: 0, total: 0 };
}

/** Soma parciais de redacao (o `total` e sempre recalculado). */
export function mergeRedactionSummary(
  ...summaries: readonly LabRedactionSummary[]
): LabRedactionSummary {
  const merged = summaries.reduce<LabRedactionSummary>(
    (acc, item) => ({
      redactedKeys: acc.redactedKeys + item.redactedKeys,
      maskedValues: acc.maskedValues + item.maskedValues,
      total: 0,
    }),
    emptySummary(),
  );
  merged.total = merged.redactedKeys + merged.maskedValues;
  return merged;
}

function walk(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  summary: LabRedactionSummary,
): LabSafeValue {
  if (value === null || value === undefined) return null;

  switch (typeof value) {
    case "string": {
      const { text, masked } = redactLabText(value);
      summary.maskedValues += masked;
      return text;
    }
    case "number": {
      if (isLongNumber(value)) {
        summary.maskedValues += 1;
        return "******";
      }
      return Number.isFinite(value) ? value : null;
    }
    case "boolean":
      return value;
    case "bigint": {
      summary.maskedValues += 1;
      return "******";
    }
    case "function":
    case "symbol":
      // Nao serializavel: descartado por completo, sem revelar o conteudo.
      return null;
    default:
      break;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (value instanceof Error) {
    // Stack descartado de proposito (ver `redactLabError`).
    const { text, masked } = redactLabText(value.message);
    summary.maskedValues += masked;
    return { name: value.name, message: text };
  }

  if (depth >= MAX_DEPTH) return LAB_DEPTH_LIMIT;

  const asObject = value as object;
  if (seen.has(asObject)) return LAB_CIRCULAR;
  seen.add(asObject);

  try {
    if (Array.isArray(value)) {
      return value.map((item) => walk(item, depth + 1, seen, summary));
    }

    const output: Record<string, LabSafeValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const { text: safeKey, masked } = redactLabText(key);
      summary.maskedValues += masked;

      if (isSecretKey(key)) {
        // O valor NAO e visitado: nada dele pode chegar a saida.
        summary.redactedKeys += 1;
        output[safeKey] = LAB_REDACTED;
        continue;
      }
      output[safeKey] = walk(item, depth + 1, seen, summary);
    }
    return output;
  } finally {
    seen.delete(asObject);
  }
}

/** Sanitiza qualquer valor e devolve a versao segura + a contagem de redacoes. */
export function redactLabValue(value: unknown): LabRedactionResult {
  const summary = emptySummary();
  const safe = walk(value, 0, new WeakSet<object>(), summary);
  summary.total = summary.redactedKeys + summary.maskedValues;
  return { value: safe, summary };
}

/** Atalho tipado para `meta` de passo/evento: sempre devolve objeto. */
export function redactLabMeta(
  meta: Readonly<Record<string, unknown>>,
): LabRedactionResult<Record<string, LabSafeValue>> {
  const { value, summary } = redactLabValue({ ...meta });
  const safe =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, LabSafeValue>)
      : {};
  return { value: safe, summary };
}

/**
 * Sanitiza um erro para o relatorio e informa QUANTO foi redigido.
 *
 * Mantem `name`/`message` mascarados e DESCARTA o stack (caminhos, argv e query
 * strings podem carregar segredo). A contagem existe para que quem monta o
 * relatorio nao subdeclare a redacao: erro redigido tem de aparecer no total.
 */
export function redactLabErrorWithSummary(error: unknown): LabRedactionResult<LabRedactedError> {
  const fromText = (name: string, text: string): LabRedactionResult<LabRedactedError> => {
    const { text: message, masked } = redactLabText(text);
    return {
      value: { name, message },
      summary: { redactedKeys: 0, maskedValues: masked, total: masked },
    };
  };

  if (error instanceof Error) return fromText(error.name, error.message);
  if (typeof error === "string") return fromText("Error", error);

  const { value, summary } = redactLabValue(error);
  return { value: { name: "Error", message: JSON.stringify(value) ?? "" }, summary };
}

/** Atalho para quem so precisa do erro sanitizado (ver variante com contagem). */
export function redactLabError(error: unknown): LabRedactedError {
  return redactLabErrorWithSummary(error).value;
}
