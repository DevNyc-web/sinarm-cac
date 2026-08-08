/**
 * Acionador ADMINISTRATIVO MANUAL do dispatcher sintético:
 *
 *   solicitação explícita → reservar PEDIDO (replay/conflito/em execução/
 *   recuperável/reservado) → se reservado, avaliar política (papel,
 *   ambiente, confirmação, motivo, configuração, limite de taxa, health,
 *   readiness) → registrar início redigido → chamar `dispatchSyntheticBatch`
 *   UMA única vez → persistir resultado final → encerrar
 *
 * NÃO é scheduler, cron nem serviço contínuo — uma chamada SEMPRE termina.
 * NÃO redesenha o dispatcher: toda seleção/claim/execução/idempotência de
 * ETAPA continua inteiramente em `dispatchSyntheticBatch`; este módulo só
 * decide SE aquela chamada pode acontecer e traduz o resultado para o
 * vocabulário administrativo. A idempotência tratada AQUI é outra: a do
 * PEDIDO administrativo (`requestId`), via `ManualDispatchRequestRegistry` —
 * ver `manualDispatchRequestRegistry.ts`. NÃO importa Prisma: só a
 * interface do registry, injetada por quem chama.
 *
 * ORDEM DELIBERADA — reserva ANTES da política: o fingerprint (calculado
 * ANTES de qualquer avaliação) já captura tudo que influencia a decisão da
 * política, então `reserve()` sozinho decide corretamente replay (de
 * QUALQUER outcome, inclusive negado) e conflito, sem gastar avaliação de
 * política em pedidos que nunca vão rodar. A garantia de concorrência real
 * (dois processos não executam o mesmo pedido) fica inteiramente no banco,
 * dentro de `reserve()`.
 *
 * `health`/`readiness` são sempre FORNECIDOS por quem chama (já calculados
 * por `buildSyntheticEngineHealth`/`buildSyntheticEngineReadiness`) — este
 * módulo nunca consulta portal, rede ou store para produzi-los.
 */
import { dispatchSyntheticBatch, type SyntheticBatchDispatchResult } from "../dispatcher/syntheticBatchDispatcher";
import type { SyntheticRunStore } from "../store/syntheticRunStore";
import type { SyntheticStepExecutor } from "../playwright/syntheticStepExecutor";
import { buildSyntheticEngineLogEvent, type SyntheticEngineLogEvent, type SyntheticEngineLogger } from "../observability/syntheticEngineLogger";
import { buildSyntheticEngineMetrics } from "../observability/syntheticEngineMetrics";
import type { SyntheticEngineHealthStatus } from "../observability/syntheticEngineHealth";
import type { SyntheticEngineReadinessStatus } from "../observability/syntheticEngineReadiness";
import { redactLabText } from "../../redaction";
import {
  computeManualDispatchRequestFingerprint,
  type ManualDispatchRequestRegistry,
} from "./manualDispatchRequestRegistry";
import {
  DEFAULT_MANUAL_DISPATCH_POLICY_CONFIG,
  evaluateManualSyntheticDispatchPolicy,
  type ManualSyntheticDispatchPolicyConfig,
} from "./manualSyntheticDispatchPolicy";
import {
  MANUAL_DISPATCH_RESULT_FORMAT_VERSION,
  type ManualSyntheticDispatchAdminContext,
  type ManualSyntheticDispatchBatchSummary,
  type ManualSyntheticDispatchOutcome,
  type ManualSyntheticDispatchPolicyDecision,
  type ManualSyntheticDispatchResult,
  type ManualSyntheticDispatchWarning,
} from "./manualSyntheticDispatchTypes";

