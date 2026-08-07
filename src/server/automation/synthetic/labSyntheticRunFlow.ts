/**
 * Fase 2 — fluxo do LABORATÓRIO para o coordenador de execução sintética
 * (`syntheticRunCoordinator.ts`). Mesma divisão de responsabilidade que
 * `labSyntheticFlow.ts`: aqui mora só o que a TELA precisa (run atual, fixture
 * de sessão/plano, relógio sintético) — nenhuma regra de fila, evento ou
 * transição é reimplementada.
 *
 * Modulo PURO: sem I/O, sem rede, sem Prisma, sem Fase 9, sem persistência. O
 * estado vive em memória e some no reload. Relógio sintético próprio (sem
 * `Date.now()`), igual ao resto da Fase 2.
 */
import {
  cancelSyntheticRun,
  createSyntheticRun,
  executeNextSyntheticStep,
  interruptSyntheticRun,
  syntheticRunView,
  type SyntheticAutomationRun,
  type SyntheticRunPlan,
  type SyntheticRunViolation,
  type SyntheticRunView,
} from "./syntheticRunCoordinator";
import type { SyntheticFailureKind } from "./sessionLifecycle";
import type { SyntheticSessionContract } from "./sessionContract";

const RUN_ISSUED_AT = "2026-08-06T12:00:00.000Z";
const RUN_TICK_MS = 60_000;
/** Prazo curto do handle sintético: 10 minutos, no mesmo padrão do resto do laboratório. */
const RUN_TTL_MS = 10 * RUN_TICK_MS;
const RUN_SESSION_SPAN_MS = 60 * RUN_TICK_MS;
const RUN_MAX_TICKS = 8;

function seqLabel(seq: number): string {
  return String(seq + 1).padStart(4, "0");
}

function issuedAtFor(seq: number): string {
  return new Date(Date.parse(RUN_ISSUED_AT) + seq * RUN_SESSION_SPAN_MS).toISOString();
}

function expiresAtFor(seq: number): string {
  return new Date(Date.parse(issuedAtFor(seq)) + RUN_TTL_MS).toISOString();
}

function clockAt(seq: number, ticks: number): string {
  const offset = Math.min(ticks, RUN_MAX_TICKS) * RUN_TICK_MS;
  return new Date(Date.parse(issuedAtFor(seq)) + offset).toISOString();
}

/**
 * Sessão fictícia já em `CLAIMED`: este laboratório demonstra o coordenador de
 * RUN, não o login/handoff (isso já é o `labSyntheticFlow.ts` acima). Nasce
 * pronta para a primeira etapa entrar em `IN_PROGRESS`.
 */
function runSessionFixture(seq: number): SyntheticSessionContract {
  const label = seqLabel(seq);
  return {
    sessionHandle: `sh_lab_run_${label}`,
    processId: `proc-lab-run-${label}`,
    actorId: "operador-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: expiresAtFor(seq),
    issuedAt: issuedAtFor(seq),
    environment: "synthetic",
    consentMarker: "consentimento-sintetico-lab-run",
    handoffState: "CLAIMED",
    auditCorrelationId: `corr-lab-run-${label}`,
    allowedSyntheticProcessCode: `PROT-FICT-RUN-${label}`,
  };
}

/**
 * Plano fictício de 4 etapas (docs desta PR): validar, abrir, preencher e
 * confirmar — nenhum nome de página, seletor ou campo real do SINARM/Gov.br.
 * Pura simulação de orquestração.
 */
export function demoSyntheticRunPlan(seq: number): SyntheticRunPlan {
  const label = seqLabel(seq);
  return {
    planId: `plan-lab-demo-${label}`,
    version: "1.0.0",
    allowedSyntheticData: ["destino fictício", "acervo fictício"],
    steps: [
      {
        stepId: "step-1-validar",
        type: "VALIDATE_INPUT",
        description: "validar dados sintéticos",
        expectedResult: "dados fictícios validados",
      },
      {
        stepId: "step-2-abrir",
        type: "OPEN_FORM",
        description: "abrir formulário fictício",
        expectedResult: "formulário fictício aberto",
      },
      {
        stepId: "step-3-preencher",
        type: "FILL_FORM",
        description: "preencher dados fictícios",
        expectedResult: "formulário fictício preenchido",
      },
      {
        stepId: "step-4-confirmar",
        type: "CONFIRM_RESULT",
        description: "confirmar resultado fictício",
        expectedResult: "resultado fictício confirmado",
      },
    ],
  };
}

