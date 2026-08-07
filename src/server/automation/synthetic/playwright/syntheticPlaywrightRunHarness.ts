/**
 * Harness de ALTO NÍVEL: roda o plano sintético INTEIRO por cima do
 * coordenador puro e do runner local, e produz um relatório final redigido.
 *
 * ```
 * criar sessão (validada) → criar run → executar próxima etapa com Playwright
 * → atualizar run → repetir enquanto o estado permitir → interromper ou
 * concluir → relatório final
 * ```
 *
 * NÃO duplica lógica: cria o run via `createSyntheticRun`, avança via
 * `runNextSyntheticStepLocally` (que já delega a `executeNextSyntheticStep`/
 * `interruptSyntheticRun`), e para nas mesmas condições que o coordenador já
 * conhece (terminal, `WAITING_HUMAN`). O único código NOVO aqui é o LOOP com
 * teto de segurança e a MONTAGEM do relatório.
 *
 * Única camada assíncrona nova; o relógio é sempre uma sequência INJETADA
 * (`clock`) — nunca `Date.now()`.
 */
import {
  createSyntheticRun,
  isSyntheticRunTerminalState,
  type SyntheticAutomationRun,
  type SyntheticRunEvidence,
  type SyntheticRunState,
  type SyntheticRunStepType,
  type SyntheticRunViolation,
} from "../syntheticRunCoordinator";
import {
  isIsoTimestamp,
  scanSyntheticValue,
  type SyntheticContractViolation,
  type SyntheticHandoffState,
  type SyntheticViolationCode,
} from "../sessionContract";
import type { SyntheticLabEvent } from "../sessionLifecycle";
import { LAB_SYNTHETIC_PROTOCOL_PREFIX } from "../../lab/labRunReport";
import { runNextSyntheticStepLocally } from "./localSyntheticRunner";
import type { SyntheticStepExecutor } from "./syntheticStepExecutor";

// ------------------------------------------------------------------ entrada

/**
 * Entrada FECHADA: plano e sessão (validados pelo coordenador puro), o
 * executor (o adaptador Playwright, ou um fake de teste), a sequência de
 * relógio injetada e o teto de segurança. Nada de URL solta, credencial, CPF,
 * senha, token, cookie, storage state ou payload livre — quem quiser mudar o
 * alvo passa por `executor`, já validado no construtor do adaptador.
 */
export interface SyntheticPlaywrightHarnessInput {
  runId: string;
  session: unknown;
  plan: unknown;
  executor: SyntheticStepExecutor;
  /**
   * Relógio sintético injetado: um timestamp por operação (criação do run +
   * uma por etapa tentada). Se a sequência for mais curta que o número de
   * etapas, o ÚLTIMO valor é reusado — nunca `Date.now()`.
   */
  clock: readonly string[];
  /**
   * Teto de segurança contra loop infinito. Nunca ilimitado: por padrão é o
   * número de etapas do plano, e um valor explícito NUNCA ultrapassa esse
   * número (item 9 do loop controlado).
   */
  maxSteps?: number;
  reason?: string;
}

// ------------------------------------------------------------------ saída

/**
 * Resultado fechado do harness. Reusa `SyntheticRunState` (sem `QUEUED`/
 * `RUNNING`, que nunca são um desfecho de parada) em vez de reinventar os
 * mesmos 5 nomes — só os 2 exclusivos do harness são novos.
 */
export type SyntheticRunHarnessOutcome =
  | Exclude<SyntheticRunState, "QUEUED" | "RUNNING">
  | "SAFETY_LIMIT_REACHED"
  | "INVALID_INITIAL_STATE";

export const SYNTHETIC_PLAYWRIGHT_STEP_REPORT_STATUSES = ["COMPLETED", "INTERRUPTED", "NOT_EXECUTED"] as const;
export type SyntheticPlaywrightStepReportStatus = (typeof SYNTHETIC_PLAYWRIGHT_STEP_REPORT_STATUSES)[number];

export interface SyntheticPlaywrightStepReport {
  stepId: string;
  type: SyntheticRunStepType;
  status: SyntheticPlaywrightStepReportStatus;
}