export interface ManualSyntheticDispatchInput {
  requestId: string;
  batchId: string;
  /** Identificador do solicitante — texto livre, sempre redigido antes de sair deste módulo. */
  requestedBy: string;
  reason: string;
  requestedAt: string;
  maxRuns: number;
  maxConcurrency: number;
  deadlineAt: string;
  claimTtlMs: number;
  /** TTL da lease administrativa (reserva do PEDIDO, não da etapa). Default: tempo até `deadlineAt` + 60s de folga. */
  leaseTtlMs?: number;
  store: SyntheticRunStore;
  executor: SyntheticStepExecutor;
  resolveSession: (runId: string) => Promise<unknown>;
  logger?: SyntheticEngineLogger;
  /** Relógio de CONTROLE — nunca `Date.now()` direto; mesmo papel do `now` de `dispatchSyntheticBatch`. */
  now: () => string;
  context: ManualSyntheticDispatchAdminContext;
  /** Já calculado por quem chama — ver `buildSyntheticEngineHealth`. */
  health: SyntheticEngineHealthStatus;
  /** Já calculado por quem chama — ver `buildSyntheticEngineReadiness`. */
  readiness: SyntheticEngineReadinessStatus;
  registry: ManualDispatchRequestRegistry;
  policyConfig?: Partial<ManualSyntheticDispatchPolicyConfig>;
  workerIdPrefix?: string;
  signal?: { readonly aborted: boolean };
}

/** Mesma política segura do dispatcher: falha do logger nunca propaga, nunca duplica execução. */
async function safeEmit(logger: SyntheticEngineLogger | undefined, event: SyntheticEngineLogEvent): Promise<void> {
  if (logger === undefined) return;
  try {
    await logger.emit(event);
  } catch {
    // erro de observabilidade não pode duplicar execução nem causar retry
  }
}

function batchSummary(batch: SyntheticBatchDispatchResult): ManualSyntheticDispatchBatchSummary {
  return {
    stopReason: batch.stopReason,
    requested: batch.requested,
    dispatched: batch.dispatched,
    completed: batch.completed,
    conflicted: batch.conflicted,
    noWork: batch.noWork,
    interrupted: batch.interrupted,
  };
}

function classifyOutcome(batch: SyntheticBatchDispatchResult): ManualSyntheticDispatchOutcome {
  if (batch.stopReason === "CANCELLED") return "DISPATCH_CANCELLED";
  if (batch.stopReason === "INVALID_CONFIGURATION") return "DISPATCH_FAILED";
  if (batch.dispatched === 0) return "DISPATCH_EMPTY";
  if (batch.completed === batch.dispatched && batch.conflicted === 0 && batch.interrupted === 0) return "DISPATCH_COMPLETED";
  return "DISPATCH_PARTIAL";
}

/** `status` do registry (nunca `PENDING`) equivalente a um `outcome`/`decision` administrativos. */
function statusForOutcome(outcome: ManualSyntheticDispatchOutcome): "COMPLETED" | "DENIED" | "FAILED" | "CANCELLED" {
  if (outcome === "REQUEST_DENIED") return "DENIED";
  if (outcome === "DISPATCH_CANCELLED") return "CANCELLED";
  if (outcome === "DISPATCH_FAILED" || outcome === "RESULT_PERSISTENCE_FAILED") return "FAILED";
  return "COMPLETED";
}

interface BuildResultInput {
  requestId: string;
  batchId: string;
  requestedAt: string;
  completedAt: string;
  requestedBy: string;
  reason: string;
  decision: ManualSyntheticDispatchPolicyDecision;
  outcome: ManualSyntheticDispatchOutcome;
  batch: ManualSyntheticDispatchBatchSummary | null;
  metrics: ReturnType<typeof buildSyntheticEngineMetrics> | null;
  health: SyntheticEngineHealthStatus;
  readiness: SyntheticEngineReadinessStatus;
  warnings: readonly ManualSyntheticDispatchWarning[];
}

function buildResult(input: BuildResultInput): ManualSyntheticDispatchResult {
  return { formatVersion: MANUAL_DISPATCH_RESULT_FORMAT_VERSION, ...input };
}

function defaultLeaseTtlMs(requestedAt: string, deadlineAt: string): number {
  const untilDeadline = Math.max(0, Date.parse(deadlineAt) - Date.parse(requestedAt));
  return untilDeadline + 60_000;
}

/**
 * Tenta gravar o resultado final e liberar a reserva. Se `finish()` falhar
 * (exceção OU violação tipada — dono trocou, versão conflitante, resultado
 * inválido), o resultado devolvido é o MESMO, mas com `outcome` sobreposto
 * para `RESULT_PERSISTENCE_FAILED`: o lote pode ter rodado, mas a gravação
 * não pôde ser confirmada. NUNCA reexecuta o dispatcher por causa disso —
 * é só um sinal para inspeção administrativa.
 */
