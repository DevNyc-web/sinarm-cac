/**
 * Fase 2 — fluxo do LABORATORIO de login e handoff sinteticos (docs/72 §7.1/§7.2).
 *
 * Primeiro consumidor do lifecycle. Guarda o que a TELA precisa (sessao atual,
 * eventos acumulados, violacoes da ultima acao) e delega TODA regra de maquina
 * de estados para `sessionLifecycle.ts` — aqui nao existe transicao propria,
 * lista paralela de estados nem evento montado a mao.
 *
 * Modulo PURO: sem I/O, sem rede, sem Prisma, sem Fase 9, sem persistencia. O
 * estado vive em memoria e some quando a pagina recarrega — de proposito.
 *
 * DETERMINISTICO: o laboratorio tem RELOGIO SINTETICO proprio (`LAB_ISSUED_AT` +
 * incrementos fixos). Nenhum `Date.now()`: a mesma sequencia de acoes produz
 * sempre os mesmos eventos, com os mesmos instantes.
 *
 * O `sessionHandle` NUNCA sai daqui para a tela: `labSessionView` monta o que
 * pode ser exibido, e o handle nao esta entre os campos (docs/73 §3.1).
 */
import { describeSyntheticState, getAllowedSyntheticTransitions } from "./sessionState";
import {
  applySyntheticTransition,
  createSyntheticSession,
  recordSyntheticStep,
  type SyntheticFailureKind,
  type SyntheticLabEvent,
  type SyntheticLifecycleResult,
  type SyntheticLifecycleViolation,
} from "./sessionLifecycle";
import type { SyntheticHandoffState, SyntheticSessionContract } from "./sessionContract";

// ------------------------------------------------------------------- fixture

/** Aviso obrigatorio: nenhuma tela deste fluxo pode passar por execucao real. */
export const LAB_SYNTHETIC_NOTICE =
  "Ambiente sintético. Dados fictícios, execução local. Não acessa Gov.br, SINARM " +
  "nem Polícia Federal, e nenhum processo real é protocolado.";

const LAB_ISSUED_AT = "2026-08-06T10:00:00.000Z";
const LAB_EXPIRES_AT = "2026-08-06T10:10:00.000Z";

/** Instante usado para expirar o handle: alcanca `expiresAt` (docs/74 §4). */
const LAB_EXPIRED_AT = LAB_EXPIRES_AT;

/** Cada acao avanca 1 minuto no relogio sintetico. */
const LAB_TICK_MS = 60_000;

/**
 * Teto do relogio comum: 8 minutos apos a emissao, dois minutos antes do
 * `expiresAt`. Sem o teto, uma sequencia longa de acoes venceria o handle por
 * acidente e o laboratorio pareceria quebrado quando so tinha andado demais.
 */
const LAB_MAX_TICKS = 8;

/** Nome da primeira etapa — entra JUNTO com a entrada em `IN_PROGRESS`. */
export const LAB_FIRST_STEP = "abrir formulário sintético";

/** Etapas seguintes, ciclicas, para o operador produzir mais de um evento. */
const LAB_NEXT_STEPS: readonly string[] = [
  "informar destino fictício",
  "selecionar acervo fictício",
  "revisar dados sintéticos",
];

/** Protocolo aceito no fechamento — so o sintetico (docs/74 §13.2). */
const LAB_PROTOCOL = "PROT-FICT-0001";

/**
 * Sessao sintetica inicial. Todos os valores sao ficticios e cabem na lista
 * fechada de 11 campos do `docs/73 §3` — nao ha campo de credencial porque o
 * contrato nao tem onde poe-lo.
 */
function labSessionFixture(): SyntheticSessionContract {
  return {
    sessionHandle: "sh_lab_sintetico_0001",
    processId: "proc-lab-0001",
    actorId: "operador-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: LAB_EXPIRES_AT,
    issuedAt: LAB_ISSUED_AT,
    environment: "synthetic",
    consentMarker: "consentimento-sintetico-lab",
    handoffState: "CREATED",
    auditCorrelationId: "corr-lab-0001",
    allowedSyntheticProcessCode: LAB_PROTOCOL,
  };
}

// --------------------------------------------------------------------- acoes

/**
 * As acoes que a tela oferece.
 *
 * O mapeamento com a maquina de estados e explicito de proposito:
 * - `login` — o portal sintetico emite o handle -> sessao nasce em `CREATED`;
 * - `handoff` — o motor reivindica o handle -> `CREATED -> CLAIMED`;
 * - `confirm-handoff` — o motor assume e comeca a executar ->
 *   `CLAIMED -> IN_PROGRESS`, com a PRIMEIRA ETAPA na mesma operacao.
 */
export type LabAction =
  | { kind: "login" }
  | { kind: "handoff" }
  | { kind: "confirm-handoff" }
  | { kind: "next-step" }
  | { kind: "complete" }
  | { kind: "expire" }
  | { kind: "fail"; failure: SyntheticFailureKind }
  | { kind: "reset" };

export type LabActionKind = LabAction["kind"];

