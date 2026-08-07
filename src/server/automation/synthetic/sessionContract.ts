/**
 * Fase 2 — Contrato de SESSAO SINTETICA (docs/73) e estados do handoff (docs/74).
 *
 * Modulo PURO: nao abre navegador, nao acessa rede, nao le/escreve arquivo, nao
 * toca Prisma e nao importa nada da Fase 9. So valida um objeto e devolve o
 * resultado.
 *
 * DETERMINISTICO: nenhum `Date.now()`, `Math.random()` ou leitura de ambiente —
 * a mesma entrada produz sempre o mesmo resultado (docs/73 §10.1/§10.2). Por
 * isso o validador NAO decide "esta expirado agora": ele confere formato e
 * ordem (`expiresAt` > `issuedAt`); comparar com o relogio e de quem chama.
 *
 * Garantias inegociaveis:
 * - a lista de campos e FECHADA — chave fora dela e REJEITADA, nao ignorada
 *   (docs/73 §6.3);
 * - nenhum campo de credencial existe, e chave desconhecida com nome suspeito
 *   (senha/otp/cookie/token/credencial/cpf/storageState/gov.br) e rejeitada com
 *   codigo proprio, porque isso e ALARME e nao ruido (docs/73 §9.8, docs/74 §11.9);
 * - `environment` so aceita sintetico/local/teste — `production` e rejeitado
 *   (docs/73 §6.1);
 * - nenhum valor pode conter host oficial nem URL externa (docs/73 §6.2);
 * - o contrato e SINTETICO: nada aqui autoriza execucao real, e nao existe
 *   transicao para o real (docs/74 §8.8-§8.10, §15).
 */

// ------------------------------------------------------------------- campos

/**
 * Os 11 campos permitidos (docs/73 §3). Lista FECHADA: a validacao rejeita
 * qualquer chave fora daqui.
 *
 * `sessionHandle` esta aqui de proposito, mesmo casando com a varredura de
 * nomes suspeitos: a allow-list tem PRECEDENCIA sobre a varredura, que so roda
 * em chave desconhecida. O valor do handle continua mascaravel em log por outra
 * camada (`redaction.ts`), e e por isso que a correlacao de eventos usa
 * `auditCorrelationId` e nao o handle (docs/73 §3.1).
 */
export const SYNTHETIC_SESSION_FIELDS = [
  "sessionHandle",
  "processId",
  "actorId",
  "scope",
  "expiresAt",
  "issuedAt",
  "environment",
  "consentMarker",
  "handoffState",
  "auditCorrelationId",
  "allowedSyntheticProcessCode",
] as const;

export type SyntheticSessionField = (typeof SYNTHETIC_SESSION_FIELDS)[number];

const FIELD_SET: ReadonlySet<string> = new Set(SYNTHETIC_SESSION_FIELDS);

// ------------------------------------------------------------------ estados

/** Os 8 estados do handoff (docs/73 §3, docs/74 §4). */
export const SYNTHETIC_HANDOFF_STATES = [
  "CREATED",
  "CLAIMED",
  "IN_PROGRESS",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED",
  "BLOCKED",
  "FAILED",
] as const;

export type SyntheticHandoffState = (typeof SYNTHETIC_HANDOFF_STATES)[number];

/**
 * Terminais (docs/74 §9): nao reabrem, nao renovam, nao reexecutam. Nova
 * tentativa exige NOVA sessao sintetica.
 *
 * `BLOCKED` NAO esta aqui: captcha sintetico bloqueia e exige desfecho
 * explicito (docs/73 §5.12).
 */
export const SYNTHETIC_TERMINAL_STATES = [
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
] as const satisfies readonly SyntheticHandoffState[];

const TERMINAL_SET: ReadonlySet<string> = new Set(SYNTHETIC_TERMINAL_STATES);

