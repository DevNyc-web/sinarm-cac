/**
 * Fase 2 — coordenador PURO de execução sintética: liga sessão → fila de etapas
 * → execução → eventos → evidências → resultado.
 *
 * NÃO é uma segunda máquina de estados: toda transição de SESSÃO continua
 * passando por `sessionLifecycle.ts` (`applySyntheticTransition`,
 * `recordSyntheticStep`). Este módulo só sabe orquestrar uma FILA de etapas
 * fictícias por cima da sessão e guardar o estado do RUN — que é um conceito
 * separado (docs/74 continua sendo a única fonte de verdade da sessão).
 *
 * Modulo PURO: sem I/O, sem rede, sem Prisma, sem Fase 9, sem persistência. Sem
 * `Date.now()`, `Math.random()`, timer ou promise — o relógio ENTRA como
 * parâmetro (`at`), como em todo o resto da Fase 2.
 *
 * Garantias inegociáveis:
 * - a fila é imutável e local: cada função recebe o run atual e devolve um
 *   OBJETO NOVO — a entrada nunca é mutada;
 * - etapa só sai da cabeça da fila: não existe "executar etapa X" por id, então
 *   pular ou repetir etapa é impossível pela própria forma da API;
 * - captcha SÓ bloqueia — não há resolução automática nem "pular captcha";
 * - falha nunca produz protocolo; só `COMPLETED` admite `PROT-FICT-*`;
 * - evidência nunca carrega `sessionHandle`, HTML, screenshot, credencial ou
 *   objeto arbitrário — só os campos fechados abaixo, com texto redigido.
 */
import { redactLabText } from "../redaction";
import {
  isSyntheticTerminalState,
  isIsoTimestamp,
  scanSyntheticValue,
  validateSyntheticSessionContract,
  type SyntheticHandoffState,
  type SyntheticSessionContract,
  type SyntheticViolationCode,
} from "./sessionContract";
import {
  SYNTHETIC_FAILURE_KINDS,
  applySyntheticTransition,
  recordSyntheticStep,
  type SyntheticFailureKind,
  type SyntheticLabEvent,
  type SyntheticLifecycleViolationCode,
} from "./sessionLifecycle";

// -------------------------------------------------------------------- plano

/** Os 4 tipos de etapa fictícia aceitos. Lista FECHADA — tipo fora daqui é rejeitado. */
export const SYNTHETIC_RUN_STEP_TYPES = [
  "VALIDATE_INPUT",
  "OPEN_FORM",
  "FILL_FORM",
  "CONFIRM_RESULT",
] as const;

export type SyntheticRunStepType = (typeof SYNTHETIC_RUN_STEP_TYPES)[number];

/**
 * Etapa fictícia do plano. `syntheticFailure` é OPCIONAL e só serve para testes
 * determinísticos: quando presente, `executeNextSyntheticStep` aplica aquela
 * falha ao processar a etapa em vez de completá-la com sucesso.
 *
 * Sem campo de URL, seletor real, CPF, senha, token, cookie, storage state,
 * credencial ou payload arbitrário — a forma é fechada de propósito.
 */
export interface SyntheticRunStep {
  stepId: string;
  type: SyntheticRunStepType;
  description: string;
  expectedResult: string;
  syntheticFailure?: SyntheticFailureKind;
}

/** Plano ordenado e versionado. `allowedSyntheticData` é a lista fechada de rótulos fictícios que a etapa pode citar — nunca dado real. */
export interface SyntheticRunPlan {
  planId: string;
  version: string;
  steps: readonly SyntheticRunStep[];
  allowedSyntheticData: readonly string[];
}

// ------------------------------------------------------------------ estados

/**
 * Estados do RUN — não confundir com `SyntheticHandoffState` da sessão. A
 * sessão continua regida só pelo lifecycle; o run é uma camada por cima que
 * acompanha a fila de etapas fictícias.
 */
