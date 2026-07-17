import pino from "pino";

/**
 * Logger de aplicacao (pino, JSON estruturado) — docs/13 §12.
 * Regra permanente: NUNCA registrar PII em claro (docs/12 §18).
 * Nivel lido de LOG_LEVEL com fallback "info" (sem depender de getEnv no import).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});