/**
 * Relatório final FECHADO. Só os campos abaixo — nada de `sessionHandle`,
 * HTML, screenshot, stack trace, URL completa, headers, requests, cookie,
 * token, credencial, CPF, senha ou storage state. `events`/`evidence` já
 * chegam redigidos (o lifecycle e o coordenador redigem na origem) — o
 * relatório só os carrega, sem re-processar.
 */
export interface SyntheticPlaywrightRunReport {
  runId: string;
  planId: string;
  /** Fictício — vem do contrato da sessão. */
  processId: string;
  /** `null` só quando `outcome === "INVALID_INITIAL_STATE"` (nunca chegou a existir sessão válida). */
  sessionState: SyntheticHandoffState | null;
  /** `null` só quando `outcome === "INVALID_INITIAL_STATE"`. */
  runState: SyntheticRunState | null;
  startedAt: string;
  finishedAt: string;
  totalSteps: number;
  executedSteps: readonly SyntheticPlaywrightStepReport[];
  remainingSteps: readonly SyntheticPlaywrightStepReport[];
  events: readonly SyntheticLabEvent[];
  evidence: readonly SyntheticRunEvidence[];
  /** Só preenchido quando `outcome === "COMPLETED"`; falha/interrupção nunca produz protocolo. */
  syntheticProtocol: string | null;
  humanFallbackRequired: boolean;
  /** Resultado final — dobra como o motivo tipado da interrupção quando não é `COMPLETED`. */
  outcome: SyntheticRunHarnessOutcome;
  /** Só não-vazio em `INVALID_INITIAL_STATE` — por que a entrada foi recusada. */
  violations: readonly (SyntheticRunViolation | SyntheticContractViolation)[];
  synthetic: true;
  local: true;
}

/** Mesmo tipo do relatório — o harness devolve o relatório em si, não um envelope à parte. */
export type SyntheticRunHarnessResult = SyntheticPlaywrightRunReport;

// ------------------------------------------------------------------ helpers

function extractPlanId(plan: unknown): string {
  if (typeof plan === "object" && plan !== null && "planId" in plan) {
    const value = (plan as Record<string, unknown>).planId;
    if (typeof value === "string") return value;
  }
  return "";
}

function invalidReport(
  input: SyntheticPlaywrightHarnessInput,
  violations: readonly (SyntheticRunViolation | SyntheticContractViolation)[],
  startedAt: string,
): SyntheticPlaywrightRunReport {
  return {
    runId: input.runId,
    planId: extractPlanId(input.plan),
    processId: "",
    sessionState: null,
    runState: null,
    startedAt,
    finishedAt: startedAt,
    totalSteps: 0,
    executedSteps: [],
    remainingSteps: [],
    events: [],
    evidence: [],
    syntheticProtocol: null,
    humanFallbackRequired: false,
    outcome: "INVALID_INITIAL_STATE",
    violations,
    synthetic: true,
    local: true,
  };
}

function stepReports(run: SyntheticAutomationRun, outcome: SyntheticRunHarnessOutcome): {
  executedSteps: SyntheticPlaywrightStepReport[];
  remainingSteps: SyntheticPlaywrightStepReport[];
} {
  const executedSteps = run.completedSteps.map((completed) => ({
    stepId: completed.step.stepId,
    type: completed.step.type,
    status: "COMPLETED" as const,
  }));

  const remainingSteps = run.pendingSteps.map((step, index) => ({
    stepId: step.stepId,
    type: step.type,
    status: index === 0 && outcome !== "COMPLETED" ? ("INTERRUPTED" as const) : ("NOT_EXECUTED" as const),
  }));

  return { executedSteps, remainingSteps };
}

function deriveOutcome(run: SyntheticAutomationRun, hitSafetyLimit: boolean): SyntheticRunHarnessOutcome {
  if (hitSafetyLimit) return "SAFETY_LIMIT_REACHED";
  switch (run.state) {
    case "COMPLETED":
    case "WAITING_HUMAN":
    case "FAILED":
    case "EXPIRED":
    case "CANCELLED":
      return run.state;
    default:
      // QUEUED/RUNNING não deveriam sobreviver ao loop sem o teto de
      // segurança tê-lo interrompido — tratado como o mesmo teto, nunca como
      // sucesso por omissão.
      return "SAFETY_LIMIT_REACHED";
  }
}

