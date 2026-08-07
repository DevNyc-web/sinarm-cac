/**
 * Fase 2 — LIFECYCLE da sessao sintetica: aplica as transicoes do `docs/74` sobre
 * o contrato do `docs/73` e emite os 9 eventos de laboratorio.
 *
 * O contrato responde "esta transicao e permitida?". Esta camada responde "aplique
 * a transicao, me devolva o estado novo e o evento". Sao camadas, nao alternativas
 * (docs/74 §14.1).
 *
 * Modulo PURO: nao abre navegador, nao acessa rede, nao le/escreve arquivo, nao
 * toca Prisma, nao importa nada da Fase 9 e nao persiste sessao — o ciclo e em
 * memoria por desenho (docs/74 §16.4).
 *
 * DETERMINISTICO: nenhum `Date.now()`, `Math.random()` ou leitura de ambiente. O
 * relogio ENTRA como parametro (`at`), no mesmo padrao em que `issuedAt` e
 * `expiresAt` entram como input no contrato (docs/73 §10.2). Mesma entrada,
 * mesmos eventos, mesma ordem (§10.3).
 *
 * Garantias inegociaveis:
 * - transicao proibida NAO altera estado e NAO emite evento algum;
 * - falha NUNCA produz protocolo, e so `COMPLETED` admite `PROT-FICT-*`
 *   (docs/74 §13.2);
 * - `BLOCKED` nao vai para `COMPLETED` nem `IN_PROGRESS` — nao existe evento de
 *   desbloqueio, e este modulo nao inventa um (docs/74 §8.5/§8.6, §10.2);
 * - terminal nao reabre: retentar exige NOVA sessao sintetica (docs/74 §9.4);
 * - nenhum evento carrega o `sessionHandle` em claro (docs/73 §3.1);
 * - nao ha aresta para execucao real (docs/74 §8.8-§8.10, §15.7).
 */
import { LAB_SYNTHETIC_PROTOCOL_PREFIX } from "../lab/labRunReport";
import { redactLabText } from "../redaction";
import {
  canTransition,
  isIsoTimestamp,
  isSyntheticHandoffState,
  isSyntheticTerminalState,
  scanSyntheticValue,
  validateSyntheticSessionContract,
  type SyntheticHandoffState,
  type SyntheticSessionContract,
  type SyntheticViolationCode,
} from "./sessionContract";

// ------------------------------------------------------------------ eventos

/**
 * Os 9 eventos do `docs/74 §12`, que sao os mesmos do `docs/73 §7` — sem evento
 * novo e sem renomeacao (docs/74 §14.5).
 *
 * E por isso que uma transicao REJEITADA nao emite nada: nao existe
 * `synthetic_session_rejected` na lista, e criar um seria inventar o decimo
 * evento. A rejeicao aparece como violacao tipada, que e onde o
 * `docs/73 §9.8` manda registrar o sinal.
 */
export const SYNTHETIC_LAB_EVENTS = [
  "synthetic_session_created",
  "synthetic_session_claimed",
  "synthetic_session_step_started",
  "synthetic_session_step_completed",
  "synthetic_session_blocked_by_captcha",
  "synthetic_session_failed",
  "synthetic_session_expired",
  "synthetic_session_cancelled",
  "synthetic_session_completed",
] as const;

export type SyntheticLabEventName = (typeof SYNTHETIC_LAB_EVENTS)[number];

/**
 * Evento por estado ALCANCADO (docs/74 §4).
 *
 * `IN_PROGRESS` nao tem evento proprio na tabela: o §4 diz que ele "emite os
 * eventos de etapa", e o gatilho da transicao `CLAIMED -> IN_PROGRESS` e
 * justamente "primeira etapa inicia" (§7.4). Por isso entrar em execucao emite
 * `synthetic_session_step_started`, e nao um decimo evento inventado.
 */
const EVENT_BY_STATE: Readonly<Record<SyntheticHandoffState, SyntheticLabEventName>> = {
  CREATED: "synthetic_session_created",
  CLAIMED: "synthetic_session_claimed",
  IN_PROGRESS: "synthetic_session_step_started",
  COMPLETED: "synthetic_session_completed",
  BLOCKED: "synthetic_session_blocked_by_captcha",
  FAILED: "synthetic_session_failed",
  EXPIRED: "synthetic_session_expired",
  CANCELLED: "synthetic_session_cancelled",
};

/**
 * Um evento sintetico de auditoria (docs/74 §12).
 *
 * NAO carrega `sessionHandle`: a correlacao e pelo `auditCorrelationId`
 * justamente para que o handle continue redigido por padrao (docs/73 §3.1).
 * NAO carrega PII, segredo, cookie, senha nem screenshot real.
 */
