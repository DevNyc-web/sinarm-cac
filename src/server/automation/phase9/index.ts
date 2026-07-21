/**
 * Fase 9 — Modulo de automacao (infra segura, execucao real BLOQUEADA).
 *
 * Ponto unico de importacao. Nada aqui acessa Gov.br/SINARM, abre navegador real
 * ou faz rede externa. A execucao real depende do `docs/34 §16` (pendente).
 */
export * from "./types";
export {
  PHASE9_DEFAULT_ALLOWED_HOSTS,
  createPhase9NetworkPolicy,
  isExternalAccessAllowed,
  assertUrlAllowed,
} from "./networkGuard";
export {
  REQUIRED_STOP_POINT,
  PHASE9_REAL_EXECUTION_ENABLED,
  PHASE9_NOT_AUTHORIZED_MESSAGE,
  isPhase9RealExecutionEnabled,
  evaluateSafety,
  assertNotRealMode,
  assertNoRealGru,
  assertUrlSafe,
} from "./safety";
export {
  createPhase9AuditLogger,
  sanitizeMeta,
  type Phase9AuditLogger,
  type Phase9AuditInput,
} from "./auditLogger";
export { runPhase9 } from "./phase9Runner";
