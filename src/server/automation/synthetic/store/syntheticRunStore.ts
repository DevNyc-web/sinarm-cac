/**
 * Contratos de armazenamento DURÁVEL para o motor sintético — versão,
 * claim/reserva, idempotência e recuperação. Este módulo só define TIPOS e a
 * interface `SyntheticRunStore`; a implementação concreta (só em memória
 * nesta PR) mora em `inMemorySyntheticRunStore.ts`.
 *
 * NÃO importa Prisma, Redis, banco ou filesystem — nenhum adaptador real
 * ainda existe. O objetivo é deixar o CONTRATO pronto para um adaptador de
 * banco entrar depois sem reabrir esta camada.
 *
 * `StoredSyntheticRun` é uma PROJEÇÃO SEGURA de `SyntheticAutomationRun`
 * (`syntheticRunCoordinator.ts`) — nunca o objeto inteiro: a sessão vira só o
 * `SyntheticHandoffState` e o `auditCorrelationId`, nunca o `sessionHandle`.
 * Quem precisa RETOMAR um run fornece a sessão viva de novo, na hora — o
 * store nunca guarda o segredo.
 */
import {
  type SyntheticAutomationRun,
  type SyntheticCompletedRunStep,
  type SyntheticRunEvidence,
  type SyntheticRunPlan,
  type SyntheticRunResult,
  type SyntheticRunState,
  type SyntheticRunStep,
  type SyntheticRunViolation,
} from "../syntheticRunCoordinator";
import {
  isSuspiciousFieldName,
  scanSyntheticValue,
  type SyntheticHandoffState,
  type SyntheticViolationCode,
} from "../sessionContract";
import { SYNTHETIC_FAILURE_KINDS, type SyntheticFailureKind, type SyntheticLabEvent } from "../sessionLifecycle";

// ------------------------------------------------------------------- claim

/**
 * Reserva de trabalho sobre um run. Sem segredo: `workerId` é fictício,
 * escolhido por quem chama (ex.: `"worker-lab-0001"`) — nunca um id de
 * infraestrutura real.
 */
export interface SyntheticRunClaim {
  claimId: string;
  runId: string;
  workerId: string;
  claimedAt: string;
  expiresAt: string;
  /** Versão do run NO MOMENTO da reserva — usada só para diagnóstico, não substitui `expectedVersion` do `save`. */
  runVersionAtClaim: number;
}

/** Motivo tipado da última interrupção. Reusa `SyntheticFailureKind` — `"CAPTCHA"` é o único caso fora dele (`WAITING_HUMAN` não tem `SyntheticFailureKind` próprio). */
export type SyntheticRunInterruptionReason = SyntheticFailureKind | "CAPTCHA";

// --------------------------------------------------------------- registro

/**
 * Registro persistível FECHADO. Só os campos abaixo — nunca `sessionHandle`,
 * credencial, senha, token, cookie, storage state, CPF, HTML, screenshot,
 * stack trace, objeto arbitrário ou URL externa.
 */
export interface StoredSyntheticRun {
  runId: string;
  /** Monotônico, começa em 1. `save` exige `expectedVersion` igual a este valor. */
  version: number;
  runState: SyntheticRunState;
  /** Só o estado — nunca o `sessionHandle` nem o contrato inteiro. */
  sessionState: SyntheticHandoffState;
  plan: SyntheticRunPlan;
  pendingSteps: readonly SyntheticRunStep[];
  completedSteps: readonly SyntheticCompletedRunStep[];
  events: readonly SyntheticLabEvent[];
  evidence: readonly SyntheticRunEvidence[];
  humanFallbackRequired: boolean;
  result: SyntheticRunResult | null;
  createdAt: string;
  updatedAt: string;
  /** Substitui o `sessionHandle` como identificador de correlação seguro. */
  auditCorrelationId: string;
  /** `null` quando não há reserva ativa. */
  claim: SyntheticRunClaim | null;
  /** Quantas vezes uma execução de etapa foi TENTADA para este run (sucesso ou não). */
  attempts: number;
  /** Chave fictícia da CRIAÇÃO do run — imutável depois de criado. */
  idempotencyKey: string;
  /**
   * Chave de idempotência do ÚLTIMO `save` de ETAPA bem-sucedido — `null`
   * enquanto nenhuma etapa foi salva ainda. Permite ao serviço de execução
   * reconhecer um replay ANTES de reservar o run, mesmo quando o run já
   * chegou a um estado terminal (onde `claimNext` recusaria a reserva).
   */
  lastStepIdempotencyKey: string | null;
  /** `null` enquanto não há interrupção (run em fila/rodando) ou em `COMPLETED`/`CANCELLED`. */
  lastInterruptionReason: SyntheticRunInterruptionReason | null;
}

// --------------------------------------------------------------- violações

