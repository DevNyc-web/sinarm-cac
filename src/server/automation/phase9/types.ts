/**
 * Fase 9 — Contratos/tipos de execucao (docs/33, docs/34, docs/35).
 *
 * ESTES SAO SO OS TIPOS. Nao acessam rede, nao abrem navegador, nao tocam
 * Gov.br/SINARM. A execucao real da Fase 9 continua BLOQUEADA por padrao
 * (docs/34 §16 pendente) — ver `phase9Runner.ts` e `safety.ts`.
 */

/** Ponto de parada obrigatorio da Fase 9 (docs/34 §2). Nao existe outro valor. */
export type Phase9StopPoint = "DADOS_DA_GRU";

/** Nome de cada etapa do fluxo planejado (docs/33 §7, docs/34 §10). */
export type Phase9StepName =
  | "HEALTH_CHECK"
  | "SESSION_START"
  | "HUMAN_LOGIN"
  | "NAVIGATE_SERVICE"
  | "FILL_DESTINATION"
  | "SELECT_PURPOSE"
  | "SELECT_WEAPON"
  | "ATTACH_DOCUMENT"
  | "FILL_JUSTIFICATION"
  | "REACH_GRU_SCREEN"
  | "STOP_AT_GRU"
  | "SESSION_DISCARD";

/** Estado de uma etapa. `BLOCKED` = nao executada por bloqueio de seguranca. */
export type Phase9StepStatus =
  | "PENDING"
  | "STARTED"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED"
  | "SKIPPED";

export interface Phase9StepResult {
  name: Phase9StepName;
  status: Phase9StepStatus;
  detail?: string;
}

/**
 * Pedido de execucao da Fase 9.
 *
 * Invariantes obrigatorias por enquanto (validadas em `safety.ts`):
 * - stopPoint === "DADOS_DA_GRU"
 * - dryRun === true
 * - allowRealExternalAccess === false
 */
export interface Phase9ExecutionRequest {
  executionId: string;
  processId: string;
  requestedByUserId: string;
  /** Rotulo da conta propria/autorizada (docs/34 §3). NUNCA credencial. */
  authorizedAccountLabel: string;
  stopPoint: Phase9StopPoint;
  /** Obrigatoriamente `true` nesta fase — nada de execucao real. */
  dryRun: boolean;
  /** Obrigatoriamente `false` nesta fase — sem acesso externo real. */
  allowRealExternalAccess: boolean;
  createdAt: string;
}

export type Phase9ExecutionStatus = "BLOCKED" | "COMPLETED" | "ABORTED";

export interface Phase9ExecutionResult {
  executionId: string;
  processId: string;
  /** `true` so se o fluxo concluiu do jeito autorizado — hoje sempre `false`. */
  ok: boolean;
  /** `true` quando a execucao real foi impedida (safety ou feature flag). */
  blocked: boolean;
  status: Phase9ExecutionStatus;
  /** Mensagem segura para humano/auditoria (sem segredo). */
  message: string;
  stopPoint: Phase9StopPoint;
  createdAt: string;
  finishedAt: string;
  steps: Phase9StepResult[];
  errors: string[];
  /** Caminhos de artifacts gerados (hoje: nenhum). */
  artifacts: string[];
  /** Descarte da sessao efemera (docs/33 §12). Hoje sempre `true`. */
  sessionDiscarded: boolean;
  /** Trilha de auditoria em memoria (sem segredo — ver `auditLogger.ts`). */
  auditEvents: Phase9AuditEvent[];
}

/** Tipos de evento de auditoria (docs/34 §11, docs/35 §7). */
export type Phase9AuditEventType =
  | "EXECUTION_CREATED"
  | "SAFETY_CHECK_PASSED"
  | "SAFETY_CHECK_BLOCKED"
  | "NETWORK_BLOCKED"
  | "STEP_STARTED"
  | "STEP_COMPLETED"
  | "STEP_FAILED"
  | "HUMAN_CONFIRMATION_REQUIRED"
  | "SESSION_DISCARDED"
  | "EXECUTION_ABORTED";

/** Metadados de um evento — apenas valores simples e ja mascarados. */
export type Phase9AuditMeta = Record<string, string | number | boolean>;

export interface Phase9AuditEvent {
  type: Phase9AuditEventType;
  /** ISO timestamp. */
  at: string;
  executionId?: string;
  step?: Phase9StepName;
  message?: string;
  meta?: Phase9AuditMeta;
}

/** Codigo estavel do resultado de uma checagem de seguranca (docs/34 §2). */
export type Phase9SafetyCode =
  | "OK"
  | "STOP_POINT_INVALID"
  | "DRY_RUN_REQUIRED"
  | "REAL_ACCESS_BLOCKED"
  | "REAL_MODE_BLOCKED"
  | "URL_NOT_ALLOWED"
  | "REAL_GRU_BLOCKED"
  | "REAL_DATA_BLOCKED"
  | "EXECUTION_NOT_AUTHORIZED";

export interface Phase9SafetyDecision {
  allowed: boolean;
  code: Phase9SafetyCode;
  /** Motivo legivel, seguro para log/auditoria (sem segredo). */
  reason: string;
}

/** Politica de rede da Fase 9 (docs/35 §10). Default: so localhost, sem externo. */
export interface Phase9NetworkPolicy {
  externalAccessAllowed: boolean;
  allowedHosts: string[];
}

export interface Phase9UrlCheck {
  allowed: boolean;
  /** Host extraido da URL (ou `null` se nao parseavel). */
  host: string | null;
  reason: string;
}