export const SYNTHETIC_RUN_STATES = [
  "QUEUED",
  "RUNNING",
  "WAITING_HUMAN",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type SyntheticRunState = (typeof SYNTHETIC_RUN_STATES)[number];

const RUN_TERMINAL_SET: ReadonlySet<string> = new Set<SyntheticRunState>([
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

export function isSyntheticRunTerminalState(state: string): boolean {
  return RUN_TERMINAL_SET.has(state);
}

// ---------------------------------------------------------------- evidência

/** Tipos fechados de evidência sintética — um por marco relevante do run. */
export const SYNTHETIC_RUN_EVIDENCE_TYPES = [
  "STEP_COMPLETED",
  "STEP_FAILED",
  "RUN_BLOCKED",
  "RUN_EXPIRED",
  "RUN_CANCELLED",
  "RUN_COMPLETED",
] as const;

export type SyntheticRunEvidenceType = (typeof SYNTHETIC_RUN_EVIDENCE_TYPES)[number];

/**
 * Evidência de UMA etapa/marco do run. Só os campos abaixo — nada de
 * `sessionHandle`, HTML, screenshot, credencial, PII ou objeto arbitrário.
 * `description` e `outcome` sempre passam por `redactLabText`.
 */
export interface SyntheticRunEvidence {
  evidenceId: string;
  runId: string;
  stepId: string;
  timestamp: string;
  type: SyntheticRunEvidenceType;
  description: string;
  previousState: SyntheticRunState;
  nextState: SyntheticRunState;
  outcome: string;
}

// --------------------------------------------------------------------- run

export interface SyntheticCompletedRunStep {
  step: SyntheticRunStep;
  evidenceId: string;
  completedAt: string;
}

export interface SyntheticRunResult {
  outcome: "SUCCESS" | "FAILURE" | "EXPIRED" | "CANCELLED";
  /** Só preenchido quando `outcome === "SUCCESS"`; falha nunca produz protocolo. */
  syntheticProtocol: string | null;
  completedAt: string;
}

export interface SyntheticAutomationRun {
  runId: string;
  /** Sessão associada, no estado ATUAL — atualizada só via `sessionLifecycle.ts`. */
  session: SyntheticSessionContract;
  plan: SyntheticRunPlan;
  /** Fila pendente, imutável e ordenada. Etapa concluída sai da cabeça, nunca do meio. */
  pendingSteps: readonly SyntheticRunStep[];
  /** `pendingSteps[0]`, ou `null` quando a fila está vazia. */
  currentStep: SyntheticRunStep | null;
  completedSteps: readonly SyntheticCompletedRunStep[];
  state: SyntheticRunState;
  events: readonly SyntheticLabEvent[];
  evidence: readonly SyntheticRunEvidence[];
  humanFallbackRequired: boolean;
  result: SyntheticRunResult | null;
}

// --------------------------------------------------------------- violações

export const SYNTHETIC_RUN_VIOLATION_CODES = [
  "NOT_AN_OBJECT",
  "UNKNOWN_FIELD",
  "MISSING_FIELD",
  "INVALID_TYPE",
  "EMPTY_VALUE",
  "EMPTY_PLAN",
  "DUPLICATE_STEP_ID",
  "UNKNOWN_STEP_TYPE",
  "UNKNOWN_FAILURE_KIND",
  "RUN_TERMINAL_NO_CONTINUE",
  "QUEUE_EMPTY",
  "HUMAN_FALLBACK_PENDING",
  "CAPTCHA_NO_RESUME",
  "NOT_WAITING_HUMAN",
  "SESSION_NOT_READY",
  "INVALID_TIMESTAMP",
] as const;

export type SyntheticRunOwnViolationCode = (typeof SYNTHETIC_RUN_VIOLATION_CODES)[number];

export interface SyntheticRunViolation {
  code: SyntheticRunOwnViolationCode | SyntheticLifecycleViolationCode | SyntheticViolationCode;
  field: string | null;
  detail: string;
}

export type SyntheticRunCreationResult =
  | { ok: true; run: SyntheticAutomationRun; violations: readonly [] }
  | { ok: false; run: null; violations: readonly SyntheticRunViolation[] };

export type SyntheticRunOperationResult =
  | { ok: true; run: SyntheticAutomationRun; violations: readonly [] }
  | { ok: false; run: SyntheticAutomationRun; violations: readonly SyntheticRunViolation[] };

// -------------------------------------------------------- validação do plano

const PLAN_FIELDS = ["planId", "version", "steps", "allowedSyntheticData"] as const;
const PLAN_FIELD_SET: ReadonlySet<string> = new Set(PLAN_FIELDS);

const STEP_FIELDS = ["stepId", "type", "description", "expectedResult", "syntheticFailure"] as const;
const STEP_FIELD_SET: ReadonlySet<string> = new Set(STEP_FIELDS);

const STEP_TYPE_SET: ReadonlySet<string> = new Set(SYNTHETIC_RUN_STEP_TYPES);
const FAILURE_KIND_SET: ReadonlySet<string> = new Set(SYNTHETIC_FAILURE_KINDS);

function requireNonEmptyString(field: string, value: unknown, out: SyntheticRunViolation[]): boolean {
  if (typeof value !== "string") {
    out.push({ code: "INVALID_TYPE", field, detail: "esperado string" });
    return false;
  }
  if (value.trim() === "") {
    out.push({ code: "EMPTY_VALUE", field, detail: "string vazia" });
    return false;
  }
  return true;
}

// Reaproveita a MESMA trava de conteúdo do contrato (host oficial, URL externa,
// CPF, segredo serializado) — não duplica a lista em terceiro lugar.
function scanFreeText(field: string, value: string, out: SyntheticRunViolation[]): void {
  out.push(...scanSyntheticValue(field, value));
}

function validateSyntheticRunStep(
  index: number,
  input: unknown,
  seenIds: Set<string>,
): { ok: true; step: SyntheticRunStep } | { ok: false; violations: SyntheticRunViolation[] } {
  const prefix = `steps[${index}]`;
  const violations: SyntheticRunViolation[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      ok: false,
      violations: [{ code: "NOT_AN_OBJECT", field: prefix, detail: "etapa precisa ser objeto" }],
    };
  }
  const candidate = input as Record<string, unknown>;

  for (const key of Object.keys(candidate)) {
    if (!STEP_FIELD_SET.has(key)) {
      violations.push({ code: "UNKNOWN_FIELD", field: `${prefix}.${key}`, detail: "campo fora da etapa fechada" });
    }
  }
  for (const field of ["stepId", "type", "description", "expectedResult"] as const) {
    if (!(field in candidate) || candidate[field] === undefined || candidate[field] === null) {
      violations.push({ code: "MISSING_FIELD", field: `${prefix}.${field}`, detail: "campo obrigatório ausente" });
    }
  }

  const stepId = candidate.stepId;
  if ("stepId" in candidate && requireNonEmptyString(`${prefix}.stepId`, stepId, violations)) {
    if (seenIds.has(stepId as string)) {
      violations.push({ code: "DUPLICATE_STEP_ID", field: `${prefix}.stepId`, detail: `stepId repetido: ${stepId as string}` });
    } else {
      seenIds.add(stepId as string);
    }
  }

  const type = candidate.type;
  if ("type" in candidate) {
    if (typeof type !== "string" || !STEP_TYPE_SET.has(type)) {
      violations.push({ code: "UNKNOWN_STEP_TYPE", field: `${prefix}.type`, detail: `tipo fora dos ${SYNTHETIC_RUN_STEP_TYPES.length} permitidos` });
    }
  }

  if ("description" in candidate && requireNonEmptyString(`${prefix}.description`, candidate.description, violations)) {
    scanFreeText(`${prefix}.description`, candidate.description as string, violations);
  }
  if ("expectedResult" in candidate && requireNonEmptyString(`${prefix}.expectedResult`, candidate.expectedResult, violations)) {
    scanFreeText(`${prefix}.expectedResult`, candidate.expectedResult as string, violations);
  }

  const syntheticFailure = candidate.syntheticFailure;
  if ("syntheticFailure" in candidate && syntheticFailure !== undefined) {
    if (typeof syntheticFailure !== "string" || !FAILURE_KIND_SET.has(syntheticFailure)) {
      violations.push({
        code: "UNKNOWN_FAILURE_KIND",
        field: `${prefix}.syntheticFailure`,
        detail: `falha fora das ${SYNTHETIC_FAILURE_KINDS.length} sintéticas do domínio`,
      });
    }
  }

  if (violations.length > 0) return { ok: false, violations };

  return {
    ok: true,
    step: {
      stepId: stepId as string,
      type: type as SyntheticRunStepType,
      description: candidate.description as string,
      expectedResult: candidate.expectedResult as string,
      ...(typeof syntheticFailure === "string" ? { syntheticFailure: syntheticFailure as SyntheticFailureKind } : {}),
    },
  };
}

export type SyntheticRunPlanValidation =
  | { ok: true; plan: SyntheticRunPlan; violations: readonly [] }
  | { ok: false; plan: null; violations: readonly SyntheticRunViolation[] };

/** Valida um candidato a plano fictício. Devolve TODAS as violações, não só a primeira. */
export function validateSyntheticRunPlan(input: unknown): SyntheticRunPlanValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, plan: null, violations: [{ code: "NOT_AN_OBJECT", field: null, detail: "plano precisa ser objeto" }] };
  }
  const candidate = input as Record<string, unknown>;
  const violations: SyntheticRunViolation[] = [];

  for (const key of Object.keys(candidate)) {
    if (!PLAN_FIELD_SET.has(key)) {
      violations.push({ code: "UNKNOWN_FIELD", field: key, detail: "campo fora do plano fechado" });
    }
  }
  for (const field of PLAN_FIELDS) {
    if (!(field in candidate) || candidate[field] === undefined || candidate[field] === null) {
      violations.push({ code: "MISSING_FIELD", field, detail: "campo obrigatório ausente" });
    }
  }

  if ("planId" in candidate) requireNonEmptyString("planId", candidate.planId, violations);
  if ("version" in candidate) requireNonEmptyString("version", candidate.version, violations);

  const validSteps: SyntheticRunStep[] = [];
  if ("steps" in candidate) {
    if (!Array.isArray(candidate.steps)) {
      violations.push({ code: "INVALID_TYPE", field: "steps", detail: "esperado lista de etapas" });
    } else if (candidate.steps.length === 0) {
      violations.push({ code: "EMPTY_PLAN", field: "steps", detail: "plano sem etapas" });
    } else {
      const seenIds = new Set<string>();
      candidate.steps.forEach((rawStep, index) => {
        const result = validateSyntheticRunStep(index, rawStep, seenIds);
        if (result.ok) validSteps.push(result.step);
        else violations.push(...result.violations);
      });
    }
  }

  const validData: string[] = [];
  if ("allowedSyntheticData" in candidate) {
    if (!Array.isArray(candidate.allowedSyntheticData)) {
      violations.push({ code: "INVALID_TYPE", field: "allowedSyntheticData", detail: "esperado string[]" });
    } else {
      candidate.allowedSyntheticData.forEach((item, index) => {
        const field = `allowedSyntheticData[${index}]`;
        if (requireNonEmptyString(field, item, violations)) {
          scanFreeText(field, item as string, violations);
          validData.push(item as string);
        }
      });
    }
  }

  if (violations.length > 0) return { ok: false, plan: null, violations };

  return {
    ok: true,
    violations: [],
    plan: {
      planId: candidate.planId as string,
      version: candidate.version as string,
      steps: validSteps,
      allowedSyntheticData: validData,
    },
  };
}

