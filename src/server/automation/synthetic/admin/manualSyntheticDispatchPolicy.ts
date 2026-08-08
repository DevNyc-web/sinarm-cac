/**
 * Política PURA do acionador administrativo manual — responde só "esta
 * solicitação pode prosseguir?", sem tocar store, dispatcher, logger ou
 * relógio. Toda entrada (inclusive `health`/`readiness`/`recentRequestCount`)
 * já vem calculada por quem chama; esta função não consulta nada.
 *
 * Ordem de verificação = ordem do fluxo administrativo: autorização
 * (papel → ambiente → confirmação → motivo) → configuração →
 * limite de taxa → saúde → prontidão. A primeira violação encontrada
 * decide — sem acumular lista (ao contrário do contrato de sessão sintética,
 * aqui só existe UMA decisão por pedido).
 */
import {
  MANUAL_DISPATCH_ADMIN_ROLES,
  MANUAL_DISPATCH_LIMITS,
  type ManualDispatchAdminRole,
  type ManualSyntheticDispatchAdminContext,
  type ManualSyntheticDispatchPolicyDecision,
  type ManualSyntheticDispatchPolicyResult,
} from "./manualSyntheticDispatchTypes";
import type { SyntheticEngineHealthStatus } from "../observability/syntheticEngineHealth";
import type { SyntheticEngineReadinessStatus } from "../observability/syntheticEngineReadiness";

export interface ManualSyntheticDispatchPolicyConfig {
  /** Papéis aceitos por esta implantação — nunca mais permissivo que `MANUAL_DISPATCH_ADMIN_ROLES`. */
  allowedRoles: readonly ManualDispatchAdminRole[];
  /** `true` só se esta implantação decidir explicitamente aceitar health `DEGRADED`. */
  allowDegradedHealth: boolean;
  /** Acima disto, novo pedido é recusado por `DENIED_RATE_LIMIT`. */
  maxRecentRequests: number;
}

export const DEFAULT_MANUAL_DISPATCH_POLICY_CONFIG: ManualSyntheticDispatchPolicyConfig = {
  allowedRoles: MANUAL_DISPATCH_ADMIN_ROLES,
  allowDegradedHealth: false,
  maxRecentRequests: 20,
};

export interface ManualSyntheticDispatchPolicyInput {
  context: ManualSyntheticDispatchAdminContext;
  /** Já redigido por quem chama — a política só confere se está vazio, não redige. */
  reason: string;
  requestId: string;
  batchId: string;
  maxRuns: number;
  maxConcurrency: number;
  deadlineAt: string;
  requestedAt: string;
  health: SyntheticEngineHealthStatus;
  readiness: SyntheticEngineReadinessStatus;
  /** Quantidade de pedidos já registrados (`registry.count()`), calculada por quem chama. */
  recentRequestCount: number;
}

function decide(decision: ManualSyntheticDispatchPolicyDecision, reasonCode: string): ManualSyntheticDispatchPolicyResult {
  return { decision, reasonCode };
}

function isValidLimit(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && Number.isFinite(value) && value >= min && value <= max;
}

function isConfigurationValid(input: ManualSyntheticDispatchPolicyInput): boolean {
  if (input.requestId.trim() === "") return false;
  if (input.batchId.trim() === "") return false;
  if (input.context.requestedBy.trim() === "") return false;
  if (!isValidLimit(input.maxRuns, MANUAL_DISPATCH_LIMITS.MAX_RUNS_MIN, MANUAL_DISPATCH_LIMITS.MAX_RUNS_MAX)) return false;
  if (!isValidLimit(input.maxConcurrency, MANUAL_DISPATCH_LIMITS.MAX_CONCURRENCY_MIN, MANUAL_DISPATCH_LIMITS.MAX_CONCURRENCY_MAX)) return false;
  if (input.maxConcurrency > input.maxRuns) return false;
  const deadline = Date.parse(input.deadlineAt);
  const requestedAt = Date.parse(input.requestedAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(requestedAt)) return false;
  if (deadline <= requestedAt) return false;
  return true;
}

/**
 * Avalia UMA solicitação e devolve UMA decisão fechada. Pura: mesma
 * entrada, mesma saída, sem relógio próprio, sem I/O.
 */
export function evaluateManualSyntheticDispatchPolicy(
  input: ManualSyntheticDispatchPolicyInput,
  config: ManualSyntheticDispatchPolicyConfig = DEFAULT_MANUAL_DISPATCH_POLICY_CONFIG,
): ManualSyntheticDispatchPolicyResult {
  const { context } = input;

  if (!config.allowedRoles.includes(context.role)) {
    return decide("DENIED_ROLE", "papel do solicitante não está entre os permitidos para este acionador");
  }
  if (context.environment !== "SYNTHETIC_LAB") {
    return decide("DENIED_ENVIRONMENT", "acionador só aceita ambiente SYNTHETIC_LAB");
  }
  if (context.explicitConfirmation !== true) {
    return decide("DENIED_CONFIRMATION", "confirmação explícita ausente");
  }
  if (input.reason.trim() === "") {
    return decide("DENIED_REASON", "motivo da execução vazio");
  }
  if (!isConfigurationValid(input)) {
    return decide("DENIED_CONFIGURATION", "requestId/batchId/limites/deadline fora da configuração administrativa aceita");
  }
  if (input.recentRequestCount >= config.maxRecentRequests) {
    return decide("DENIED_RATE_LIMIT", "quantidade de pedidos administrativos já registrados atingiu o limite");
  }
  if (input.health === "UNHEALTHY") {
    return decide("DENIED_HEALTH", "motor sintético UNHEALTHY");
  }
  if (input.health === "DEGRADED" && !config.allowDegradedHealth) {
    return decide("DENIED_HEALTH", "motor sintético DEGRADED e esta implantação não permite override");
  }
  if (input.readiness !== "READY") {
    return decide("DENIED_READINESS", `motor sintético não está READY (readiness=${input.readiness})`);
  }

  return decide("ALLOWED", "solicitação autorizada");
}