export interface SyntheticLabEvent {
  event: SyntheticLabEventName;
  auditCorrelationId: string;
  processId: string;
  actorId: string;
  /** `null` apenas na criacao — nao ha estado antes de existir. */
  previousState: SyntheticHandoffState | null;
  nextState: SyntheticHandoffState;
  timestamp: string;
  /** Etapa sintetica, quando o evento e de etapa. */
  step: string | null;
  /** Motivo REDIGIDO (`redactLabText`), nunca texto cru. */
  reason: string;
}

// ------------------------------------------------------------------- falhas

/**
 * As 10 falhas sinteticas do `docs/74 §11`. Lista fechada: falha sem nome vira
 * "deu errado", que e exatamente o balde que o §2.3 manda nao criar.
 */
export const SYNTHETIC_FAILURE_KINDS = [
  "TIMEOUT", // 11.1
  "STEP_UNAVAILABLE", // 11.2
  "INVALID_EVIDENCE", // 11.3
  "FORBIDDEN_FIELD", // 11.4
  "EXTERNAL_URL", // 11.5
  "INVALID_ENVIRONMENT", // 11.6
  "INVALID_SCOPE", // 11.7
  "HANDLE_EXPIRED", // 11.8 — leva a EXPIRED, nao a FAILED
  "REAL_CREDENTIAL_ATTEMPT", // 11.9
  "REAL_DATA_ATTEMPT", // 11.10
] as const;

export type SyntheticFailureKind = (typeof SYNTHETIC_FAILURE_KINDS)[number];

/**
 * A unica falha que NAO termina em `FAILED`: prazo nao e defeito (docs/74 §11.8).
 * Manter isso como dado, e nao como `if` solto, e o que impede alguem de
 * classificar expiracao como bug do laboratorio.
 */
const FAILURE_TARGET: Readonly<Record<SyntheticFailureKind, SyntheticHandoffState>> = {
  TIMEOUT: "FAILED",
  STEP_UNAVAILABLE: "FAILED",
  INVALID_EVIDENCE: "FAILED",
  FORBIDDEN_FIELD: "FAILED",
  EXTERNAL_URL: "FAILED",
  INVALID_ENVIRONMENT: "FAILED",
  INVALID_SCOPE: "FAILED",
  HANDLE_EXPIRED: "EXPIRED",
  REAL_CREDENTIAL_ATTEMPT: "FAILED",
  REAL_DATA_ATTEMPT: "FAILED",
};

/**
 * Falhas que significam "alguem tentou trazer dado real para dentro do
 * laboratorio" (docs/74 §11.9/§11.10). Sao ALARME, nao ruido — rejeitar em
 * silencio desperdicaria o sinal mais valioso que a maquina emite.
 */
const ALARM_FAILURES: ReadonlySet<string> = new Set<SyntheticFailureKind>([
  "REAL_CREDENTIAL_ATTEMPT",
  "REAL_DATA_ATTEMPT",
  "FORBIDDEN_FIELD",
]);

/** Violacoes de conteudo que tambem sao alarme, venham de onde vierem. */
const ALARM_CODES: ReadonlySet<string> = new Set<SyntheticViolationCode>([
  "SUSPICIOUS_FIELD_NAME",
  "FORBIDDEN_HOST",
  "EXTERNAL_URL",
  "CPF_LIKE_VALUE",
  "SERIALIZED_SECRET",
]);

// --------------------------------------------------------------- violacoes

/** Codigos proprios do lifecycle; os do contrato passam adiante sem traducao. */
export const SYNTHETIC_LIFECYCLE_VIOLATION_CODES = [
  "FORBIDDEN_TRANSITION",
  "TERMINAL_NO_REOPEN",
  "BLOCKED_NO_FORWARD",
  "SESSION_EXPIRED",
  "NOT_YET_EXPIRED",
  "FAILURE_KIND_REQUIRED",
  "FAILURE_KIND_NOT_ALLOWED",
  "FAILURE_KIND_MISMATCH",
  "PROTOCOL_NOT_ALLOWED",
  "STEP_REQUIRES_IN_PROGRESS",
] as const;

export type SyntheticLifecycleViolationCode = (typeof SYNTHETIC_LIFECYCLE_VIOLATION_CODES)[number];

export interface SyntheticLifecycleViolation {
  code: SyntheticLifecycleViolationCode | SyntheticViolationCode;
  field: string | null;
  detail: string;
}

// ---------------------------------------------------------------- resultado

