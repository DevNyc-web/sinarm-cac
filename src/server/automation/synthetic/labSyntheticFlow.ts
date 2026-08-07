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
import {
  isSyntheticTerminalState,
  type SyntheticHandoffState,
  type SyntheticSessionContract,
} from "./sessionContract";

// ------------------------------------------------------------------- fixture

/** Aviso obrigatorio: nenhuma tela deste fluxo pode passar por execucao real. */
export const LAB_SYNTHETIC_NOTICE =
  "Ambiente sintético. Dados fictícios, execução local. Não acessa Gov.br, SINARM " +
  "nem Polícia Federal, e nenhum processo real é protocolado.";

const LAB_ISSUED_AT = "2026-08-06T10:00:00.000Z";

/** Cada acao avanca 1 minuto no relogio sintetico. */
const LAB_TICK_MS = 60_000;

/** Prazo curto do handle sintetico: 10 minutos (docs/73 §3, "curto"). */
const LAB_TTL_MS = 10 * LAB_TICK_MS;

/**
 * Distancia entre sessoes sinteticas sucessivas. Cada nova sessao nasce uma
 * hora depois da anterior — assim `issuedAt`, `expiresAt` e a ordem dos eventos
 * nunca se cruzam entre sessoes, e a trilha continua legivel de cima a baixo.
 */
const LAB_SESSION_SPAN_MS = 60 * LAB_TICK_MS;

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

/**
 * Motivo sintetico do bloqueio por captcha.
 *
 * O laboratorio existe para provar que a automacao PARA diante de captcha. Nao
 * ha — e nao pode haver — acao de resolver, pular ou contornar: `BLOCKED` so
 * sai para `CANCELLED`, `FAILED` ou `EXPIRED` (docs/74 §8.5/§8.6, §10.2/§10.3).
 */
export const LAB_CAPTCHA_REASON =
  "captcha sintético apresentado: a automação para e devolve o controle ao humano";

/** Texto de fallback humano mostrado quando a sessao esta bloqueada. */
export const LAB_HUMAN_FALLBACK_NOTICE =
  "Bloqueio por captcha sintético. A automação não resolve nem contorna captcha: " +
  "o desfecho é humano — encerrar a sessão, registrar falha do cenário ou deixar o prazo vencer.";

/** Sufixo estavel de cada sessao sintetica: 0001, 0002, ... */
function seqLabel(seq: number): string {
  return String(seq + 1).padStart(4, "0");
}

function issuedAtFor(seq: number): string {
  return new Date(Date.parse(LAB_ISSUED_AT) + seq * LAB_SESSION_SPAN_MS).toISOString();
}

function expiresAtFor(seq: number): string {
  return new Date(Date.parse(issuedAtFor(seq)) + LAB_TTL_MS).toISOString();
}

/**
 * Sessao sintetica de indice `seq`. Todos os valores sao ficticios e cabem na
 * lista fechada de 11 campos do `docs/73 §3` — nao ha campo de credencial
 * porque o contrato nao tem onde poe-lo.
 *
 * Cada sessao nova recebe **handle, correlacao, processo e `issuedAt`
 * proprios**: retentar exige NOVA sessao, e sessao nova que reaproveitasse o
 * handle antigo seria renovacao disfarcada (docs/74 §9.4).
 */