function finishedReport(
  run: SyntheticAutomationRun,
  outcome: SyntheticRunHarnessOutcome,
  startedAt: string,
  finishedAt: string,
): SyntheticPlaywrightRunReport {
  const { executedSteps, remainingSteps } = stepReports(run, outcome);

  return {
    runId: run.runId,
    planId: run.plan.planId,
    processId: run.session.processId,
    sessionState: run.session.handoffState,
    runState: run.state,
    startedAt,
    finishedAt,
    totalSteps: run.plan.steps.length,
    executedSteps,
    remainingSteps,
    events: run.events,
    evidence: run.evidence,
    syntheticProtocol: outcome === "COMPLETED" ? run.result?.syntheticProtocol ?? null : null,
    humanFallbackRequired: run.humanFallbackRequired,
    outcome,
    violations: [],
    synthetic: true,
    local: true,
  };
}

// --------------------------------------------------------------------- API

/**
 * Roda o plano sintético inteiro contra o executor informado, uma etapa por
 * vez, parando no primeiro estado terminal, `WAITING_HUMAN` ou no teto de
 * segurança — o que vier primeiro.
 */
export async function runSyntheticPlaywrightPlan(
  input: SyntheticPlaywrightHarnessInput,
): Promise<SyntheticRunHarnessResult> {
  const startedAt = input.clock[0];
  if (startedAt === undefined || !isIsoTimestamp(startedAt)) {
    return invalidReport(
      input,
      [{ code: "INVALID_TIMESTAMP", field: "clock", detail: "relógio injetado vazio ou inválido" }],
      startedAt ?? "",
    );
  }

  const created = createSyntheticRun({ runId: input.runId, session: input.session, plan: input.plan });
  if (!created.ok) {
    return invalidReport(input, created.violations, startedAt);
  }

  let run = created.run;
  const planStepCount = run.plan.steps.length;
  // Nunca ilimitado, e nunca acima do número de etapas do plano — mesmo que o
  // chamador informe um teto maior por engano.
  const maxSteps = Math.min(input.maxSteps ?? planStepCount, planStepCount);
  if (maxSteps <= 0) {
    return invalidReport(
      input,
      [{ code: "INVALID_TYPE", field: "maxSteps", detail: "teto de segurança precisa ser positivo" }],
      startedAt,
    );
  }

  let iterations = 0;
  let finishedAt = startedAt;
  let hitSafetyLimit = false;

  while (!isSyntheticRunTerminalState(run.state) && run.state !== "WAITING_HUMAN") {
    if (iterations >= maxSteps) {
      hitSafetyLimit = true;
      break;
    }

    const at = input.clock[iterations + 1] ?? input.clock[input.clock.length - 1] ?? startedAt;
    const result = await runNextSyntheticStepLocally({ run, executor: input.executor, at, reason: input.reason });
    iterations += 1;
    finishedAt = at;

    // Violação típica (ex.: `at` fora de ordem) — o loop encerra com o
    // estado que o run já tinha; nenhum retry automático.
    if (!result.ok) break;
    run = result.run;
  }

  const outcome = deriveOutcome(run, hitSafetyLimit);
  return finishedReport(run, outcome, startedAt, finishedAt);
}

// ------------------------------------------------------------- validação

export const SYNTHETIC_PLAYWRIGHT_REPORT_FIELDS = [
  "runId",
  "planId",
  "processId",
  "sessionState",
  "runState",
  "startedAt",
  "finishedAt",
  "totalSteps",
  "executedSteps",
  "remainingSteps",
  "events",
  "evidence",
  "syntheticProtocol",
  "humanFallbackRequired",
  "outcome",
  "violations",
  "synthetic",
  "local",
] as const;

const REPORT_FIELD_SET: ReadonlySet<string> = new Set(SYNTHETIC_PLAYWRIGHT_REPORT_FIELDS);