export interface SyntheticLifecycleSuccess {
  ok: true;
  previousState: SyntheticHandoffState | null;
  nextState: SyntheticHandoffState;
  /** Sessao NOVA com o estado aplicado. A de entrada nao e tocada. */
  session: SyntheticSessionContract;
  events: readonly SyntheticLabEvent[];
  /** So em `COMPLETED`, e so `PROT-FICT-*` (docs/74 §13.2). */
  syntheticProtocol: string | null;
  alarm: boolean;
  violations: readonly [];
}

export interface SyntheticLifecycleFailure {
  ok: false;
  previousState: SyntheticHandoffState | null;
  /** `null` sempre: transicao rejeitada nao produz estado novo. */
  nextState: null;
  /** `null` sempre: quem chamou continua com a sessao que ja tinha, intacta. */
  session: null;
  /** Vazio sempre: rejeicao nao emite evento de sucesso — nem evento nenhum. */
  events: readonly [];
  syntheticProtocol: null;
  alarm: boolean;
  violations: readonly SyntheticLifecycleViolation[];
}

export type SyntheticLifecycleResult = SyntheticLifecycleSuccess | SyntheticLifecycleFailure;

// ------------------------------------------------------------------ helpers

function hasAlarm(violations: readonly SyntheticLifecycleViolation[]): boolean {
  return violations.some((violation) => ALARM_CODES.has(violation.code));
}

function reject(
  previousState: SyntheticHandoffState | null,
  violations: readonly SyntheticLifecycleViolation[],
): SyntheticLifecycleFailure {
  return {
    ok: false,
    previousState,
    nextState: null,
    session: null,
    events: [],
    syntheticProtocol: null,
    alarm: hasAlarm(violations),
    violations,
  };
}

/** Copia com o estado novo. A entrada nunca e mutada (§4 do escopo). */
function withState(
  session: SyntheticSessionContract,
  handoffState: SyntheticHandoffState,
): SyntheticSessionContract {
  return { ...session, scope: [...session.scope], handoffState };
}

/**
 * Valida a sessao de entrada e devolve o contrato ou as violacoes. O estado
 * anterior so e conhecido quando o contrato passa — antes disso, `handoffState`
 * pode ser qualquer lixo.
 */
function readSession(
  input: unknown,
):
  | { ok: true; session: SyntheticSessionContract }
  | { ok: false; result: SyntheticLifecycleFailure } {
  const validation = validateSyntheticSessionContract(input);
  if (!validation.ok) {
    return { ok: false, result: reject(null, validation.violations) };
  }
  return { ok: true, session: validation.contract };
}

/**
 * Confere o texto livre que vai para o evento. O motivo e o nome da etapa sao os
 * unicos campos do evento que nao vem do contrato — logo, os unicos por onde um
 * host oficial, CPF ou segredo serializado poderia entrar na trilha.
 */
function scanFreeText(
  field: string,
  value: string | undefined,
  violations: SyntheticLifecycleViolation[],
): void {
  if (value === undefined) return;
  violations.push(...scanSyntheticValue(field, value));
}

function checkTimestamp(at: string, violations: SyntheticLifecycleViolation[]): void {
  if (!isIsoTimestamp(at)) {
    violations.push({ code: "INVALID_TIMESTAMP", field: "at", detail: "ISO-8601 inválido" });
  }
}

/** `true` se o instante informado ja alcancou a expiracao do handle. */
function isExpiredAt(session: SyntheticSessionContract, at: string): boolean {
  return Date.parse(at) >= Date.parse(session.expiresAt);
}

function buildEvent(
  session: SyntheticSessionContract,
  event: SyntheticLabEventName,
  previousState: SyntheticHandoffState | null,
  nextState: SyntheticHandoffState,
  timestamp: string,
  step: string | null,
  reason: string,
): SyntheticLabEvent {
  return {
    event,
    auditCorrelationId: session.auditCorrelationId,
    processId: session.processId,
    actorId: session.actorId,
    previousState,
    nextState,
    timestamp,
    step: step === null ? null : redactLabText(step).text,
    reason: redactLabText(reason).text,
  };
}

// ------------------------------------------------------------------ criacao

/**
 * Registra a criacao da sessao sintetica e emite `synthetic_session_created`.
 *
 * O timestamp do evento e o proprio `issuedAt` do contrato — nao ha instante
 * separado a injetar, porque a criacao E o `issuedAt` (docs/73 §3).
 */