// ------------------------------------------------------------------ helpers

function buildEvidence(
  run: SyntheticAutomationRun,
  type: SyntheticRunEvidenceType,
  stepId: string,
  timestamp: string,
  reason: string,
  previousState: SyntheticRunState,
  nextState: SyntheticRunState,
  outcome: string,
): SyntheticRunEvidence {
  return {
    evidenceId: `${run.runId}-ev-${run.evidence.length + 1}`,
    runId: run.runId,
    stepId,
    timestamp,
    type,
    description: redactLabText(reason.trim() === "" ? outcome : reason).text,
    previousState,
    nextState,
    outcome: redactLabText(outcome).text,
  };
}

/**
 * Garante a sessão em `IN_PROGRESS` antes de processar uma etapa. Se ela ainda
 * está em `CLAIMED`, usa a MESMA transição atômica que o resto da Fase 2 exige
 * (primeira etapa junto com `CLAIMED -> IN_PROGRESS`, um único `step_started`).
 * Se já está `IN_PROGRESS`, não toca em nada.
 */
function ensureSessionInProgress(
  session: SyntheticSessionContract,
  step: SyntheticRunStep,
  at: string,
  reason: string,
):
  | { ok: true; session: SyntheticSessionContract; events: readonly SyntheticLabEvent[] }
  | { ok: false; violations: readonly SyntheticRunViolation[] } {
  if (session.handoffState === "IN_PROGRESS") {
    return { ok: true, session, events: [] };
  }
  if (session.handoffState !== "CLAIMED") {
    return {
      ok: false,
      violations: [
        {
          code: "SESSION_NOT_READY",
          field: "session",
          detail: `sessão em ${session.handoffState}: execução de etapa exige CLAIMED ou IN_PROGRESS`,
        },
      ],
    };
  }
  const result = applySyntheticTransition({ session, to: "IN_PROGRESS", at, step: step.description, reason });
  if (!result.ok) return { ok: false, violations: result.violations };
  return { ok: true, session: result.session, events: result.events };
}

