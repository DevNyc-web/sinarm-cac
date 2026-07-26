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
 */
const SECRET_KEY_SUBSTRINGS = [
  "password",
  "passwd",
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
] as const;

/**
 * Termos CURTOS/AMBIGUOS: so batem como TOKEN inteiro da chave. Evita que
 * `passo`/`passos` (portugues, usado nos steps do lab) seja confundido com
 * `pass`, e que `author` vire `auth`.
 */
const SECRET_KEY_EXACT_TOKENS = new Set(["pass", "otp", "auth", "sessao", "session", "jwt"]);

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
 * Identificadores de ALTA CONFIANCA: a forma so ocorre em dado pessoal, entao
 * mascarar aqui nunca e falso positivo.
 *
 * Ordem importa: e-mail primeiro (pode conter digitos que o CPF comeria).
 */
const STRONG_IDENTIFIER_PATTERNS: readonly { pattern: RegExp; mask: string }[] = [
  // e-mail
  { pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, mask: "[EMAIL]" },
  // CPF com ou sem pontuacao
  { pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, mask: "***.***.***-**" },
  // RG formatado (o nao formatado cai na heuristica de sequencia longa)
  { pattern: /\b\d{1,2}\.\d{3}\.\d{3}[-\s]?[\dxX]\b/g, mask: "**.***.***-*" },
];

/**
 * HEURISTICAS: qualquer sequencia longa de digitos pode ser telefone/RG cru/
 * numero de serie — mas tambem pode ser um timestamp ou um id tecnico. Em texto
 * livre a duvida se resolve mascarando; em NOME DE ARQUIVO nao, porque destruiria
 * o caminho do artefato (ver `redactLabText` modo "identifiers").
 */
const HEURISTIC_PATTERNS: readonly { pattern: RegExp; mask: string }[] = [
  // telefone BR, com ou sem DDI/DDD/nono digito
  { pattern: /(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g, mask: "[TELEFONE]" },
  // qualquer sequencia longa de digitos (RG cru, serie, referencia...)
  { pattern: /\b\d{6,}\b/g, mask: "******" },
];

const VALUE_PATTERNS: readonly { pattern: RegExp; mask: string }[] = [
  ...STRONG_IDENTIFIER_PATTERNS,
  ...HEURISTIC_PATTERNS,
];

/**
 * `"full"` (padrao) — identificadores + heuristicas; use em texto livre.
 * `"identifiers"` — so identificadores de alta confianca; use quando mascarar
 * digitos legitimos quebraria o valor (nome de arquivo, caminho de artefato).
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
  const patterns = mode === "identifiers" ? STRONG_IDENTIFIER_PATTERNS : VALUE_PATTERNS;

  for (const { pattern, mask } of patterns) {
    // `pattern` e global: recria o lastIndex a cada uso para nao depender de estado.
    output = output.replace(new RegExp(pattern.source, pattern.flags), () => {
      masked += 1;
      return mask;
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