async function finishSafely(
  registry: ManualDispatchRequestRegistry,
  requestId: string,
  executionToken: string,
  outcome: ManualSyntheticDispatchOutcome,
  result: ManualSyntheticDispatchResult,
  at: string,
): Promise<ManualSyntheticDispatchResult> {
  try {
    const finished = await registry.finish({ requestId, executionToken, status: statusForOutcome(outcome), result, at });
    if (finished.ok) return finished.entry.result ?? result;
  } catch {
    // cai no mesmo tratamento abaixo — engolido de propósito
  }
  return { ...result, outcome: "RESULT_PERSISTENCE_FAILED", warnings: [...result.warnings, { code: "RESULT_PERSISTENCE_FAILED", detail: "resultado administrativo não pôde ser confirmado como persistido — requer inspeção" }] };
}

/**
 * Aciona manualmente UM lote sintético. Uma chamada SEMPRE termina — sem
 * `while`, sem timer recorrente, sem nova chamada a si mesma.
 */
export async function triggerManualSyntheticDispatch(input: ManualSyntheticDispatchInput): Promise<ManualSyntheticDispatchResult> {
  const { requestId, batchId, reason, requestedAt, maxRuns, maxConcurrency, deadlineAt, claimTtlMs, store, executor, resolveSession, logger, now, context, health, readiness, registry, signal } = input;
  const policyConfig: ManualSyntheticDispatchPolicyConfig = { ...DEFAULT_MANUAL_DISPATCH_POLICY_CONFIG, ...input.policyConfig };
  const workerIdPrefix = input.workerIdPrefix ?? `manual-${requestId}`;
  const leaseTtlMs = input.leaseTtlMs ?? defaultLeaseTtlMs(requestedAt, deadlineAt);

  const requestedBy = redactLabText(input.requestedBy).text;
  const redactedReason = redactLabText(reason).text;

  await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_REQUESTED", timestamp: requestedAt, reason: redactedReason, counters: { maxRuns, maxConcurrency } }));

  const denyWithoutReserve = async (decision: ManualSyntheticDispatchPolicyDecision): Promise<ManualSyntheticDispatchResult> => {
    const denied = buildResult({
      requestId,
      batchId,
      requestedAt,
      completedAt: now(),
      requestedBy,
      reason: redactedReason,
      decision,
      outcome: "REQUEST_DENIED",
      batch: null,
      metrics: null,
      health,
      readiness,
      warnings: [],
    });
    await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_DENIED", timestamp: denied.completedAt, outcome: decision }));
    return denied;
  };

  // ---- 0. reserva do PEDIDO — decide replay/conflito/em execução/recuperável/reservado, atomicamente
  const fingerprint = computeManualDispatchRequestFingerprint({
    requestId,
    batchId,
    role: context.role,
    environment: context.environment,
    explicitConfirmation: context.explicitConfirmation,
    requestedBy,
    reason: redactedReason,
    requestedAt,
    maxRuns,
    maxConcurrency,
    deadlineAt,
    policyConfig,
  });

  // `at` é o relógio de CONTROLE (`now()`), não o domínio (`requestedAt`): é
  // ele que decide "esta lease já venceu?" — o mesmo papel que `now()` tem em
  // `dispatchSyntheticBatch`. `requestedAt` seguiria igual em todo replay do
  // MESMO pedido; `now()` não — e é exatamente essa variação que permite
  // detectar lease vencida sem depender de o pedido em si ter mudado.
  const reserved = await registry.reserve({ requestId, batchId, fingerprint, requestedBy, environment: context.environment, reason: redactedReason, requestedAt, claimedBy: workerIdPrefix, at: now(), leaseTtlMs });

  if (reserved.outcome === "REPLAY") {
    await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_REPLAYED", timestamp: now() }));
    if (reserved.entry.result === null) {
      // Nunca deveria acontecer (status terminal sempre grava resultado) — sinaliza sem inventar dado.
      return buildResult({ requestId, batchId, requestedAt, completedAt: now(), requestedBy, reason: redactedReason, decision: "ALLOWED", outcome: "RESULT_PERSISTENCE_FAILED", batch: null, metrics: null, health, readiness, warnings: [{ code: "RESULT_PERSISTENCE_FAILED", detail: "registro terminal sem resultado gravado" }] });
    }
    return { ...reserved.entry.result, outcome: "REQUEST_REPLAYED" };
  }
  if (reserved.outcome === "FINGERPRINT_CONFLICT") return denyWithoutReserve("DENIED_DUPLICATE_REQUEST");
  if (reserved.outcome === "ALREADY_RUNNING") return denyWithoutReserve("DENIED_ALREADY_RUNNING");
  if (reserved.outcome === "RECOVERY_REQUIRED") return denyWithoutReserve("DENIED_RECOVERY_REQUIRED");

  // reserved.outcome === "RESERVED" — esta chamada, e só ela, pode prosseguir.
  const { executionToken } = reserved.lease;

  // ---- 1. política — papel, ambiente, confirmação, motivo, configuração, limite de taxa, health, readiness
  const recentRequestCount = await registry.count();
  const policyResult = evaluateManualSyntheticDispatchPolicy(
    { context, reason: redactedReason, requestId, batchId, maxRuns, maxConcurrency, deadlineAt, requestedAt, health, readiness, recentRequestCount },
    policyConfig,
  );

  if (policyResult.decision !== "ALLOWED") {
    const denied = buildResult({
      requestId,
      batchId,
      requestedAt,
      completedAt: now(),
      requestedBy,
      reason: redactedReason,
      decision: policyResult.decision,
      outcome: "REQUEST_DENIED",
      batch: null,
      metrics: null,
      health,
      readiness,
      warnings: [],
    });
    await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_DENIED", timestamp: denied.completedAt, outcome: policyResult.decision }));
    return finishSafely(registry, requestId, executionToken, "REQUEST_DENIED", denied, denied.completedAt);
  }

  await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_ALLOWED", timestamp: now() }));
  await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_STARTED", timestamp: now(), counters: { maxRuns, maxConcurrency } }));

  // ---- 2. dispatcher existente, chamado UMA única vez
  let batch: SyntheticBatchDispatchResult;
  let outcome: ManualSyntheticDispatchOutcome;
  const warnings: ManualSyntheticDispatchWarning[] = [];
  if (health === "DEGRADED") {
    warnings.push({ code: "DEGRADED_HEALTH_OVERRIDE", detail: "lote executado com o motor em DEGRADED por decisão explícita da política" });
  }

  try {
    batch = await dispatchSyntheticBatch({
      store,
      executor,
      maxRuns,
      maxConcurrency,
      at: requestedAt,
      deadlineAt,
      now,
      claimTtlMs,
      resolveSession,
      idempotencyKeyFor: (runId) => `${batchId}:${runId}`,
      workerIdPrefix,
      signal,
      logger,
    });
    outcome = classifyOutcome(batch);
    if (outcome === "DISPATCH_PARTIAL") {
      warnings.push({ code: "PARTIAL_BATCH", detail: "nem todos os itens despachados concluíram com sucesso" });
    }
  } catch {
    // Erro inesperado de infraestrutura: não propaga cru — vira resultado
    // redigido, sem stack trace, mesma política do dispatcher para itens isolados.
    outcome = "DISPATCH_FAILED";
    warnings.push({ code: "UNEXPECTED_DISPATCH_FAILURE", detail: "erro inesperado ao chamar o dispatcher sintético" });
    const failed = buildResult({
      requestId,
      batchId,
      requestedAt,
      completedAt: now(),
      requestedBy,
      reason: redactedReason,
      decision: "ALLOWED",
      outcome,
      batch: null,
      metrics: null,
      health,
      readiness,
      warnings,
    });
    await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_FINISHED", timestamp: failed.completedAt, outcome }));
    return finishSafely(registry, requestId, executionToken, outcome, failed, failed.completedAt);
  }

  const metrics = buildSyntheticEngineMetrics({ batch });
  const result = buildResult({
    requestId,
    batchId,
    requestedAt,
    completedAt: now(),
    requestedBy,
    reason: redactedReason,
    decision: "ALLOWED",
    outcome,
    batch: batchSummary(batch),
    metrics,
    health,
    readiness,
    warnings,
  });

  await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_FINISHED", timestamp: result.completedAt, outcome }));

  // ---- 3. persistir resultado final e liberar a reserva — falha AQUI nunca reexecuta o dispatcher (ver `finishSafely`)
  return finishSafely(registry, requestId, executionToken, outcome, result, result.completedAt);
}
