/**
 * Idempotência DURÁVEL de REQUEST administrativo — não confundir com a
 * idempotência de ETAPA/LOTE que `SyntheticRunStore`/`dispatchSyntheticBatch`
 * já garantem. Aqui a chave é `requestId` (o pedido administrativo em si);
 * repetir o mesmo pedido nunca deve chamar o dispatcher de novo, mesmo
 * depois de o processo reiniciar.
 *
 * Só o CONTRATO mora aqui — as implementações estão em
 * `inMemoryManualDispatchRequestRegistry.ts` (memória, testes/laboratório) e
 * `prismaManualDispatchRequestRegistry.ts` (Postgres, durável). Mesmo padrão
 * de `syntheticRunStore.ts` / `inMemorySyntheticRunStore.ts` /
 * `prismaSyntheticRunStore.ts`.
 *
 * A GARANTIA de concorrência (dois processos nunca executam legitimamente o
 * mesmo request) precisa existir no BANCO, não só na aplicação — por isso o
 * contrato tem uma operação de RESERVA (`reserve`) distinta de um `save` às
 * cegas: só ela decide, de forma atômica, quem tem autorização para chamar o
 * dispatcher.
 */
import { createHash } from "node:crypto";
import type { ManualDispatchAdminRole, ManualDispatchEnvironment, ManualSyntheticDispatchResult } from "./manualSyntheticDispatchTypes";
import type { ManualSyntheticDispatchPolicyConfig } from "./manualSyntheticDispatchPolicy";

// ------------------------------------------------------------------ status

/** Estado persistido do PEDIDO administrativo — não confundir com `ManualSyntheticDispatchOutcome` (vocabulário do resultado). */
export const MANUAL_DISPATCH_REQUEST_STATUSES = ["PENDING", "COMPLETED", "DENIED", "FAILED", "CANCELLED"] as const;
export type ManualDispatchRequestStatus = (typeof MANUAL_DISPATCH_REQUEST_STATUSES)[number];

const TERMINAL_REQUEST_STATUS_SET: ReadonlySet<ManualDispatchRequestStatus> = new Set(["COMPLETED", "DENIED", "FAILED", "CANCELLED"]);

export function isTerminalManualDispatchRequestStatus(status: ManualDispatchRequestStatus): boolean {
  return TERMINAL_REQUEST_STATUS_SET.has(status);
}

// -------------------------------------------------------------- fingerprint

/**
 * Só os campos que definem a IDENTIDADE LÓGICA do pedido — tudo que
 * influencia a decisão da política precisa estar aqui, porque o `reserve()`
 * roda ANTES da política (ver `manualSyntheticDispatchTrigger.ts`): sem
 * isso, dois pedidos com o MESMO `requestId` mas `role`/`policyConfig`
 * diferentes poderiam repetir (`replay`) uma decisão que não corresponde
 * mais à entrada atual.
 *
 * NUNCA inclui dependência de runtime: `store`, `executor`, `logger`,
 * `resolveSession`, `signal` ou qualquer função — só dado serializável.
 */
export interface ManualDispatchRequestFingerprintInput {
  requestId: string;
  batchId: string;
  role: ManualDispatchAdminRole;
  environment: ManualDispatchEnvironment;
  explicitConfirmation: boolean;
  /** Já redigido por quem chama — o fingerprint nunca redige de novo nem guarda o cru. */
  requestedBy: string;
  reason: string;
  requestedAt: string;
  maxRuns: number;
  maxConcurrency: number;
  deadlineAt: string;
  policyConfig: ManualSyntheticDispatchPolicyConfig;
}

/**
 * Hash SHA-256 estável do payload que importa — mesmo padrão já usado pelo
 * store sintético (`computePayloadFingerprint`,
 * `prismaSyntheticRunStore.ts`). Chave/segredo nenhum aqui: só precisa ser
 * estável e distinguir payloads diferentes.
 */