export interface LabFlowState {
  session: SyntheticSessionContract | null;
  /** Trilha acumulada, na ordem em que os eventos foram emitidos. */
  events: readonly SyntheticLabEvent[];
  /** Violacoes da ULTIMA acao. Acao bem-sucedida limpa a lista. */
  violations: readonly SyntheticLifecycleViolation[];
  /** Quantas etapas seguintes ja foram registradas (escolhe o proximo nome). */
  stepCount: number;
  /** Quantas acoes ja rodaram — base do relogio sintetico. */
  ticks: number;
}

export function initialLabFlowState(): LabFlowState {
  return { session: null, events: [], violations: [], stepCount: 0, ticks: 0 };
}

/** Instante sintetico da proxima acao. Nunca alcanca `expiresAt` sozinho. */
function clockAt(ticks: number): string {
  const offset = Math.min(ticks, LAB_MAX_TICKS) * LAB_TICK_MS;
  return new Date(Date.parse(LAB_ISSUED_AT) + offset).toISOString();
}

/** Nome da proxima etapa seguinte, ciclico para nao acabar. */
function nextStepName(stepCount: number): string {
  return LAB_NEXT_STEPS[stepCount % LAB_NEXT_STEPS.length] ?? LAB_FIRST_STEP;
}

/**
 * Executa uma acao do laboratorio.
 *
 * Acao recusada NAO altera a sessao e NAO acrescenta evento — so preenche
 * `violations`. E o mesmo contrato do lifecycle, propagado para a tela.
 */
export function applyLabAction(state: LabFlowState, action: LabAction): LabFlowState {
  if (action.kind === "reset") return initialLabFlowState();

  // `clockAt(ticks)`, nao `ticks + 1`: o login usa o proprio `issuedAt`, que e
  // `clockAt(0)`. Adiantar aqui abriria um buraco de um minuto na trilha.
  const at = clockAt(state.ticks);

  if (action.kind === "login") {
    return absorb(
      state,
      createSyntheticSession(labSessionFixture(), "login sintético do laboratório"),
    );
  }

  // Toda acao daqui para baixo exige uma sessao ja criada.
  if (state.session === null) {
    return {
      ...state,
      violations: [
        {
          code: "INVALID_STATE",
          field: "session",
          detail: "nenhuma sessão sintética: simule o login primeiro",
        },
      ],
    };
  }

  const session = state.session;

  switch (action.kind) {
    case "handoff":
      return absorb(
        state,
        applySyntheticTransition({
          session,
          to: "CLAIMED",
          at,
          reason: "handoff sintético: motor reivindicou o handle",
        }),
      );

    case "confirm-handoff":
      // Transicao e primeira etapa na MESMA operacao: um unico step_started.
      return absorb(
        state,
        applySyntheticTransition({
          session,
          to: "IN_PROGRESS",
          at,
          step: LAB_FIRST_STEP,
          reason: "handoff sintético recebido pelo motor",
        }),
      );

    case "next-step": {
      const result = recordSyntheticStep({
        session,
        step: nextStepName(state.stepCount),
        phase: "COMPLETED",
        at,
      });
      const next = absorb(state, result);
      return result.ok ? { ...next, stepCount: state.stepCount + 1 } : next;
    }

    case "complete":
      return absorb(
        state,
        applySyntheticTransition({
          session,
          to: "COMPLETED",
          at,
          syntheticProtocol: LAB_PROTOCOL,
          reason: "jornada sintética concluída",
        }),
      );

    case "expire":
      return absorb(
        state,
        applySyntheticTransition({
          session,
          to: "EXPIRED",
          at: LAB_EXPIRED_AT,
          reason: "prazo do handle sintético alcançado",
        }),
      );

    case "fail":
      return absorb(
        state,
        applySyntheticTransition({
          session,
          to: action.failure === "HANDLE_EXPIRED" ? "EXPIRED" : "FAILED",
          at: action.failure === "HANDLE_EXPIRED" ? LAB_EXPIRED_AT : at,
          failure: action.failure,
          reason: `falha sintética selecionada: ${action.failure}`,
        }),
      );
  }
}

/** Incorpora o resultado do lifecycle ao estado do laboratorio. */
function absorb(state: LabFlowState, result: SyntheticLifecycleResult): LabFlowState {
  if (!result.ok) {
    return { ...state, violations: result.violations };
  }
  return {
    ...state,
    session: result.session,
    events: [...state.events, ...result.events],
    violations: [],
    ticks: state.ticks + 1,
  };
}

// -------------------------------------------------------------------- view

/**
 * O que a tela pode mostrar.
 *
 * `sessionHandle` NAO esta aqui, e e por isso que a tela nao consegue exibi-lo
 * nem por engano (docs/73 §3.1).
 */
export interface LabSessionView {
  state: SyntheticHandoffState;
  description: string;
  allowedTransitions: readonly SyntheticHandoffState[];
  processId: string;
  processCode: string;
  environment: string;
  issuedAt: string;
  expiresAt: string;
  correlationId: string;
}

export function labSessionView(state: LabFlowState): LabSessionView | null {
  const session = state.session;
  if (session === null) return null;

  return {
    state: session.handoffState,
    description: describeSyntheticState(session.handoffState),
    allowedTransitions: getAllowedSyntheticTransitions(session.handoffState),
    processId: session.processId,
    processCode: session.allowedSyntheticProcessCode,
    environment: session.environment,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    correlationId: session.auditCorrelationId,
  };
}
