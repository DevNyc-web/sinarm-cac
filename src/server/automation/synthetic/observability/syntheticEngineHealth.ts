/**
 * Saúde TÉCNICA do motor sintético — responde "o motor está funcionando
 * corretamente?", separado de `syntheticEngineReadiness.ts` ("ele pode
 * receber trabalho agora?"). Módulo puro: sem I/O, sem consulta a rede ou
 * portal — toda entrada já vem calculada por quem chama.
 *
 * Ausência de runs NÃO é falha: métricas zeradas produzem `HEALTHY`.
 */
import type { SyntheticEngineMetrics } from "./syntheticEngineMetrics";

export const SYNTHETIC_ENGINE_HEALTH_STATUSES = ["HEALTHY", "DEGRADED", "UNHEALTHY"] as const;
export type SyntheticEngineHealthStatus = (typeof SYNTHETIC_ENGINE_HEALTH_STATUSES)[number];

export interface SyntheticEngineHealthThresholds {
  /** Acima disto, claim expirado acumulado vira `DEGRADED`. */
  maxAcceptableClaimsExpired: number;
  /** Acima disto, run recuperável acumulado vira `DEGRADED`. */
  maxAcceptableRunsRecoverable: number;
  /** Acima disto, conflito (claim + versão) somado vira `DEGRADED`. */
  maxAcceptableConflicts: number;
}

export const DEFAULT_SYNTHETIC_ENGINE_HEALTH_THRESHOLDS: SyntheticEngineHealthThresholds = {
  maxAcceptableClaimsExpired: 3,
  maxAcceptableRunsRecoverable: 5,
  maxAcceptableConflicts: 3,
};

export interface SyntheticEngineHealthInput {
  /** `false` só quando o store está genuinamente inacessível (erro de infraestrutura), não "sem runs". */
  storeAccessible: boolean;
  configValid: boolean;
  /** Erro interno inesperado (não um outcome de item — isso é isolado por design do dispatcher). */
  internalErrorOccurred: boolean;
  /** Registro corrompido/inválido encontrado (ex.: `validateStoredSyntheticRun` reprovou algo que já estava salvo). */
  corruptedRecordDetected: boolean;
  /** Último lote teve falha ISOLADA (item individual), mas o motor seguiu funcional — não derruba para `UNHEALTHY`. */
  lastBatchHadIsolatedFailures: boolean;
  metrics: SyntheticEngineMetrics;
  thresholds?: Partial<SyntheticEngineHealthThresholds>;
}

/**
 * Classifica a saúde do motor. `UNHEALTHY` vence sempre (infraestrutura
 * quebrada não é "degradada"); depois disso, acúmulo além do limite
 * configurado vira `DEGRADED`; o resto é `HEALTHY`.
 */
export function buildSyntheticEngineHealth(input: SyntheticEngineHealthInput): SyntheticEngineHealthStatus {
  if (!input.storeAccessible || !input.configValid || input.internalErrorOccurred || input.corruptedRecordDetected) {
    return "UNHEALTHY";
  }

  const thresholds: SyntheticEngineHealthThresholds = { ...DEFAULT_SYNTHETIC_ENGINE_HEALTH_THRESHOLDS, ...input.thresholds };
  const conflicts = input.metrics.claimConflicts + input.metrics.versionConflicts;

  const degraded =
    input.lastBatchHadIsolatedFailures ||
    input.metrics.claimsExpired > thresholds.maxAcceptableClaimsExpired ||
    input.metrics.runsRecoverable > thresholds.maxAcceptableRunsRecoverable ||
    conflicts > thresholds.maxAcceptableConflicts;

  return degraded ? "DEGRADED" : "HEALTHY";
}
