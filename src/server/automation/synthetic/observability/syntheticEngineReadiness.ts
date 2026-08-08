/**
 * Prontidão OPERACIONAL do motor sintético — responde "ele pode receber
 * lote novo agora?", separado de `syntheticEngineHealth.ts` ("ele está
 * funcionando corretamente?"). Módulo puro: nenhum portal externo é
 * consultado; toda entrada já vem calculada por quem chama.
 *
 * DELIBERADAMENTE NÃO entra na conta (ver `docs/00`):
 * - `PHASE9_REAL_EXECUTION_ENABLED === false` — o laboratório sintético
 *   continua pronto mesmo com a execução real desabilitada;
 * - Fase 9 bloqueada — comportamento esperado, não sinal de indisponibilidade;
 * - falta de sessão para UM run isolado — isso é outcome de item
 *   (`SESSION_REQUIRED`), não readiness global;
 * - `WAITING_HUMAN` em um run — não bloqueia os demais.
 */
export const SYNTHETIC_ENGINE_READINESS_STATUSES = ["READY", "NOT_READY", "BLOCKED"] as const;
export type SyntheticEngineReadinessStatus = (typeof SYNTHETIC_ENGINE_READINESS_STATUSES)[number];

export interface SyntheticEngineReadinessInput {
  storeAvailable: boolean;
  executorAvailable: boolean;
  configValid: boolean;
  /** Dependência obrigatória (ex.: adaptador de store escolhido) presente e resolvida. */
  requiredDependenciesPresent: boolean;
  /** Bloqueio operacional EXPLÍCITO: manutenção, trava manual, condição de segurança configurada. */
  operationalBlock: boolean;
}

/**
 * Classifica a prontidão. `BLOCKED` vence sempre — é uma decisão
 * deliberada, não uma falha técnica. Depois disso, qualquer dependência
 * obrigatória ausente vira `NOT_READY`; o resto é `READY`.
 */
export function buildSyntheticEngineReadiness(input: SyntheticEngineReadinessInput): SyntheticEngineReadinessStatus {
  if (input.operationalBlock) return "BLOCKED";
  if (!input.storeAvailable || !input.executorAvailable || !input.configValid || !input.requiredDependenciesPresent) {
    return "NOT_READY";
  }
  return "READY";
}