/** Expira a sessão e o run diretamente do estado atual — sem renovar o handle nem continuar a fila. */
function expireRun(
  run: SyntheticAutomationRun,
  step: SyntheticRunStep,
  reason: string,
): SyntheticRunOperationResult {
  const at = run.session.expiresAt;
  const result = applySyntheticTransition({ session: run.session, to: "EXPIRED", at, reason });
  if (!result.ok) return { ok: false, run, violations: result.violations };

  const evidence = buildEvidence(run, "RUN_EXPIRED", step.stepId, at, reason, run.state, "EXPIRED", "prazo do handle sintético alcançado");

  return {
    ok: true,
    violations: [],
    run: {
      ...run,
      session: result.session,
      state: "EXPIRED",
      humanFallbackRequired: false,
      result: { outcome: "EXPIRED", syntheticProtocol: null, completedAt: at },
      events: [...run.events, ...result.events],
      evidence: [...run.evidence, evidence],
    },
  };
}

type RunDisruption = { kind: "CAPTCHA" } | { kind: "FAILURE"; failure: SyntheticFailureKind };

/**
 * Aplica um desfecho de interrupção (captcha ou falha) à etapa que está na
 * cabeça da fila. Compartilhada por `executeNextSyntheticStep` (quando a
 * própria etapa do plano já carrega `syntheticFailure`) e por
 * `interruptSyntheticRun` (ação explícita do laboratório).
 */