export type LabRunAction =
  | { kind: "create-run" }
  | { kind: "execute-next" }
  | { kind: "captcha" }
  | { kind: "fail"; failure: SyntheticFailureKind }
  | { kind: "cancel" }
  | { kind: "new-run" }
  | { kind: "reset" };

export interface LabRunFlowState {
  run: SyntheticAutomationRun | null;
  violations: readonly SyntheticRunViolation[];
  ticks: number;
  runSeq: number;
}

export function initialLabRunFlowState(): LabRunFlowState {
  return { run: null, violations: [], ticks: 0, runSeq: 0 };
}

function violation(state: LabRunFlowState, detail: string): LabRunFlowState {
  return { ...state, violations: [{ code: "INVALID_STATE", field: "run", detail }] };
}

function startRun(state: LabRunFlowState, seq: number): LabRunFlowState {
  const result = createSyntheticRun({
    runId: `run-lab-${seqLabel(seq)}`,
    session: runSessionFixture(seq),
    plan: demoSyntheticRunPlan(seq),
  });
  if (!result.ok) return { ...state, violations: result.violations };
  return { run: result.run, violations: [], ticks: 0, runSeq: seq };
}

/** Executa uma ação do laboratório de execução sintética. Ação recusada não altera o run. */
export function applyLabRunAction(state: LabRunFlowState, action: LabRunAction): LabRunFlowState {
  if (action.kind === "reset") return initialLabRunFlowState();

  if (action.kind === "create-run") {
    if (state.run !== null) return violation(state, "já existe um run sintético");
    return startRun(state, state.runSeq);
  }

  if (state.run === null) {
    return violation(state, "nenhum run sintético: crie um run primeiro");
  }

  const run = state.run;
  const at = clockAt(state.runSeq, state.ticks + 1);

  if (action.kind === "new-run") {
    if (run.result === null) {
      return violation(state, "o run atual ainda não terminou: conclua, cancele ou deixe expirar antes de iniciar outro");
    }
    return startRun(state, state.runSeq + 1);
  }

  switch (action.kind) {
    case "execute-next": {
      const result = executeNextSyntheticStep({ run, at, reason: "execução sintética do laboratório" });
      if (!result.ok) return { ...state, violations: result.violations };
      return { ...state, run: result.run, violations: [], ticks: state.ticks + 1 };
    }
    case "captcha": {
      const result = interruptSyntheticRun({ run, at, cause: { kind: "CAPTCHA" }, reason: "captcha sintético simulado" });
      if (!result.ok) return { ...state, violations: result.violations };
      return { ...state, run: result.run, violations: [], ticks: state.ticks + 1 };
    }
    case "fail": {
      const result = interruptSyntheticRun({
        run,
        at,
        cause: { kind: "FAILURE", failure: action.failure },
        reason: `falha sintética simulada: ${action.failure}`,
      });
      if (!result.ok) return { ...state, violations: result.violations };
      return { ...state, run: result.run, violations: [], ticks: state.ticks + 1 };
    }
    case "cancel": {
      const result = cancelSyntheticRun({ run, at, reason: "cancelamento humano do laboratório" });
      if (!result.ok) return { ...state, violations: result.violations };
      return { ...state, run: result.run, violations: [], ticks: state.ticks + 1 };
    }
  }
}

export interface LabRunView extends SyntheticRunView {
  runNumber: number;
}

export function labRunView(state: LabRunFlowState): LabRunView | null {
  if (state.run === null) return null;
  return { ...syntheticRunView(state.run), runNumber: state.runSeq + 1 };
}