export function createSyntheticSession(input: unknown, reason = ""): SyntheticLifecycleResult {
  const read = readSession(input);
  if (!read.ok) return read.result;

  const session = read.session;
  const violations: SyntheticLifecycleViolation[] = [];

  if (session.handoffState !== "CREATED") {
    violations.push({
      code: "INVALID_STATE",
      field: "handoffState",
      detail: "sessão nasce em CREATED; outro estado exige transição, não criação",
    });
  }
  scanFreeText("reason", reason, violations);

  if (violations.length > 0) return reject(session.handoffState, violations);

  return {
    ok: true,
    previousState: null,
    nextState: "CREATED",
    session: withState(session, "CREATED"),
    events: [
      buildEvent(
        session,
        "synthetic_session_created",
        null,
        "CREATED",
        session.issuedAt,
        null,
        reason,
      ),
    ],
    syntheticProtocol: null,
    alarm: false,
    violations: [],
  };
}

// --------------------------------------------------------------- transicao

export interface SyntheticTransitionInput {
  /** Sessao atual. Validada pelo contrato antes de qualquer coisa. */
  session: unknown;
  /** Estado pretendido (docs/74 §7). */
  to: string;
  /** Relogio INJETADO em ISO-8601. Nunca lido de `Date.now()`. */
  at: string;
  /** Motivo livre; vai redigido para o evento. */
  reason?: string;
  /** Obrigatorio ao ir para `FAILED`; e a unica via para `EXPIRED` por falha. */
  failure?: SyntheticFailureKind;
  /** Aceito somente em `COMPLETED`, e somente `PROT-FICT-*`. */
  syntheticProtocol?: string;
  /** Etapa sintetica em que a transicao aconteceu, se houver. */
  step?: string;
}

/**
 * Aplica UMA transicao de estado da sessao sintetica.
 *
 * Devolve TODAS as violacoes encontradas, nao so a primeira: quem depura o
 * laboratorio precisa da lista inteira, e uma tentativa de campo proibido e
 * sinal a registrar (docs/74 §11.9/§11.10).
 */
export function applySyntheticTransition(
  input: SyntheticTransitionInput,
): SyntheticLifecycleResult {
  const read = readSession(input.session);
  if (!read.ok) return read.result;

  const session = read.session;
  const from = session.handoffState;
  const violations: SyntheticLifecycleViolation[] = [];

  checkTimestamp(input.at, violations);
  scanFreeText("reason", input.reason, violations);
  scanFreeText("step", input.step, violations);

  // ---- destino conhecido
  if (!isSyntheticHandoffState(input.to)) {
    violations.push({
      code: "INVALID_STATE",
      field: "to",
      detail: "estado de destino fora dos 8 permitidos",
    });
    return reject(from, violations);
  }
  const to: SyntheticHandoffState = input.to;

  // ---- a regra especifica antes da generica: o codigo devolvido tem de dizer
  // QUAL invariante foi tocada, nao so "nao pode".
  if (isSyntheticTerminalState(from)) {
    violations.push({
      code: "TERMINAL_NO_REOPEN",
      field: "to",
      detail: `${from} é terminal: não reabre, não renova, não reexecuta — retentar exige nova sessão`,
    });
  } else if (from === "BLOCKED" && (to === "COMPLETED" || to === "IN_PROGRESS")) {
    violations.push({
      code: "BLOCKED_NO_FORWARD",
      field: "to",
      detail:
        "captcha sintético bloqueia, não desafia: BLOCKED sai para CANCELLED, FAILED ou EXPIRED — nunca para frente",
    });
  } else if (!canTransition(from, to)) {
    violations.push({
      code: "FORBIDDEN_TRANSITION",
      field: "to",
      detail: `${from} -> ${to} não está entre as 14 transições permitidas`,
    });
  }

  // ---- prazo: o handle vencido so admite um desfecho
  if (isIsoTimestamp(input.at)) {
    const expired = isExpiredAt(session, input.at);
    if (expired && to !== "EXPIRED") {
      violations.push({
        code: "SESSION_EXPIRED",
        field: "at",
        detail: "handle vencido: o único destino é EXPIRED — não há renovação silenciosa",
      });
    }
    if (!expired && to === "EXPIRED") {
      violations.push({
        code: "NOT_YET_EXPIRED",
        field: "at",
        detail: "expiração exige que o instante alcance expiresAt",
      });
    }
  }

  // ---- falha: nomeada, e apontando para o estado certo
  if (to === "FAILED" && input.failure === undefined) {
    violations.push({
      code: "FAILURE_KIND_REQUIRED",
      field: "failure",
      detail: "FAILED exige uma das 10 falhas sintéticas do docs/74 §11",
    });
  }
  if (input.failure !== undefined) {
    if (to !== "FAILED" && to !== "EXPIRED") {
      violations.push({
        code: "FAILURE_KIND_NOT_ALLOWED",
        field: "failure",
        detail: `falha sintética não se aplica a ${to}; bloqueio e cancelamento não são defeito`,
      });
    } else if (FAILURE_TARGET[input.failure] !== to) {
      violations.push({
        code: "FAILURE_KIND_MISMATCH",
        field: "failure",
        detail: `${input.failure} termina em ${FAILURE_TARGET[input.failure]}, não em ${to}`,
      });
    }
  }

  // ---- protocolo: so no sucesso, so o sintetico
  if (input.syntheticProtocol !== undefined) {
    if (to !== "COMPLETED") {
      violations.push({
        code: "PROTOCOL_NOT_ALLOWED",
        field: "syntheticProtocol",
        detail: "somente COMPLETED admite protocolo; falha nunca produz protocolo",
      });
    } else if (!input.syntheticProtocol.startsWith(LAB_SYNTHETIC_PROTOCOL_PREFIX)) {
      violations.push({
        code: "PROTOCOL_NOT_ALLOWED",
        field: "syntheticProtocol",
        detail: `fora do padrão sintético ${LAB_SYNTHETIC_PROTOCOL_PREFIX}*`,
      });
    }
  }

  if (violations.length > 0) return reject(from, violations);

  const reason = input.reason ?? input.failure ?? "";

  return {
    ok: true,
    previousState: from,
    nextState: to,
    session: withState(session, to),
    events: [
      buildEvent(session, EVENT_BY_STATE[to], from, to, input.at, input.step ?? null, reason),
    ],
    syntheticProtocol: input.syntheticProtocol ?? null,
    alarm: input.failure !== undefined && ALARM_FAILURES.has(input.failure),
    violations: [],
  };
}