function applyRunDisruption(
  run: SyntheticAutomationRun,
  step: SyntheticRunStep,
  disruption: RunDisruption,
  at: string,
  reason: string,
): SyntheticRunOperationResult {
  // Prazo vencido tem um único destino — não é defeito (docs/74 §11.8).
  if (disruption.kind === "FAILURE" && disruption.failure === "HANDLE_EXPIRED") {
    return expireRun(run, step, reason);
  }

  const ready = ensureSessionInProgress(run.session, step, at, reason);
  if (!ready.ok) {
    if (ready.violations.some((v) => v.code === "SESSION_EXPIRED")) return expireRun(run, step, reason);
    return { ok: false, run, violations: ready.violations };
  }

  if (disruption.kind === "CAPTCHA") {
    const blocked = applySyntheticTransition({ session: ready.session, to: "BLOCKED", at, reason });
    if (!blocked.ok) {
      if (blocked.violations.some((v) => v.code === "SESSION_EXPIRED")) return expireRun(run, step, reason);
      return { ok: false, run, violations: blocked.violations };
    }
    const evidence = buildEvidence(
      run,
      "RUN_BLOCKED",
      step.stepId,
      at,
      reason,
      run.state,
      "WAITING_HUMAN",
      "captcha sintético: fallback humano necessário",
    );
    return {
      ok: true,
      violations: [],
      run: {
        ...run,
        session: blocked.session,
        state: "WAITING_HUMAN",
        humanFallbackRequired: true,
        events: [...run.events, ...ready.events, ...blocked.events],
        evidence: [...run.evidence, evidence],
      },
    };
  }

  const failed = applySyntheticTransition({
    session: ready.session,
    to: "FAILED",
    at,
    failure: disruption.failure,
    reason,
  });
  if (!failed.ok) {
    if (failed.violations.some((v) => v.code === "SESSION_EXPIRED")) return expireRun(run, step, reason);
    return { ok: false, run, violations: failed.violations };
  }
  const evidence = buildEvidence(
    run,
    "STEP_FAILED",
    step.stepId,
    at,
    reason,
    run.state,
    "FAILED",
    `falha sintética: ${disruption.failure}`,
  );
  return {
    ok: true,
    violations: [],
    run: {
      ...run,
      session: failed.session,
      state: "FAILED",
      result: { outcome: "FAILURE", syntheticProtocol: null, completedAt: at },
      events: [...run.events, ...ready.events, ...failed.events],
      evidence: [...run.evidence, evidence],
    },
  };
}

