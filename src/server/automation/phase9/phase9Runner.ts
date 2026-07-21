/**
 * Fase 9 — Runner SEGURO/STUBADO (docs/33 §6/§7, docs/34, docs/35).
 *
 * O QUE ESTE RUNNER **NAO** FAZ (limite absoluto):
 * - NAO abre navegador real. NAO usa Playwright contra site real.
 * - NAO acessa Gov.br. NAO acessa SINARM/PF. NAO faz rede externa.
 * - NAO gera GRU/protocolo. NAO paga taxa. NAO usa cliente/dados reais.
 * - NAO habilita execucao real por padrao.
 *
 * O QUE ELE FAZ HOJE:
 * - recebe um `Phase9ExecutionRequest`;
 * - roda os safety checks (`safety.ts`);
 * - registra eventos de auditoria em memoria (`auditLogger.ts`);
 * - retorna um resultado BLOQUEADO/SEGURO, com `sessionDiscarded: true`;
 * - deixa claro que a execucao real depende do `docs/34 §16` (pendente).
 */
import { createPhase9AuditLogger } from "./auditLogger";
import { createPhase9NetworkPolicy, isExternalAccessAllowed } from "./networkGuard";
import {
  evaluateSafety,
  isPhase9RealExecutionEnabled,
  PHASE9_NOT_AUTHORIZED_MESSAGE,
} from "./safety";
import type {
  Phase9ExecutionRequest,
  Phase9ExecutionResult,
  Phase9StepName,
  Phase9StepResult,
} from "./types";

/** Etapas planejadas do fluxo (docs/34 §10). Todas BLOQUEADAS enquanto §16 pendente. */
const PLANNED_STEPS: readonly Phase9StepName[] = [
  "HEALTH_CHECK",
  "SESSION_START",
  "HUMAN_LOGIN",
  "NAVIGATE_SERVICE",
  "FILL_DESTINATION",
  "SELECT_PURPOSE",
  "SELECT_WEAPON",
  "ATTACH_DOCUMENT",
  "FILL_JUSTIFICATION",
  "REACH_GRU_SCREEN",
  "STOP_AT_GRU",
  "SESSION_DISCARD",
];

function blockedSteps(detail: string): Phase9StepResult[] {
  return PLANNED_STEPS.map((name) => ({ name, status: "BLOCKED", detail }));
}

/**
 * Executa (de forma bloqueada/segura) a Fase 9. Sincrono de proposito: nao ha I/O
 * real. Nunca lanca — sempre devolve um `Phase9ExecutionResult`.
 */
export function runPhase9(request: Phase9ExecutionRequest): Phase9ExecutionResult {
  const audit = createPhase9AuditLogger();
  const createdAt = new Date().toISOString();

  audit.record({
    type: "EXECUTION_CREATED",
    executionId: request.executionId,
    message: "Pedido de execucao da Fase 9 recebido (modo bloqueado).",
    meta: { processId: request.processId, dryRun: request.dryRun },
  });

  // Politica de rede: sempre localhost-only, sem acesso externo (docs/35 §10).
  const networkPolicy = createPhase9NetworkPolicy();
  if (isExternalAccessAllowed(networkPolicy)) {
    // Nunca deve acontecer com o default; guarda defensiva.
    audit.record({
      type: "NETWORK_BLOCKED",
      executionId: request.executionId,
      message: "Acesso externo estava habilitado — abortando por seguranca.",
    });
    return abort(request, createdAt, audit.events(), [
      "Politica de rede insegura (acesso externo habilitado).",
    ]);
  }

  // 1) Safety checks.
  const decision = evaluateSafety(request);
  if (!decision.allowed) {
    audit.record({
      type: "SAFETY_CHECK_BLOCKED",
      executionId: request.executionId,
      message: decision.reason,
      meta: { code: decision.code },
    });
    audit.record({ type: "SESSION_DISCARDED", executionId: request.executionId });
    audit.record({
      type: "EXECUTION_ABORTED",
      executionId: request.executionId,
      message: decision.reason,
    });
    return {
      executionId: request.executionId,
      processId: request.processId,
      ok: false,
      blocked: true,
      status: "BLOCKED",
      message: decision.reason,
      stopPoint: "DADOS_DA_GRU",
      createdAt,
      finishedAt: new Date().toISOString(),
      steps: blockedSteps("Bloqueado antes de qualquer etapa (safety)."),
      errors: [decision.reason],
      artifacts: [],
      sessionDiscarded: true,
      auditEvents: audit.events(),
    };
  }

  audit.record({
    type: "SAFETY_CHECK_PASSED",
    executionId: request.executionId,
    message: "Safety checks aprovados — mas execucao real segue bloqueada.",
  });

  // 2) Feature flag / bloqueio explicito: execucao real NAO habilitada por padrao.
  //    Mesmo com safety aprovado, paramos aqui ate o docs/34 §16 ser assinado.
  if (!isPhase9RealExecutionEnabled()) {
    audit.record({
      type: "HUMAN_CONFIRMATION_REQUIRED",
      executionId: request.executionId,
      message: PHASE9_NOT_AUTHORIZED_MESSAGE,
    });
    audit.record({ type: "SESSION_DISCARDED", executionId: request.executionId });
    audit.record({
      type: "EXECUTION_ABORTED",
      executionId: request.executionId,
      message: PHASE9_NOT_AUTHORIZED_MESSAGE,
    });
    return {
      executionId: request.executionId,
      processId: request.processId,
      ok: false,
      blocked: true,
      status: "BLOCKED",
      message: PHASE9_NOT_AUTHORIZED_MESSAGE,
      stopPoint: "DADOS_DA_GRU",
      createdAt,
      finishedAt: new Date().toISOString(),
      steps: blockedSteps("Execucao real nao habilitada (docs/34 §16 pendente)."),
      errors: [],
      artifacts: [],
      sessionDiscarded: true,
      auditEvents: audit.events(),
    };
  }

  // Inalcancavel hoje: se algum dia a flag for ligada, aqui entraria a automacao
  // real (sob revisao). Mantido explicitamente inacessivel por seguranca.
  return abort(request, createdAt, audit.events(), [
    "Estado inesperado: execucao real habilitada sem implementacao autorizada.",
  ]);
}

function abort(
  request: Phase9ExecutionRequest,
  createdAt: string,
  auditEvents: Phase9ExecutionResult["auditEvents"],
  errors: string[],
): Phase9ExecutionResult {
  return {
    executionId: request.executionId,
    processId: request.processId,
    ok: false,
    blocked: true,
    status: "ABORTED",
    message: PHASE9_NOT_AUTHORIZED_MESSAGE,
    stopPoint: "DADOS_DA_GRU",
    createdAt,
    finishedAt: new Date().toISOString(),
    steps: blockedSteps("Abortado por seguranca."),
    errors,
    artifacts: [],
    sessionDiscarded: true,
    auditEvents,
  };
}