/**
 * As 14 transicoes permitidas (docs/74 §7). Mapa de ALLOW-LIST: estado ausente
 * ou destino fora da lista e proibido por omissao — o contrario deixaria a
 * porta aberta a cada estado novo.
 *
 * De `BLOCKED` sai-se para o lado (`CANCELLED`, `FAILED`) ou para tras
 * (`EXPIRED`), NUNCA para frente: `BLOCKED -> COMPLETED` e
 * `BLOCKED -> IN_PROGRESS` exigiriam um evento de desbloqueio sintetico que
 * NAO existe (docs/74 §8.5/§8.6, §10.2).
 */
export const SYNTHETIC_TRANSITIONS: Readonly<
  Record<SyntheticHandoffState, readonly SyntheticHandoffState[]>
> = {
  CREATED: ["CLAIMED", "EXPIRED", "CANCELLED"],
  CLAIMED: ["IN_PROGRESS", "EXPIRED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "BLOCKED", "FAILED", "EXPIRED", "CANCELLED"],
  BLOCKED: ["CANCELLED", "FAILED", "EXPIRED"],
  COMPLETED: [],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
};

// ----------------------------------------------------------------- ambiente

/** Ambientes aceitos (docs/73 §6.1). `production` NUNCA entra nesta lista. */
export const SYNTHETIC_ENVIRONMENTS = ["synthetic", "local", "test"] as const;

export type SyntheticEnvironment = (typeof SYNTHETIC_ENVIRONMENTS)[number];

const ENVIRONMENT_SET: ReadonlySet<string> = new Set(SYNTHETIC_ENVIRONMENTS);

// -------------------------------------------------------- travas de valores

/** Hosts aceitos — os mesmos do `PHASE9_DEFAULT_ALLOWED_HOSTS` (docs/73 §6.2). */
export const SYNTHETIC_ALLOWED_HOSTS: readonly string[] = ["localhost", "127.0.0.1"];

/**
 * Hosts oficiais: bloqueio DURO, em qualquer string, mesmo sem parecer URL.
 * Espelha o `FORBIDDEN_HOST_PATTERN` do guard da Fase 9 — duplicado de
 * proposito, para que este modulo nao dependa de `phase9/`.
 */
const FORBIDDEN_HOST_PATTERN = /gov\.br|servicos\.pf|sinarm|acesso\.gov/i;

/** Qualquer coisa com esquema (`http:`, `file:`, `data:`) que nao seja loopback. */
const URL_LIKE_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

/**
 * CPF com ou sem pontuacao. REJEITADO em qualquer campo, inclusive o ficticio
 * `000.000.000-00`: nenhum dos 11 campos tem lugar para CPF — o ficticio do
 * laboratorio vive no portal sintetico, nao no contrato (docs/73 §4.9).
 */
const CPF_LIKE_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;

/**
 * Nomes suspeitos, checados APENAS em chave desconhecida (a allow-list vence).
 *
 * `cpf` e `storagestate` estao aqui porque o `isSecretKey` do `redaction.ts`
 * NAO os cobre hoje — achado registrado no docs/73 §6.4. Este modulo nao
 * importa `isSecretKey`: a lista abaixo e a trava do contrato, e depender da
 * outra deixaria a validacao refem de uma mudanca em modulo alheio.
 */
const SUSPICIOUS_KEY_TERMS: readonly string[] = [
  "password",
  "senha",
  "otp",
  "cookie",
  "token",
  "credential",
  "credencial",
  "cpf",
  "storagestate",
  "govbr",
];

/**
 * O proibido tambem e proibido SERIALIZADO (docs/73 §4): rejeitar so a CHAVE
 * `cookie` deixaria passar `consentMarker: '{"cookie":"abc123"}'` — o mesmo
 * segredo, um nivel de aspas adiante.
 *
 * O gatilho e o termo seguido de SEPARADOR DE CHAVE (`:` ou `=`), nao o termo
 * solto: e o que distingue um payload (`{"token":"abc"}`, `cookie=abc`) de uma
 * palavra dentro de um identificador legitimo (`consent-token-0001`). Sem essa
 * exigencia, a trava viraria falso positivo em nome comum — e trava que grita a
 * toa e trava que alguem desliga.
 *
 * Nao pega segredo opaco (hash, base64 sem rotulo): isso e indetectavel por
 * inspecao e continua sendo responsabilidade de quem monta o contrato.
 */
const SERIALIZED_SECRET_PATTERN =
  /(^|[^a-z0-9])(password|senha|otp|cookie|token|credential|credencial|cpf|storage[_-]?state|gov[_-]?br)["']?\s*[:=]/i;

/** `storage_state`/`gov_br`/`x-auth-token` -> `storagestate`/`govbr`/`xauthtoken`. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** `true` se a chave DESCONHECIDA aparenta carregar segredo ou dado real. */
export function isSuspiciousFieldName(key: string): boolean {
  const normalized = normalizeKey(key);
  return SUSPICIOUS_KEY_TERMS.some((term) => normalized.includes(term));
}

// -------------------------------------------------------------- prefixos ok

/**
 * Codigos de processo aceitos: o sintetico do laboratorio (`labRunReport.ts`) e
 * o interno do produto (docs/62). Formato de protocolo real e rejeitado
 * (docs/73 §6.5).
 */
export const SYNTHETIC_PROCESS_CODE_PREFIXES: readonly string[] = ["PROT-FICT-", "CAC-"];

// -------------------------------------------------------------------- tipos

export interface SyntheticSessionContract {
  sessionHandle: string;
  processId: string;
  actorId: string;
  scope: readonly string[];
  expiresAt: string;
  issuedAt: string;
  environment: SyntheticEnvironment;
  consentMarker: string;
  handoffState: SyntheticHandoffState;
  auditCorrelationId: string;
  allowedSyntheticProcessCode: string;
}

export const SYNTHETIC_VIOLATION_CODES = [
  "NOT_AN_OBJECT",
  "UNKNOWN_FIELD",
  "SUSPICIOUS_FIELD_NAME",
  "MISSING_FIELD",
  "INVALID_TYPE",
  "EMPTY_VALUE",
  "INVALID_ENVIRONMENT",
  "INVALID_STATE",
  "INVALID_TIMESTAMP",
  "EXPIRES_NOT_AFTER_ISSUED",
  "INVALID_PROCESS_CODE",
  "FORBIDDEN_HOST",
  "EXTERNAL_URL",
  "CPF_LIKE_VALUE",
  "SERIALIZED_SECRET",
] as const;

export type SyntheticViolationCode = (typeof SYNTHETIC_VIOLATION_CODES)[number];

export interface SyntheticContractViolation {
  code: SyntheticViolationCode;
  /** Campo onde o problema apareceu. `null` quando e o objeto inteiro. */
  field: string | null;
  detail: string;
}

export type SyntheticContractValidation =
  | { ok: true; contract: SyntheticSessionContract; violations: readonly [] }
  | { ok: false; contract: null; violations: readonly SyntheticContractViolation[] };

// ------------------------------------------------------------------ helpers

export function isSyntheticTerminalState(state: string): boolean {
  return TERMINAL_SET.has(state);
}

/** `true` se a transicao esta na allow-list do docs/74 §7. */
export function canTransition(from: string, to: string): boolean {
  if (!isSyntheticHandoffState(from) || !isSyntheticHandoffState(to)) return false;
  return SYNTHETIC_TRANSITIONS[from].includes(to);
}

export function isSyntheticHandoffState(value: string): value is SyntheticHandoffState {
  return (SYNTHETIC_HANDOFF_STATES as readonly string[]).includes(value);
}

/** ISO-8601 valido. Nao compara com o relogio — so com o proprio formato. */
export function isIsoTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

/**
 * Varre um valor (string, lista ou objeto aninhado) atras das travas de
 * conteudo. Recursiva de proposito: o proibido nao pode escapar por estar um
 * nivel abaixo.
 */
function scanValue(
  field: string,
  value: unknown,
  violations: SyntheticContractViolation[],
  depth = 0,
): void {
  if (depth > 8) return; // ponytail: profundidade fixa; o contrato e raso por desenho

  if (typeof value === "string") {
    if (FORBIDDEN_HOST_PATTERN.test(value)) {
      violations.push({
        code: "FORBIDDEN_HOST",
        field,
        detail: "valor referencia host oficial (gov.br/servicos.pf/sinarm/acesso.gov)",
      });
    }
    if (URL_LIKE_PATTERN.test(value) && !isLoopbackUrl(value)) {
      violations.push({
        code: "EXTERNAL_URL",
        field,
        detail: `URL externa; só ${SYNTHETIC_ALLOWED_HOSTS.join("/")} é aceito`,
      });
    }
    if (CPF_LIKE_PATTERN.test(value)) {
      violations.push({
        code: "CPF_LIKE_VALUE",
        field,
        detail: "valor com formato de CPF; nenhum campo do contrato carrega CPF",
      });
    }
    if (SERIALIZED_SECRET_PATTERN.test(value)) {
      violations.push({
        code: "SERIALIZED_SECRET",
        field,
        detail: "valor carrega campo proibido em forma serializada (docs/73 §4)",
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(`${field}[${index}]`, item, violations, depth + 1));
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      scanValue(`${field}.${key}`, nested, violations, depth + 1);
    }
  }
}

function isLoopbackUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return SYNTHETIC_ALLOWED_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Mesma varredura de conteudo aplicada aos 11 campos, exposta para quem precisa
 * conferir um texto que NAO e campo do contrato — o `reason` de um evento, por
 * exemplo (docs/74 §12: nenhum evento carrega PII, segredo ou host oficial).
 *
 * Existe para que o lifecycle NAO duplique `FORBIDDEN_HOST_PATTERN`,
 * `CPF_LIKE_PATTERN` e `SERIALIZED_SECRET_PATTERN` num terceiro lugar: trava
 * duplicada e trava que diverge quando so uma e endurecida.
 */
export function scanSyntheticValue(field: string, value: unknown): SyntheticContractViolation[] {
  const violations: SyntheticContractViolation[] = [];
  scanValue(field, value, violations);
  return violations;
}

function requireNonEmptyString(
  field: SyntheticSessionField,
  value: unknown,
  violations: SyntheticContractViolation[],
): value is string {
  if (typeof value !== "string") {
    violations.push({ code: "INVALID_TYPE", field, detail: "esperado string" });
    return false;
  }
  if (value.trim() === "") {
    violations.push({ code: "EMPTY_VALUE", field, detail: "string vazia" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------- validacao

/**
 * Valida um candidato a contrato de sessao sintetica.
 *
 * Devolve TODAS as violacoes encontradas, nao so a primeira: quem depura o
 * laboratorio precisa da lista inteira, e uma tentativa de campo proibido e
 * sinal a registrar, nao ruido a abafar (docs/74 §11.9/§11.10).
 */
export function validateSyntheticSessionContract(input: unknown): SyntheticContractValidation {
  const violations: SyntheticContractViolation[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      ok: false,
      contract: null,
      violations: [{ code: "NOT_AN_OBJECT", field: null, detail: "esperado objeto" }],
    };
  }

  const candidate = input as Record<string, unknown>;

  // ---- chaves: allow-list primeiro, varredura de nome suspeito depois
  for (const key of Object.keys(candidate)) {
    if (FIELD_SET.has(key)) continue;
    if (isSuspiciousFieldName(key)) {
      violations.push({
        code: "SUSPICIOUS_FIELD_NAME",
        field: key,
        detail: "nome sugere senha, OTP, cookie, token, credencial, CPF ou storageState",
      });
      continue;
    }
    violations.push({
      code: "UNKNOWN_FIELD",
      field: key,
      detail: "campo fora da lista fechada do docs/73 §3",
    });
  }

  // ---- presenca
  for (const field of SYNTHETIC_SESSION_FIELDS) {
    if (!(field in candidate) || candidate[field] === undefined || candidate[field] === null) {
      violations.push({ code: "MISSING_FIELD", field, detail: "campo obrigatório ausente" });
    }
  }

  // ---- conteudo de cada valor presente (recursivo)
  for (const field of SYNTHETIC_SESSION_FIELDS) {
    if (field in candidate) scanValue(field, candidate[field], violations);
  }

  // ---- strings simples
  for (const field of [
    "sessionHandle",
    "processId",
    "actorId",
    "consentMarker",
    "auditCorrelationId",
  ] as const) {
    if (field in candidate) requireNonEmptyString(field, candidate[field], violations);
  }

  // ---- scope: lista de capacidades sintéticas, nunca vazia (docs/73 §6.8)
  const scope = candidate.scope;
  if ("scope" in candidate) {
    if (!Array.isArray(scope) || scope.some((item) => typeof item !== "string")) {
      violations.push({ code: "INVALID_TYPE", field: "scope", detail: "esperado string[]" });
    } else if (scope.length === 0 || scope.some((item) => item.trim() === "")) {
      violations.push({ code: "EMPTY_VALUE", field: "scope", detail: "escopo sintético vazio" });
    }
  }

  // ---- environment
  const environment = candidate.environment;
  if ("environment" in candidate) {
    if (typeof environment !== "string" || !ENVIRONMENT_SET.has(environment)) {
      violations.push({
        code: "INVALID_ENVIRONMENT",
        field: "environment",
        detail: `aceito apenas ${SYNTHETIC_ENVIRONMENTS.join("/")}; production é rejeitado`,
      });
    }
  }

  // ---- handoffState
  const handoffState = candidate.handoffState;
  if ("handoffState" in candidate) {
    if (typeof handoffState !== "string" || !isSyntheticHandoffState(handoffState)) {
      violations.push({
        code: "INVALID_STATE",
        field: "handoffState",
        detail: `estado fora dos ${SYNTHETIC_HANDOFF_STATES.length} permitidos`,
      });
    }
  }

  // ---- prazos: formato e ordem, sem relogio (docs/73 §6.7, §10.2)
  const issuedAt = candidate.issuedAt;
  const expiresAt = candidate.expiresAt;
  const issuedOk = typeof issuedAt === "string" && isIsoTimestamp(issuedAt);
  const expiresOk = typeof expiresAt === "string" && isIsoTimestamp(expiresAt);

  if ("issuedAt" in candidate && !issuedOk) {
    violations.push({ code: "INVALID_TIMESTAMP", field: "issuedAt", detail: "ISO-8601 inválido" });
  }
  if ("expiresAt" in candidate && !expiresOk) {
    violations.push({ code: "INVALID_TIMESTAMP", field: "expiresAt", detail: "ISO-8601 inválido" });
  }
  if (issuedOk && expiresOk && Date.parse(expiresAt as string) <= Date.parse(issuedAt as string)) {
    violations.push({
      code: "EXPIRES_NOT_AFTER_ISSUED",
      field: "expiresAt",
      detail: "expiração precisa ser posterior à emissão",
    });
  }

  // ---- codigo de processo sintetico
  const processCode = candidate.allowedSyntheticProcessCode;
  if ("allowedSyntheticProcessCode" in candidate) {
    const valid =
      typeof processCode === "string" &&
      SYNTHETIC_PROCESS_CODE_PREFIXES.some((prefix) => processCode.startsWith(prefix));
    if (!valid) {
      violations.push({
        code: "INVALID_PROCESS_CODE",
        field: "allowedSyntheticProcessCode",
        detail: `aceito apenas ${SYNTHETIC_PROCESS_CODE_PREFIXES.join("/")}*`,
      });
    }
  }

  if (violations.length > 0) return { ok: false, contract: null, violations };

  return {
    ok: true,
    violations: [],
    contract: {
      sessionHandle: candidate.sessionHandle as string,
      processId: candidate.processId as string,
      actorId: candidate.actorId as string,
      scope: [...(candidate.scope as string[])],
      expiresAt: candidate.expiresAt as string,
      issuedAt: candidate.issuedAt as string,
      environment: candidate.environment as SyntheticEnvironment,
      consentMarker: candidate.consentMarker as string,
      handoffState: candidate.handoffState as SyntheticHandoffState,
      auditCorrelationId: candidate.auditCorrelationId as string,
      allowedSyntheticProcessCode: candidate.allowedSyntheticProcessCode as string,
    },
  };
}