// -------------------------------------------------------------------- API

export interface CreateSyntheticRunInput {
  runId: string;
  /** Sessão válida (qualquer estado não-terminal) — validada pelo contrato da Fase 2. */
  session: unknown;
  plan: unknown;
}

/** Cria um run sintético em `QUEUED`, com a fila cheia e nada executado ainda. */
export function createSyntheticRun(input: CreateSyntheticRunInput): SyntheticRunCreationResult {
  const violations: SyntheticRunViolation[] = [];

  if (typeof input.runId !== "string" || input.runId.trim() === "") {
    violations.push({ code: "EMPTY_VALUE", field: "runId", detail: "runId obrigatório" });
  }

  const sessionValidation = validateSyntheticSessionContract(input.session);
  if (!sessionValidation.ok) violations.push(...sessionValidation.violations);

  const planValidation = validateSyntheticRunPlan(input.plan);
  if (!planValidation.ok) violations.push(...planValidation.violations);

  if (!sessionValidation.ok || !planValidation.ok || violations.length > 0) {
    return { ok: false, run: null, violations };
  }

  const session = sessionValidation.contract;
  const plan = planValidation.plan;

  if (isSyntheticTerminalState(session.handoffState)) {
    return {
      ok: false,
      run: null,
      violations: [
        { code: "SESSION_NOT_READY", field: "session", detail: "sessão terminal não inicia run novo — abra outra sessão" },
      ],
    };
  }

  return {
    ok: true,
    violations: [],
    run: {
      runId: input.runId,
      session,
      plan,
      pendingSteps: [...plan.steps],
      currentStep: plan.steps[0] ?? null,
      completedSteps: [],
      state: "QUEUED",
      events: [],
      evidence: [],
      humanFallbackRequired: false,
      result: null,
    },
  };
}

export interface ExecuteNextSyntheticStepInput {
  run: SyntheticAutomationRun;
  at: string;
  reason?: string;
}