export function computeManualDispatchRequestFingerprint(input: ManualDispatchRequestFingerprintInput): string {
  const canonical = JSON.stringify({
    requestId: input.requestId,
    batchId: input.batchId,
    role: input.role,
    environment: input.environment,
    explicitConfirmation: input.explicitConfirmation,
    requestedBy: input.requestedBy,
    reason: input.reason,
    requestedAt: input.requestedAt,
    maxRuns: input.maxRuns,
    maxConcurrency: input.maxConcurrency,
    deadlineAt: input.deadlineAt,
    allowedRoles: [...input.policyConfig.allowedRoles].sort(),
    allowDegradedHealth: input.policyConfig.allowDegradedHealth,
    maxRecentRequests: input.policyConfig.maxRecentRequests,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// --------------------------------------------------------------- registro

/** Lease administrativa — protege a janela `reservar → dispatcher → salvar`. Nunca identidade sensível: só rótulos fictícios/opacos. */
export interface ManualDispatchLease {
  executionToken: string;
  claimedBy: string;
  claimedAt: string;
  expiresAt: string;
}

/**
 * Contexto do pedido gravado NO MOMENTO da reserva — presente mesmo enquanto
 * `result` ainda é `null` (`status === "PENDING"`), para que um pedido
 * interrompido continue INSPECIONÁVEL (`listRecoverable`) sem precisar
 * esperar o resultado final existir.
 */
export interface ManualDispatchRequestRegistryEntry {
  requestId: string;
  batchId: string;
  fingerprint: string;
  status: ManualDispatchRequestStatus;
  /** Já redigido por quem chama. */
  requestedBy: string;
  environment: ManualDispatchEnvironment;
  /** Já redigido por quem chama. */
  reason: string;
  requestedAt: string;
  /** `null` só enquanto `status === "PENDING"` e o resultado final ainda não foi gravado. */
  result: ManualSyntheticDispatchResult | null;
  /** `null` quando não há reserva ativa (`status` terminal já concluído/liberado). */
  lease: ManualDispatchLease | null;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------- violações

export const MANUAL_DISPATCH_REGISTRY_VIOLATION_CODES = [
  "REQUEST_NOT_FOUND",
  "REQUEST_ALREADY_EXISTS",
  "REQUEST_FINGERPRINT_CONFLICT",
  "REQUEST_ALREADY_RUNNING",
  "REQUEST_LEASE_EXPIRED",
  "REQUEST_OWNER_MISMATCH",
  "REQUEST_VERSION_CONFLICT",
  "REQUEST_INVALID_STORED_RESULT",
  "REQUEST_RECOVERY_REQUIRED",
] as const;

export type ManualDispatchRegistryViolationCode = (typeof MANUAL_DISPATCH_REGISTRY_VIOLATION_CODES)[number];

export interface ManualDispatchRegistryViolation {
  code: ManualDispatchRegistryViolationCode;
  detail: string;
}

// -------------------------------------------------------------- reserve()

export interface ReserveManualDispatchRequestInput {
  requestId: string;
  batchId: string;
  fingerprint: string;
  /** Já redigido por quem chama. */
  requestedBy: string;
  environment: ManualDispatchEnvironment;
  /** Já redigido por quem chama. */
  reason: string;
  requestedAt: string;
  /** Rótulo opaco de quem está tentando reservar — NUNCA identidade sensível (ex.: `manual-${requestId}`, o mesmo padrão de `workerIdPrefix`). */
  claimedBy: string;
  at: string;
  /** TTL da lease administrativa, em ms — mesma ideia do `claimTtlMs` do dispatcher, mas para a RESERVA do pedido, não da etapa. */
  leaseTtlMs: number;
}

export type ReserveManualDispatchRequestResult =
  | { outcome: "RESERVED"; lease: ManualDispatchLease }
  | { outcome: "REPLAY"; entry: ManualDispatchRequestRegistryEntry }
  | { outcome: "FINGERPRINT_CONFLICT" }
  | { outcome: "ALREADY_RUNNING" }
  | { outcome: "RECOVERY_REQUIRED"; entry: ManualDispatchRequestRegistryEntry };

// --------------------------------------------------------------- finish()

export interface FinishManualDispatchRequestInput {
  requestId: string;
  executionToken: string;
  status: Exclude<ManualDispatchRequestStatus, "PENDING">;
  result: ManualSyntheticDispatchResult;
  at: string;
}

export type FinishManualDispatchRequestResult =
  | { ok: true; entry: ManualDispatchRequestRegistryEntry }
  | { ok: false; violation: ManualDispatchRegistryViolation };

// -------------------------------------------------------------- release()

export interface ReleaseManualDispatchRequestInput {
  requestId: string;
  executionToken: string;
}

export type ReleaseManualDispatchRequestResult = { ok: true } | { ok: false; violation: ManualDispatchRegistryViolation };

// ------------------------------------------------------------------ contrato

/**
 * Contrato assíncrono. Responsabilidades:
 * - `reserve`: única porta de entrada ANTES do dispatcher — decide replay,
 *   conflito de fingerprint, execução concorrente, recuperação pendente ou
 *   autorização nova, atomicamente;
 * - `find`: leitura pura, sem reservar nada;
 * - `finish`: grava o resultado final e libera a reserva (sucesso, falha OU
 *   negação — qualquer status terminal);
 * - `release`: libera a reserva SEM gravar resultado final (usada só se o
 *   chamador desistir antes de ter um resultado para persistir);
 * - `listRecoverable`: requests `PENDING` com lease vencida — só
 *   CLASSIFICAÇÃO, nunca dispara execução (ver `manualSyntheticDispatchTrigger.ts`);
 * - `count`: total de pedidos registrados — usado só pela política como sinal de limite de taxa.
 */
export interface ManualDispatchRequestRegistry {
  reserve(input: ReserveManualDispatchRequestInput): Promise<ReserveManualDispatchRequestResult>;
  find(requestId: string): Promise<ManualDispatchRequestRegistryEntry | null>;
  finish(input: FinishManualDispatchRequestInput): Promise<FinishManualDispatchRequestResult>;
  release(input: ReleaseManualDispatchRequestInput): Promise<ReleaseManualDispatchRequestResult>;
  /**
   * ponytail: filtro simples (`status === PENDING` + `lease.expiresAt <= at`),
   * sem paginação — volume esperado de pedidos administrativos é baixo;
   * paginar é o caminho se isso deixar de ser verdade.
   */
  listRecoverable(at: string): Promise<readonly ManualDispatchRequestRegistryEntry[]>;
  count(): Promise<number>;
}
