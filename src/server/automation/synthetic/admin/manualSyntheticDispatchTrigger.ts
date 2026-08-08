/**
 * Acionador ADMINISTRATIVO MANUAL do dispatcher sintético:
 *
 *   solicitação explícita → checar replay → avaliar política (papel,
 *   ambiente, confirmação, motivo, configuração, limite de taxa, health,
 *   readiness) → registrar início redigido → chamar `dispatchSyntheticBatch`
 *   UMA única vez → resultado administrativo redigido → registrar → encerrar
 *
 * NÃO é scheduler, cron nem serviço contínuo — uma chamada SEMPRE termina.
 * NÃO redesenha o dispatcher: toda seleção/claim/execução/idempotência de
 * ETAPA continua inteiramente em `dispatchSyntheticBatch`; este módulo só
 * decide SE aquela chamada pode acontecer e traduz o resultado para o
 * vocabulário administrativo. A idempotência tratada AQUI é outra: a do
 * PEDIDO administrativo (`requestId`), via `ManualDispatchRequestRegistry` —
 * ver `manualDispatchRequestRegistry.ts`.
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
import type {
  ManualSyntheticDispatchAdminContext,
  ManualSyntheticDispatchBatchSummary,
  ManualSyntheticDispatchOutcome,
  ManualSyntheticDispatchPolicyDecision,
  ManualSyntheticDispatchResult,
  ManualSyntheticDispatchWarning,
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
  return { ...input };
}

/**
 * Aciona manualmente UM lote sintético. Uma chamada SEMPRE termina — sem
 * `while`, sem timer recorrente, sem nova chamada a si mesma.
 */
export async function triggerManualSyntheticDispatch(input: ManualSyntheticDispatchInput): Promise<ManualSyntheticDispatchResult> {
  const { requestId, batchId, reason, requestedAt, maxRuns, maxConcurrency, deadlineAt, claimTtlMs, store, executor, resolveSession, logger, now, context, health, readiness, registry, signal } = input;
  const policyConfig: ManualSyntheticDispatchPolicyConfig = { ...DEFAULT_MANUAL_DISPATCH_POLICY_CONFIG, ...input.policyConfig };
  const workerIdPrefix = input.workerIdPrefix ?? `manual-${requestId}`;

  const requestedBy = redactLabText(input.requestedBy).text;
  const redactedReason = redactLabText(reason).text;

  await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_REQUESTED", timestamp: requestedAt, reason: redactedReason, counters: { maxRuns, maxConcurrency } }));

  // ---- 0. replay do PEDIDO — nunca chama o dispatcher de novo
  const existing = requestId.trim() === "" ? null : await registry.find(requestId);
  const fingerprint = computeManualDispatchRequestFingerprint({ batchId, requestedBy, reason: redactedReason, maxRuns, maxConcurrency, deadlineAt });

  if (existing !== null) {
    if (existing.fingerprint === fingerprint) {
      await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_REPLAYED", timestamp: now() }));
      return { ...existing.result, outcome: "REQUEST_REPLAYED" };
    }
    const denied = buildResult({
      requestId,
      batchId,
      requestedAt,
      completedAt: now(),
      requestedBy,
      reason: redactedReason,
      decision: "DENIED_DUPLICATE_REQUEST",
      outcome: "REQUEST_DENIED",
      batch: null,
      metrics: null,
      health,
      readiness,
      warnings: [],
    });
    await safeEmit(logger, buildSyntheticEngineLogEvent({ code: "MANUAL_DISPATCH_DENIED", timestamp: denied.completedAt, outcome: "DENIED_DUPLICATE_REQUEST" }));
    return denied;
  }

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
    return denied;
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
    await registry.save({ requestId, fingerprint, result: failed });
    return failed;
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
  await registry.save({ requestId, fingerprint, result });

  return result;
}