/** Executa a etapa na cabeça da fila. Não existe parâmetro de "qual etapa" — só a próxima. */
export function executeNextSyntheticStep(input: ExecuteNextSyntheticStepInput): SyntheticRunOperationResult {
  const { run, at } = input;
  const reason = input.reason ?? "";

  if (isSyntheticRunTerminalState(run.state)) {
    return {
      ok: false,
      run,
      violations: [{ code: "RUN_TERMINAL_NO_CONTINUE", field: "state", detail: `${run.state} é terminal: não continua — inicie novo run` }],
    };
  }
  if (run.state === "WAITING_HUMAN") {
    return {
      ok: false,
      run,
      violations: [{ code: "HUMAN_FALLBACK_PENDING", field: "state", detail: "run aguardando desfecho humano: não executa próxima etapa" }],
    };
  }
  const step = run.pendingSteps[0];
  if (step === undefined) {
    return { ok: false, run, violations: [{ code: "QUEUE_EMPTY", field: "pendingSteps", detail: "nenhuma etapa pendente" }] };
  }
  if (!isIsoTimestamp(at)) {
    return { ok: false, run, violations: [{ code: "INVALID_TIMESTAMP", field: "at", detail: "ISO-8601 inválido" }] };
  }

  // Etapa marcada com falha sintética (fixture de teste): aplica e para.
  if (step.syntheticFailure !== undefined) {
    return applyRunDisruption(run, step, { kind: "FAILURE", failure: step.syntheticFailure }, at, reason);
  }

  const ready = ensureSessionInProgress(run.session, step, at, reason);
  if (!ready.ok) {
    if (ready.violations.some((v) => v.code === "SESSION_EXPIRED")) return expireRun(run, step, reason);
    return { ok: false, run, violations: ready.violations };
  }

  const recorded = recordSyntheticStep({ session: ready.session, step: step.description, phase: "COMPLETED", at, reason });
  if (!recorded.ok) {
    if (recorded.violations.some((v) => v.code === "SESSION_EXPIRED")) return expireRun(run, step, reason);
    return { ok: false, run, violations: recorded.violations };
  }

  const remaining = run.pendingSteps.slice(1);
  const evidenceStep = buildEvidence(
    run,
    "STEP_COMPLETED",
    step.stepId,
    at,
    reason,
    run.state,
    remaining.length === 0 ? "COMPLETED" : "RUNNING",
    step.expectedResult,
  );
  const completed: SyntheticCompletedRunStep = { step, evidenceId: evidenceStep.evidenceId, completedAt: at };

  const withStep: SyntheticAutomationRun = {
    ...run,
    session: recorded.session,
    pendingSteps: remaining,
    currentStep: remaining[0] ?? null,
    completedSteps: [...run.completedSteps, completed],
    state: remaining.length === 0 ? run.state : "RUNNING",
    events: [...run.events, ...ready.events, ...recorded.events],
    evidence: [...run.evidence, evidenceStep],
  };

  if (remaining.length > 0) {
    return { ok: true, violations: [], run: withStep };
  }

  // Última etapa: concluir a sessão (com o protocolo sintético dela) e o run juntos.
  const finished = applySyntheticTransition({
    session: recorded.session,
    to: "COMPLETED",
    at,
    syntheticProtocol: recorded.session.allowedSyntheticProcessCode,
    reason,
  });
  if (!finished.ok) {
    if (finished.violations.some((v) => v.code === "SESSION_EXPIRED")) return expireRun(run, step, reason);
    return { ok: false, run, violations: finished.violations };
  }

  const evidenceRun = buildEvidence(withStep, "RUN_COMPLETED", step.stepId, at, reason, "RUNNING", "COMPLETED", "jornada sintética concluída");

  return {
    ok: true,
    violations: [],
    run: {
      ...withStep,
      session: finished.session,
      state: "COMPLETED",
      result: { outcome: "SUCCESS", syntheticProtocol: finished.syntheticProtocol, completedAt: at },
      events: [...withStep.events, ...finished.events],
      evidence: [...withStep.evidence, evidenceRun],
    },
  };
}

export interface InterruptSyntheticRunInput {
  run: SyntheticAutomationRun;
  at: string;
  reason?: string;
  /** Causa explícita da interrupção — captcha sintético ou uma das falhas do domínio. */
  cause: RunDisruption;
}

/**
 * Interrompe o run explicitamente (captcha, timeout ou qualquer falha
 * sintética), sem consumir a etapa da cabeça da fila como se tivesse sido
 * executada. É o que o laboratório usa para "simular falha na próxima etapa" /
 * "simular captcha" sem precisar embutir a falha no plano.
 */
export function interruptSyntheticRun(input: InterruptSyntheticRunInput): SyntheticRunOperationResult {
  const { run, at } = input;
  const reason = input.reason ?? "";

  if (isSyntheticRunTerminalState(run.state)) {
    return {
      ok: false,
      run,
      violations: [{ code: "RUN_TERMINAL_NO_CONTINUE", field: "state", detail: `${run.state} é terminal: não interrompe de novo` }],
    };
  }
  if (run.state === "WAITING_HUMAN") {
    return {
      ok: false,
      run,
      violations: [{ code: "HUMAN_FALLBACK_PENDING", field: "state", detail: "run já aguarda desfecho humano" }],
    };
  }
  const step = run.pendingSteps[0];
  if (step === undefined) {
    return { ok: false, run, violations: [{ code: "QUEUE_EMPTY", field: "pendingSteps", detail: "nenhuma etapa pendente para interromper" }] };
  }
  if (!isIsoTimestamp(at)) {
    return { ok: false, run, violations: [{ code: "INVALID_TIMESTAMP", field: "at", detail: "ISO-8601 inválido" }] };
  }

  return applyRunDisruption(run, step, input.cause, at, reason);
}

