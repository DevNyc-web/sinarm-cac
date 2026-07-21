/**
 * Fase 9 — Logger de auditoria em memoria (docs/34 §11, docs/35 §7).
 *
 * Ainda NAO grava em banco: acumula eventos em memoria e devolve no resultado.
 * Regra permanente: NUNCA registrar senha/OTP/cookie/token/payload bruto sensivel
 * (docs/00 §8, src/lib/logger.ts).
 *
 * A mascara NAO e reimplementada aqui: este modulo REUSA o `labRedaction` da
 * Fase 8D (docs/37), que e mais forte que a versao propria que existia antes —
 * cobre e-mail, telefone e RG formatado alem de CPF/digitos longos, percorre
 * objetos aninhados e arrays, trata ciclo/profundidade, e nao confunde
 * `passo`/`author` com segredo.
 *
 * Politica de chave (decisao da Fase 8D): a CHAVE sensivel PERMANECE no evento
 * com valor `[REDACTED]` — isso e evidencia de auditoria. O VALOR original nunca
 * aparece. `_redactedKeys` continua informando quantas foram redigidas.
 */
import { redactLabMeta, redactLabText, type LabSafeValue } from "../lab/labRedaction";
import type {
  Phase9AuditEvent,
  Phase9AuditEventType,
  Phase9AuditMeta,
  Phase9StepName,
} from "./types";

/**
 * `Phase9AuditMeta` e plano por tipo; a redacao pode devolver estrutura aninhada
 * se um chamador sem tipos passar objeto/array. Nesse caso serializamos o valor
 * JA REDIGIDO, para nao perder a evidencia nem alargar o tipo do evento.
 */
function toAuditValue(value: LabSafeValue): string | number | boolean {
  if (value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

/** Redige chaves de segredo e mascara valores sensiveis (via `labRedaction`). */
export function sanitizeMeta(meta: Phase9AuditMeta): Phase9AuditMeta {
  const { value, summary } = redactLabMeta(meta);

  const clean: Phase9AuditMeta = {};
  for (const [key, item] of Object.entries(value)) {
    clean[key] = toAuditValue(item);
  }
  if (summary.redactedKeys > 0) clean._redactedKeys = summary.redactedKeys;
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
      if (input.message !== undefined) event.message = redactLabText(input.message).text;
      if (input.meta !== undefined) event.meta = sanitizeMeta(input.meta);
      events.push(event);
      return { ...event };
    },
    events(): Phase9AuditEvent[] {
      return events.map((e) => ({ ...e }));
    },
  };
}