export const SYNTHETIC_RUN_STORE_VIOLATION_CODES = [
  "RUN_NOT_FOUND",
  "RUN_ALREADY_EXISTS",
  "IDEMPOTENCY_CONFLICT",
  "EMPTY_VALUE",
  "VERSION_CONFLICT",
  "CLAIM_NOT_FOUND",
  "CLAIM_ALREADY_ACTIVE",
  "CLAIM_EXPIRED",
  "CLAIM_OWNER_MISMATCH",
  "RUN_NOT_CLAIMABLE",
  "RUN_TERMINAL",
  "RUN_WAITING_HUMAN",
  "INVALID_STORED_RUN",
  "SESSION_MISMATCH",
  "NOT_AN_OBJECT",
  "UNKNOWN_FIELD",
  "MISSING_FIELD",
  "INVALID_TYPE",
] as const;

export type SyntheticRunStoreOwnViolationCode = (typeof SYNTHETIC_RUN_STORE_VIOLATION_CODES)[number];

/** Reusa o próprio código de violação do coordenador — o serviço de execução repassa falhas do runner sem traduzir. */
export interface SyntheticRunStoreViolation {
  code: SyntheticRunStoreOwnViolationCode | SyntheticViolationCode | SyntheticRunViolation["code"];
  field: string | null;
  detail: string;
}

// ------------------------------------------------------------------ store

export interface CreateStoredRunInput {
  run: SyntheticAutomationRun;
  /** Fictícia, não vazia — nunca só `runId` como chave de idempotência. */
  idempotencyKey: string;
  at: string;
}

export type CreateStoredRunResult =
  | { ok: true; created: boolean; run: StoredSyntheticRun; violations: readonly [] }
  | { ok: false; run: StoredSyntheticRun | null; violations: readonly SyntheticRunStoreViolation[] };

export interface SaveStoredRunInput {
  runId: string;
  expectedVersion: number;
  run: SyntheticAutomationRun;
  at: string;
  /** Se igual à chave do último `save` bem-sucedido deste run, devolve o registro atual SEM reaplicar (idempotência de etapa). */
  idempotencyKey?: string;
}

export type SaveStoredRunResult =
  | { ok: true; run: StoredSyntheticRun; violations: readonly [] }
  | { ok: false; run: StoredSyntheticRun | null; violations: readonly SyntheticRunStoreViolation[] };

export interface ClaimNextInput {
  runId: string;
  workerId: string;
  at: string;
  ttlMs: number;
}

export type ClaimResult =
  | { ok: true; claim: SyntheticRunClaim; violations: readonly [] }
  | { ok: false; claim: null; violations: readonly SyntheticRunStoreViolation[] };

export interface RenewClaimInput {
  runId: string;
  claimId: string;
  workerId: string;
  at: string;
  ttlMs: number;
}

export interface ReleaseClaimInput {
  runId: string;
  claimId: string;
  workerId: string;
}

export type ReleaseClaimResult =
  | { ok: true; violations: readonly [] }
  | { ok: false; violations: readonly SyntheticRunStoreViolation[] };

export interface ListRecoverableInput {
  at: string;
}

/**
 * Contrato de armazenamento. Async de propósito — o adaptador em memória
 * cumpre a mesma forma que um adaptador de banco cumpriria depois.
 */
export interface SyntheticRunStore {
  create(input: CreateStoredRunInput): Promise<CreateStoredRunResult>;
  getById(runId: string): Promise<StoredSyntheticRun | null>;
  save(input: SaveStoredRunInput): Promise<SaveStoredRunResult>;
  claimNext(input: ClaimNextInput): Promise<ClaimResult>;
  renewClaim(input: RenewClaimInput): Promise<ClaimResult>;
  releaseClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult>;
  completeClaim(input: ReleaseClaimInput): Promise<ReleaseClaimResult>;
  listRecoverable(input: ListRecoverableInput): Promise<readonly StoredSyntheticRun[]>;
}

// -------------------------------------------------------------- projeção

/**
 * Deriva o motivo tipado da última interrupção a partir do ESTADO do run e,
 * quando `FAILED`, do texto (já redigido) da última evidência — o mesmo
 * formato fixo (`falha sintética: ${kind}`) que `syntheticRunCoordinator.ts`
 * sempre produz. Não lê nada além do que o coordenador já expõe: não é
 * parsing de texto livre arbitrário, é casar contra os 10 nomes fechados de
 * `SYNTHETIC_FAILURE_KINDS`.
 */
function deriveInterruptionReason(run: SyntheticAutomationRun): SyntheticRunInterruptionReason | null {
  if (run.state === "WAITING_HUMAN") return "CAPTCHA";
  if (run.state === "EXPIRED") return "HANDLE_EXPIRED";
  if (run.state !== "FAILED") return null;

  const last = run.evidence[run.evidence.length - 1];
  if (last === undefined) return null;
  return SYNTHETIC_FAILURE_KINDS.find((kind) => last.outcome.includes(kind)) ?? null;
}