export interface ResumeSyntheticRunInput {
  run: SyntheticAutomationRun;
  at: string;
  reason?: string;
}

/**
 * Só existe porque a API precisa de um ponto explícito de retomada — não
 * porque exista retomada concedida. `WAITING_HUMAN` só é alcançado por captcha
 * sintético, e `BLOCKED` não tem saída para frente (docs/74 §8.5/§8.6): esta
 * função SEMPRE recusa. O desfecho de um bloqueio é cancelar, falhar ou deixar
 * expirar — nunca continuar a fila.
 */
export function resumeSyntheticRun(input: ResumeSyntheticRunInput): SyntheticRunOperationResult {
  const { run } = input;
  if (run.state !== "WAITING_HUMAN") {
    return {
      ok: false,
      run,
      violations: [{ code: "NOT_WAITING_HUMAN", field: "state", detail: "só é possível retomar um run em WAITING_HUMAN" }],
    };
  }
  return {
    ok: false,
    run,
    violations: [
      {
        code: "CAPTCHA_NO_RESUME",
        field: "state",
        detail: "bloqueio por captcha sintético não tem retomada automática; encerre com cancelamento, falha ou deixe expirar",
      },
    ],
  };
}

export interface CancelSyntheticRunInput {
  run: SyntheticAutomationRun;
  at: string;
  reason?: string;
}

export function cancelSyntheticRun(input: CancelSyntheticRunInput): SyntheticRunOperationResult {
  const { run, at } = input;
  const reason = input.reason ?? "encerramento humano do run sintético";

  if (isSyntheticRunTerminalState(run.state)) {
    return {
      ok: false,
      run,
      violations: [{ code: "RUN_TERMINAL_NO_CONTINUE", field: "state", detail: `${run.state} é terminal: não cancela de novo` }],
    };
  }
  if (!isIsoTimestamp(at)) {
    return { ok: false, run, violations: [{ code: "INVALID_TIMESTAMP", field: "at", detail: "ISO-8601 inválido" }] };
  }

  const result = applySyntheticTransition({ session: run.session, to: "CANCELLED", at, reason });
  if (!result.ok) return { ok: false, run, violations: result.violations };

  const evidence = buildEvidence(
    run,
    "RUN_CANCELLED",
    run.currentStep?.stepId ?? run.plan.planId,
    at,
    reason,
    run.state,
    "CANCELLED",
    "cancelamento humano do run sintético",
  );

  return {
    ok: true,
    violations: [],
    run: {
      ...run,
      session: result.session,
      state: "CANCELLED",
      humanFallbackRequired: false,
      result: { outcome: "CANCELLED", syntheticProtocol: null, completedAt: at },
      events: [...run.events, ...result.events],
      evidence: [...run.evidence, evidence],
    },
  };
}

// -------------------------------------------------------------------- view

/** O que a tela pode mostrar. Sem `session` — `sessionHandle` nunca chega aqui. */
export interface SyntheticRunView {
  runId: string;
  state: SyntheticRunState;
  terminal: boolean;
  humanFallbackRequired: boolean;
  planId: string;
  planVersion: string;
  currentStep: { stepId: string; type: SyntheticRunStepType; description: string } | null;
  pendingStepIds: readonly string[];
  completedStepIds: readonly string[];
  evidence: readonly SyntheticRunEvidence[];
  result: SyntheticRunResult | null;
}

export function syntheticRunView(run: SyntheticAutomationRun): SyntheticRunView {
  return {
    runId: run.runId,
    state: run.state,
    terminal: isSyntheticRunTerminalState(run.state),
    humanFallbackRequired: run.humanFallbackRequired,
    planId: run.plan.planId,
    planVersion: run.plan.version,
    currentStep:
      run.currentStep === null
        ? null
        : { stepId: run.currentStep.stepId, type: run.currentStep.type, description: run.currentStep.description },
    pendingStepIds: run.pendingSteps.map((s) => s.stepId),
    completedStepIds: run.completedSteps.map((c) => c.step.stepId),
    evidence: run.evidence,
    result: run.result,
  };
}

// Reexport só de tipo, para quem monta a fila sem duplicar o enum da sessão.
export type { SyntheticHandoffState };