// --------------------------------------------------------------- etapas

export interface SyntheticStepInput {
  session: unknown;
  /** Nome da etapa sintetica; vai redigido para o evento. */
  step: string;
  phase: "STARTED" | "COMPLETED";
  at: string;
  reason?: string;
}

const STEP_EVENT = {
  STARTED: "synthetic_session_step_started",
  COMPLETED: "synthetic_session_step_completed",
} as const satisfies Record<SyntheticStepInput["phase"], SyntheticLabEventName>;

/**
 * Registra uma etapa sintetica e emite o evento de etapa.
 *
 * NAO muda o estado da sessao: etapa acontece DENTRO de `IN_PROGRESS`
 * (docs/74 §7 — etapa so sai de `PENDING` com o run em `RUNNING`, e o run so
 * roda com a sessao em `IN_PROGRESS`). Por isso `previousState` e `nextState`
 * sao ambos `IN_PROGRESS`: o par continua presente em todo evento (§12), e a
 * igualdade e a informacao — a sessao nao se moveu.
 *
 * Nao confere se a etapa pertence ao `scope`: `scope` e capacidade
 * (`LAB_GUIA_TRAFEGO_SYNTHETIC`) e etapa e passo de jornada — vocabularios
 * diferentes. Etapa fora do escopo e a falha `STEP_UNAVAILABLE`, decidida por
 * quem executa (docs/74 §11.2).
 */
export function recordSyntheticStep(input: SyntheticStepInput): SyntheticLifecycleResult {
  const read = readSession(input.session);
  if (!read.ok) return read.result;

  const session = read.session;
  const from = session.handoffState;
  const violations: SyntheticLifecycleViolation[] = [];

  checkTimestamp(input.at, violations);
  scanFreeText("step", input.step, violations);
  scanFreeText("reason", input.reason, violations);

  if (from !== "IN_PROGRESS") {
    violations.push({
      code: "STEP_REQUIRES_IN_PROGRESS",
      field: "handoffState",
      detail: `etapa sintética exige a sessão em IN_PROGRESS; está em ${from}`,
    });
  }

  if (isIsoTimestamp(input.at) && isExpiredAt(session, input.at)) {
    violations.push({
      code: "SESSION_EXPIRED",
      field: "at",
      detail: "handle vencido durante a etapa: o motor para e registra EXPIRED",
    });
  }

  if (violations.length > 0) return reject(from, violations);

  return {
    ok: true,
    previousState: "IN_PROGRESS",
    nextState: "IN_PROGRESS",
    session: withState(session, "IN_PROGRESS"),
    events: [
      buildEvent(
        session,
        STEP_EVENT[input.phase],
        "IN_PROGRESS",
        "IN_PROGRESS",
        input.at,
        input.step,
        input.reason ?? "",
      ),
    ],
    syntheticProtocol: null,
    alarm: false,
    violations: [],
  };
}
