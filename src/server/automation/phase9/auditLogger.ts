/**
 * Fase 9 — Logger de auditoria em memoria (docs/34 §11, docs/35 §7).
 *
 * Ainda NAO grava em banco: acumula eventos em memoria e devolve no resultado.
 * Regra permanente: NUNCA registrar senha/OTP/cookie/token/payload bruto sensivel
 * (docs/00 §8, src/lib/logger.ts). Este logger APLICA a mascara de fato:
 * - chaves proibidas em `meta` sao descartadas (nao entram no evento);
 * - valores string sao mascarados (CPF/RG/sequencias longas de digitos).
 */
import type {
  Phase9AuditEvent,
  Phase9AuditEventType,
  Phase9AuditMeta,
  Phase9StepName,
} from "./types";

/** Chaves cujo conteudo e sempre segredo — descartadas do meta. */
const FORBIDDEN_META_KEY =
  /pass(word)?|senha|otp|token|cookie|secret|authorization|auth|session|credential|bearer/i;

/** CPF em claro (com ou sem pontuacao). */
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
/** Sequencias longas de digitos (RG, numeros de serie, referencia de GRU etc.). */
const LONG_DIGITS_PATTERN = /\b\d{6,}\b/g;

function maskValue(value: string): string {
  return value
    .replace(CPF_PATTERN, "***.***.***-**")
    .replace(LONG_DIGITS_PATTERN, "******");
}

/** Remove chaves proibidas e mascara valores string. */
export function sanitizeMeta(meta: Phase9AuditMeta): Phase9AuditMeta {
  const clean: Phase9AuditMeta = {};
  let redacted = 0;
  for (const [key, value] of Object.entries(meta)) {
    if (FORBIDDEN_META_KEY.test(key)) {
      redacted += 1;
      continue;
    }
    clean[key] = typeof value === "string" ? maskValue(value) : value;
  }
  if (redacted > 0) clean._redactedKeys = redacted;
  return clean;
}

export interface Phase9AuditInput {
  type: Phase9AuditEventType;
  executionId?: string;
  step?: Phase9StepName;
  message?: string;
  meta?: Phase9AuditMeta;
}

export interface Phase9AuditLogger {
  /** Registra um evento (ja sanitizado) e devolve a copia registrada. */
  record(input: Phase9AuditInput): Phase9AuditEvent;
  /** Copia imutavel dos eventos registrados. */
  events(): Phase9AuditEvent[];
}

/** Cria um logger de auditoria em memoria (sem persistencia). */
export function createPhase9AuditLogger(): Phase9AuditLogger {
  const events: Phase9AuditEvent[] = [];

  return {
    record(input: Phase9AuditInput): Phase9AuditEvent {
      const event: Phase9AuditEvent = {
        type: input.type,
        at: new Date().toISOString(),
      };
      if (input.executionId !== undefined) event.executionId = input.executionId;
      if (input.step !== undefined) event.step = input.step;
      if (input.message !== undefined) event.message = maskValue(input.message);
      if (input.meta !== undefined) event.meta = sanitizeMeta(input.meta);
      events.push(event);
      return { ...event };
    },
    events(): Phase9AuditEvent[] {
      return events.map((e) => ({ ...e }));
    },
  };
}