export const SYNTHETIC_PLAYWRIGHT_REPORT_VIOLATION_CODES = [
  "NOT_AN_OBJECT",
  "UNKNOWN_FIELD",
  "MISSING_FIELD",
  "INVALID_TYPE",
  "INVALID_PROTOCOL",
  "PROTOCOL_WITHOUT_SUCCESS",
  "WAITING_HUMAN_WITHOUT_FALLBACK",
  "SUCCESS_WITHOUT_ALL_STEPS",
] as const;

export interface SyntheticPlaywrightReportViolation {
  code: (typeof SYNTHETIC_PLAYWRIGHT_REPORT_VIOLATION_CODES)[number] | SyntheticViolationCode;
  field: string | null;
  detail: string;
}

export type SyntheticPlaywrightReportValidation =
  | { ok: true; violations: readonly [] }
  | { ok: false; violations: readonly SyntheticPlaywrightReportViolation[] };

/**
 * Valida um relatório já montado. Reusa `scanSyntheticValue` (mesma trava de
 * host oficial/URL externa/CPF/segredo serializado do resto da Fase 2) em vez
 * de copiar regex — só os invariantes PRÓPRIOS do relatório são novos.
 */
export function validateSyntheticPlaywrightRunReport(input: unknown): SyntheticPlaywrightReportValidation {
  const violations: SyntheticPlaywrightReportViolation[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, violations: [{ code: "NOT_AN_OBJECT", field: null, detail: "relatório precisa ser objeto" }] };
  }
  const report = input as Record<string, unknown>;

  for (const key of Object.keys(report)) {
    if (!REPORT_FIELD_SET.has(key)) {
      violations.push({ code: "UNKNOWN_FIELD", field: key, detail: "campo fora do relatório fechado" });
    }
  }
  for (const field of SYNTHETIC_PLAYWRIGHT_REPORT_FIELDS) {
    if (!(field in report)) {
      violations.push({ code: "MISSING_FIELD", field, detail: "campo obrigatório ausente" });
    }
  }

  // ---- conteúdo proibido em qualquer parte do relatório (recursivo)
  violations.push(...scanSyntheticValue("report", report));

  const outcome = report.outcome;
  const protocol = report.syntheticProtocol;
  const humanFallbackRequired = report.humanFallbackRequired;
  const totalSteps = report.totalSteps;
  const executedSteps = report.executedSteps;
  const remainingSteps = report.remainingSteps;

  // ---- protocolo: só PROT-FICT-*, só em COMPLETED
  if (typeof protocol === "string") {
    if (!protocol.startsWith(LAB_SYNTHETIC_PROTOCOL_PREFIX)) {
      violations.push({ code: "INVALID_PROTOCOL", field: "syntheticProtocol", detail: `fora do padrão sintético ${LAB_SYNTHETIC_PROTOCOL_PREFIX}*` });
    }
    if (outcome !== "COMPLETED") {
      violations.push({ code: "PROTOCOL_WITHOUT_SUCCESS", field: "syntheticProtocol", detail: "protocolo só é permitido quando outcome é COMPLETED" });
    }
  }

  // ---- WAITING_HUMAN exige fallback humano
  if (outcome === "WAITING_HUMAN" && humanFallbackRequired !== true) {
    violations.push({ code: "WAITING_HUMAN_WITHOUT_FALLBACK", field: "humanFallbackRequired", detail: "WAITING_HUMAN sem humanFallbackRequired" });
  }

  // ---- sucesso só depois de todas as etapas
  if (outcome === "COMPLETED") {
    const executedCount = Array.isArray(executedSteps) ? executedSteps.length : -1;
    const remainingCount = Array.isArray(remainingSteps) ? remainingSteps.length : -1;
    if (typeof totalSteps === "number" && (executedCount !== totalSteps || remainingCount !== 0)) {
      violations.push({
        code: "SUCCESS_WITHOUT_ALL_STEPS",
        field: "executedSteps",
        detail: "COMPLETED exige todas as etapas executadas e nenhuma restante",
      });
    }
  }

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, violations: [] };
}
