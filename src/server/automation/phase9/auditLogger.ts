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
import {
  LAB_REDACTED,
  isSecretKey,
  redactLabText,
  redactLabValue,
  type LabSafeValue,
} from "../lab/labRedaction";
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

/**
 * Redige o `meta` de um evento de auditoria reusando o `labRedaction`.
 *
 * A POLITICA por tipo e desta camada, nao do `labRedaction`:
 * - **chave de segredo** -> `[REDACTED]`; o valor nunca e visitado;
 * - **numero/boolean** -> preservados COMO SAO. Sao METRICA de auditoria
 *   (`durationMs`, `bytes`, `attempt`, `tentativas`) e mascara-los destruiria a
 *   evidencia. A heuristica de "sequencia longa de digitos" do `labRedaction`
 *   existe para TEXTO LIVRE, onde um numero comprido costuma ser RG/serie —
 *   aqui, nao. Numero tambem nao vira string: o tipo e preservado;
 * - **string** -> sempre passa pela mascara (CPF, RG, e-mail, telefone, digitos
 *   longos). Um segredo escrito em texto livre continua com o backstop proprio;
 * - **objeto/array** (chamador sem tipos) -> redigidos por inteiro e serializados.
 */
export function sanitizeMeta(meta: Phase9AuditMeta): Phase9AuditMeta {
  const clean: Phase9AuditMeta = {};
  let redactedKeys = 0;

  for (const [key, value] of Object.entries(meta)) {
    // A chave tambem passa pela mascara: chave tecnica sai intacta, chave que
    // por acidente carregue PII e mascarada.
    const safeKey = redactLabText(key).text;

    if (isSecretKey(key)) {
      clean[safeKey] = LAB_REDACTED;
      redactedKeys += 1;
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      clean[safeKey] = value;
      continue;
    }

    if (typeof value === "string") {
      clean[safeKey] = redactLabText(value).text;
      continue;
    }

    // A contagem tambem soma o que foi redigido DENTRO da estrutura — um
    // `_redactedKeys` zerado com segredo aninhado seria subdeclaracao.
    const { value: safeValue, summary } = redactLabValue(value);
    redactedKeys += summary.redactedKeys;
    clean[safeKey] = toAuditValue(safeValue);
  }

  if (redactedKeys > 0) clean._redactedKeys = redactedKeys;
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