function labSessionFixture(seq: number): SyntheticSessionContract {
  const label = seqLabel(seq);
  return {
    sessionHandle: `sh_lab_sintetico_${label}`,
    processId: `proc-lab-${label}`,
    actorId: "operador-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: expiresAtFor(seq),
    issuedAt: issuedAtFor(seq),
    environment: "synthetic",
    consentMarker: "consentimento-sintetico-lab",
    handoffState: "CREATED",
    auditCorrelationId: `corr-lab-${label}`,
    allowedSyntheticProcessCode: `PROT-FICT-${label}`,
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
  | { kind: "timeout" }
  | { kind: "captcha" }
  | { kind: "cancel" }
  | { kind: "expire" }
  | { kind: "fail"; failure: SyntheticFailureKind }
  | { kind: "new-session" }
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
  /** Quantas acoes ja rodaram na sessao ATUAL — base do relogio sintetico. */
  ticks: number;
  /** Indice da sessao sintetica atual. Nova sessao incrementa; nunca reusa. */
  sessionSeq: number;
}

export function initialLabFlowState(): LabFlowState {
  return { session: null, events: [], violations: [], stepCount: 0, ticks: 0, sessionSeq: 0 };
}

/**
 * Instante sintetico da proxima acao, relativo a sessao atual. Com o teto, o
 * relogio comum nunca alcanca `expiresAt` — vencer o handle exige a acao
 * explicita de expirar.
 */
function clockAt(seq: number, ticks: number): string {
  const offset = Math.min(ticks, LAB_MAX_TICKS) * LAB_TICK_MS;
  return new Date(Date.parse(issuedAtFor(seq)) + offset).toISOString();
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

  // `clockAt(seq, ticks)`, nao `ticks + 1`: o login usa o proprio `issuedAt`,
  // que e `clockAt(seq, 0)`. Adiantar abriria um buraco de um minuto na trilha.
  const at = clockAt(state.sessionSeq, state.ticks);

  if (action.kind === "login") {
    if (state.session !== null) {
      return violation(state, "INVALID_STATE", "session", "já existe uma sessão sintética");
    }
    return startSession(state, state.sessionSeq, "login sintético do laboratório");
  }

  // Toda acao daqui para baixo exige uma sessao ja criada.
  if (state.session === null) {
    return violation(
      state,
      "INVALID_STATE",
      "session",
      "nenhuma sessão sintética: simule o login primeiro",
    );
  }

  const session = state.session;

  if (action.kind === "new-session") {
    // Terminal nao reabre; o que existe e comecar OUTRA sessao (docs/74 §9.4).
    if (!isSyntheticTerminalState(session.handoffState)) {
      return violation(
        state,
        "INVALID_STATE",
        "handoffState",
        `a sessão em ${session.handoffState} ainda não terminou: conclua, cancele ou deixe expirar antes de iniciar outra`,
      );
    }
    return startSession(state, state.sessionSeq + 1, "nova sessão sintética após término");
  }

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
          // O protocolo sintetico e o da propria sessao — nunca um numero solto.
          syntheticProtocol: session.allowedSyntheticProcessCode,
          reason: "jornada sintética concluída",
        }),
      );

    case "captcha":
      // Captcha BLOQUEIA. Nao existe acao de resolver, pular ou contornar.
      return absorb(
        state,
        applySyntheticTransition({
          session,
          to: "BLOCKED",
          at,
          reason: LAB_CAPTCHA_REASON,
        }),
      );

    case "cancel":
      return absorb(
        state,
        applySyntheticTransition({
          session,
          to: "CANCELLED",
          at,
          reason: "encerramento humano da sessão sintética",
        }),
      );

    case "timeout":
      // Timeout e falha sintetica do dominio (docs/74 §11.1) — nao um estado novo.
      return absorb(state, failWith(session, "TIMEOUT", at, state.sessionSeq));

    case "expire":
      return absorb(
        state,
        applySyntheticTransition({
          session,
          to: "EXPIRED",
          at: expiresAtFor(state.sessionSeq),
          reason: "prazo do handle sintético alcançado",
        }),
      );

    case "fail":
      return absorb(state, failWith(session, action.failure, at, state.sessionSeq));
  }
}

/**
 * Aplica uma falha sintetica ao estado que o docs/74 §11 manda — `FAILED` para
 * todas, menos `HANDLE_EXPIRED`, que termina em `EXPIRED` porque prazo nao e
 * defeito. O destino nao e decidido aqui: quem cobra a correspondencia e o
 * lifecycle (`FAILURE_KIND_MISMATCH`).
 */
function failWith(
  session: SyntheticSessionContract,
  failure: SyntheticFailureKind,
  at: string,
  seq: number,
): SyntheticLifecycleResult {
  const expired = failure === "HANDLE_EXPIRED";
  return applySyntheticTransition({
    session,
    to: expired ? "EXPIRED" : "FAILED",
    at: expired ? expiresAtFor(seq) : at,
    failure,
    reason: `falha sintética selecionada: ${failure}`,
  });
}

/** Cria a sessao sintetica `seq`, preservando a trilha ja acumulada. */
function startSession(state: LabFlowState, seq: number, reason: string): LabFlowState {
  const result = createSyntheticSession(labSessionFixture(seq), reason);
  if (!result.ok) return { ...state, violations: result.violations };

  return {
    session: result.session,
    events: [...state.events, ...result.events],
    violations: [],
    stepCount: 0,
    // A criacao ja consumiu o tick 0 (ela usa o proprio `issuedAt`); a proxima
    // acao e o tick 1. Zerar aqui colaria dois eventos no mesmo instante.
    ticks: 1,
    sessionSeq: seq,
  };
}

function violation(
  state: LabFlowState,
  code: SyntheticLifecycleViolation["code"],
  field: string,
  detail: string,
): LabFlowState {
  return { ...state, violations: [{ code, field, detail }] };
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
  /** Sessao terminal: nao reabre — o caminho e iniciar OUTRA sessao. */
  terminal: boolean;
  /** `BLOCKED`: a automacao parou e o desfecho e humano. */
  blocked: boolean;
  /** Preenchido so quando `blocked`; nunca sugere resolver o captcha. */
  humanFallbackNotice: string | null;
  /** Quantas sessoes sintéticas ja foram abertas nesta visita. */
  sessionNumber: number;
}

export function labSessionView(state: LabFlowState): LabSessionView | null {
  const session = state.session;
  if (session === null) return null;

  const blocked = session.handoffState === "BLOCKED";

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
    terminal: isSyntheticTerminalState(session.handoffState),
    blocked,
    humanFallbackNotice: blocked ? LAB_HUMAN_FALLBACK_NOTICE : null,
    sessionNumber: state.sessionSeq + 1,
  };
}