/**
 * Projeta um `SyntheticAutomationRun` VIVO (com sessão completa) no registro
 * SEGURO persistível — a única função que sabe descartar o `sessionHandle`.
 */
export function toStoredSyntheticRun(
  run: SyntheticAutomationRun,
  meta: {
    version: number;
    idempotencyKey: string;
    lastStepIdempotencyKey: string | null;
    createdAt: string;
    updatedAt: string;
    attempts: number;
    claim: SyntheticRunClaim | null;
  },
): StoredSyntheticRun {
  return {
    runId: run.runId,
    version: meta.version,
    runState: run.state,
    sessionState: run.session.handoffState,
    plan: run.plan,
    pendingSteps: [...run.pendingSteps],
    completedSteps: [...run.completedSteps],
    events: [...run.events],
    evidence: [...run.evidence],
    humanFallbackRequired: run.humanFallbackRequired,
    result: run.result,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    auditCorrelationId: run.session.auditCorrelationId,
    claim: meta.claim,
    attempts: meta.attempts,
    idempotencyKey: meta.idempotencyKey,
    lastStepIdempotencyKey: meta.lastStepIdempotencyKey,
    lastInterruptionReason: deriveInterruptionReason(run),
  };
}

// ------------------------------------------------------------- validação

const STORED_RUN_FIELDS = [
  "runId",
  "version",
  "runState",
  "sessionState",
  "plan",
  "pendingSteps",
  "completedSteps",
  "events",
  "evidence",
  "humanFallbackRequired",
  "result",
  "createdAt",
  "updatedAt",
  "auditCorrelationId",
  "claim",
  "attempts",
  "idempotencyKey",
  "lastStepIdempotencyKey",
  "lastInterruptionReason",
] as const;

const STORED_RUN_FIELD_SET: ReadonlySet<string> = new Set(STORED_RUN_FIELDS);

/** Nomes de chave proibidos em QUALQUER profundidade do registro — mesmo dentro de `plan`/`evidence`. */
function scanKeysRecursively(field: string, value: unknown, out: SyntheticRunStoreViolation[], depth = 0): void {
  if (depth > 10 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanKeysRecursively(`${field}[${index}]`, item, out, depth + 1));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (isSuspiciousFieldName(key)) {
      out.push({
        code: "SUSPICIOUS_FIELD_NAME",
        field: `${field}.${key}`,
        detail: "nome sugere segredo/handle — registro persistível não pode carregar isso",
      });
      continue;
    }
    scanKeysRecursively(`${field}.${key}`, nested, out, depth + 1);
  }
}

export type StoredSyntheticRunValidation =
  | { ok: true; violations: readonly [] }
  | { ok: false; violations: readonly SyntheticRunStoreViolation[] };

/**
 * Valida um candidato a registro persistível. Reusa `scanSyntheticValue`
 * (host oficial/URL externa/CPF/segredo serializado) e `isSuspiciousFieldName`
 * — nenhuma trava de conteúdo nova aqui.
 */
export function validateStoredSyntheticRun(input: unknown): StoredSyntheticRunValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, violations: [{ code: "NOT_AN_OBJECT", field: null, detail: "registro precisa ser objeto" }] };
  }
  const record = input as Record<string, unknown>;
  const violations: SyntheticRunStoreViolation[] = [];

  for (const key of Object.keys(record)) {
    if (!STORED_RUN_FIELD_SET.has(key)) {
      violations.push({ code: "UNKNOWN_FIELD", field: key, detail: "campo fora do registro fechado" });
    }
  }
  for (const field of STORED_RUN_FIELDS) {
    if (!(field in record)) {
      violations.push({ code: "MISSING_FIELD", field, detail: "campo obrigatório ausente" });
    }
  }

  scanKeysRecursively("record", record, violations);
  violations.push(...scanSyntheticValue("record", record));

  if (typeof record.runId === "string" && record.runId.trim() === "") {
    violations.push({ code: "EMPTY_VALUE", field: "runId", detail: "runId vazio" });
  }
  if (typeof record.idempotencyKey === "string" && record.idempotencyKey.trim() === "") {
    violations.push({ code: "EMPTY_VALUE", field: "idempotencyKey", detail: "chave de idempotência vazia" });
  }
  // Nenhuma checagem "terminal não pode ter claim ativo" aqui: o `save` que
  // LEVA um run a terminal naturalmente ainda carrega o claim ativo até o
  // `completeClaim` explícito logo depois (`syntheticStoredRunExecutor.ts`).
  // Quem impede reserva NOVA em run terminal é `claimNext`, não este validador.

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, violations: [] };
}
