/**
 * Fase 2 — consultas puras sobre a maquina de estados sintetica (docs/74).
 *
 * Camada de CONSULTA/APRESENTACAO, nao motor. Responde "o que posso fazer a
 * partir daqui?" e "como se chama este estado?". Quem APLICA transicao, emite
 * evento e valida sessao e o `sessionLifecycle.ts`.
 *
 * Este modulo NAO: aplica transicao, emite evento, valida contrato de sessao,
 * lanca erro em fluxo normal, guarda estado mutavel nem duplica a tabela de
 * transicoes. A fonte de verdade continua sendo o `sessionContract.ts` — daqui
 * so saem leituras dela.
 *
 * Modulo PURO e DETERMINISTICO: sem I/O, sem rede, sem Prisma, sem Fase 9,
 * sem `Date.now()`, `Math.random()` ou leitura de ambiente.
 */
import {
  SYNTHETIC_TRANSITIONS,
  isSyntheticHandoffState,
  type SyntheticHandoffState,
} from "./sessionContract";

/**
 * Descricoes curtas e estaveis dos 8 estados (docs/74 §4).
 *
 * O `Record<SyntheticHandoffState, string>` e o que garante a exaustividade em
 * TEMPO DE COMPILACAO: acrescentar um nono estado ao contrato quebra o build
 * aqui, em vez de virar descricao faltando em runtime.
 */
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

/**
 * Transicoes permitidas a partir de `state` (docs/74 §7). Estado desconhecido
 * devolve lista vazia — consulta nao e lugar de lancar.
 *
 * Devolve CÓPIA, nunca a referencia viva de `SYNTHETIC_TRANSITIONS[state]`:
 * `readonly` e garantia de tipo, nao de runtime, e um consumidor JavaScript com
 * um `push` corromperia a tabela de transicoes do processo inteiro.
 */
export function getAllowedSyntheticTransitions(state: string): readonly SyntheticHandoffState[] {
  return isSyntheticHandoffState(state) ? [...SYNTHETIC_TRANSITIONS[state]] : [];
}

/**
 * Rotulo curto e estavel do estado.
 *
 * O parametro e TIPADO (`SyntheticHandoffState`, nao `string`) de proposito:
 * estado invalido e barrado pelo compilador, e nao existe fallback silencioso
 * inventando descricao para o que a maquina nao conhece.
 */
export function describeSyntheticState(state: SyntheticHandoffState): string {
  return `${state} — ${STATE_DESCRIPTIONS[state]}`;
}
