/**
 * Classificação PURA de recuperação — responde "este run pode receber um
 * claim novo agora?" sem executar nada. Recuperação NUNCA roda etapa
 * sozinha: só torna o run elegível para um novo `claimNext`.
 *
 * Módulo puro: sem I/O, sem relógio próprio (`at` é sempre injetado), sem
 * import de Playwright, Prisma, Redis ou filesystem.
 */
import { isSyntheticRunTerminalState } from "../syntheticRunCoordinator";
import type { StoredSyntheticRun } from "./syntheticRunStore";

export const SYNTHETIC_RUN_RECOVERY_STATUSES = [
  "RECOVERABLE",
  "NOT_RECOVERABLE",
  "WAITING_HUMAN",
  "TERMINAL",
  "CLAIM_STILL_VALID",
] as const;

export type SyntheticRunRecoveryStatus = (typeof SYNTHETIC_RUN_RECOVERY_STATUSES)[number];

/**
 * Classifica um registro armazenado. A ordem importa: terminal e
 * `WAITING_HUMAN` vencem SEMPRE, mesmo que o claim já tenha expirado — run
 * terminal não reabre (docs/74 §9.4) e captcha nunca é ignorado.
 */
export function classifySyntheticRunRecovery(record: StoredSyntheticRun, at: string): SyntheticRunRecoveryStatus {
  if (isSyntheticRunTerminalState(record.runState)) return "TERMINAL";
  if (record.runState === "WAITING_HUMAN") return "WAITING_HUMAN";

  if (record.claim !== null && Date.parse(record.claim.expiresAt) > Date.parse(at)) {
    return "CLAIM_STILL_VALID";
  }

  // QUEUED/RUNNING sem claim válido: claim ausente, expirado, ou execução
  // interrompida antes de salvar a próxima etapa — todos o mesmo sinal.
  return "RECOVERABLE";
}

export function isSyntheticRunRecoverable(record: StoredSyntheticRun, at: string): boolean {
  return classifySyntheticRunRecovery(record, at) === "RECOVERABLE";
}
