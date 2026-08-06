/**
 * Fase 2 — helpers puros sobre a máquina de estados sintética (docs/74).
 *
 * Módulo PURO: nenhum I/O, nenhuma rede, nenhum Prisma, nenhuma Fase 9. Usa
 * apenas os tipos, constantes e funções já validados em `sessionContract.ts`
 * (docs/73/docs/74) — não redefine os 8 estados nem as 14 transições.
 *
 * DETERMINÍSTICO: nenhum `Date.now()`, `Math.random()`, `new Date()` ou
 * leitura de `process.env`.
 */
import {
  SYNTHETIC_TRANSITIONS,
  canTransition,
  isSyntheticHandoffState,
  isSyntheticTerminalState,
  type SyntheticHandoffState,
} from "./sessionContract";

/** Reexportado, não duplicado: os 4 terminais continuam definidos só em `sessionContract.ts`. */
export { isSyntheticTerminalState };

/** Descrições estáveis por estado (docs/74 §4) — nunca ecoam dado do chamador. */
const STATE_DESCRIPTIONS: Readonly<Record<SyntheticHandoffState, string>> = {
  CREATED: "handle sintético emitido; sessão ainda não reivindicada",
  CLAIMED: "motor sintético reivindicou o handle",
  IN_PROGRESS: "motor sintético executando etapas do laboratório",
  COMPLETED: "jornada sintética concluída",
  EXPIRED: "prazo da sessão sintética expirado",
  CANCELLED: "sessão sintética cancelada deliberadamente",
  BLOCKED: "sessão sintética bloqueada por captcha sintético",
  FAILED: "sessão sintética falhou",
};

/** Transições permitidas a partir de `state` (docs/74 §7). Vazio para estado desconhecido. */
export function getAllowedSyntheticTransitions(state: string): readonly SyntheticHandoffState[] {
  return isSyntheticHandoffState(state) ? SYNTHETIC_TRANSITIONS[state] : [];
}

/** `true` se `from -> to` está na allow-list do docs/74 §7. */
export function canMoveSyntheticSession(from: string, to: string): boolean {
  return canTransition(from, to);
}

/** `true` apenas para `BLOCKED` (docs/74 §14.1 — não terminal, sem saída para frente). */
export function isSyntheticBlockedState(state: string): boolean {
  return state === "BLOCKED";
}

/** Texto estável por estado, sem dado sensível — só o próprio nome do estado é ecoado. */
export function describeSyntheticState(state: string): string {
  if (!isSyntheticHandoffState(state)) return `estado sintético desconhecido: ${state}`;
  return `${state} — ${STATE_DESCRIPTIONS[state]}`;
}

/** Mensagem estável explicando por que `from -> to` é inválida (docs/74 §7/§8). */
export function describeSyntheticTransitionError(from: string, to: string): string {
  const label = `${from} -> ${to}`;
  if (!isSyntheticHandoffState(from)) return `estado de origem desconhecido: ${label}`;
  if (!isSyntheticHandoffState(to)) return `estado de destino desconhecido: ${label}`;
  if (canTransition(from, to)) return `transição permitida: ${label}`;
  if (isSyntheticTerminalState(from)) return `estado terminal não reabre: ${label}`;
  return `transição não permitida: ${label}`;
}

/** Lança se `from -> to` não estiver na allow-list. Mensagem sem dado sensível. */
export function assertSyntheticTransition(from: string, to: string): void {
  if (canTransition(from, to)) return;
  throw new Error(describeSyntheticTransitionError(from, to));
}
