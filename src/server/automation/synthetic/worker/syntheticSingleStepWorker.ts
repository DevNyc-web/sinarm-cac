/**
 * Worker sintético de EXECUÇÃO ÚNICA:
 *
 *   procurar um run elegível → reservar por claim → executar uma etapa →
 *   salvar resultado → concluir ou liberar o claim → encerrar
 *
 * Uma chamada processa NO MÁXIMO um run e uma etapa, depois RETORNA. Não é
 * um worker contínuo: sem `while (true)`, sem `setInterval`, sem polling,
 * sem cron, sem retry automático — quem quiser processar mais alguma coisa
 * chama `runSyntheticWorkerOnce` de novo.
 *
 * NÃO duplica lógica: "buscar" é `store.listRecoverable`; "reservar →
 * executar → salvar → concluir/liberar" é INTEIRAMENTE
 * `executeStoredSyntheticStep` (`syntheticStoredRunExecutor.ts`), chamado no
 * máximo uma vez. Este módulo só ESCOLHE o run (o primeiro elegível) e
 * TRADUZ o resultado para um vocabulário de saída mais rico — nenhuma regra
 * de claim, versão, idempotência ou lifecycle é reimplementada aqui.
 *
 * A sessão viva (com `sessionHandle`) é SEMPRE fornecida pelo chamador desta
 * função — nunca lida do store, nunca persistida. `SyntheticStepExecutor`
 * entra por injeção; este módulo não importa Playwright.
 *
 * LIMITE CONHECIDO (documentado, não corrigido aqui): `save()` (herdado do
 * PR anterior) confere `version`, não posse do claim — um claim que expira
 * NO MEIO da execução não impede o `save` de suceder se a versão ainda
 * bater. Fechar essa janela exigiria mudar o contrato do store, fora do
 * escopo deste PR (single-step, sem worker contínuo).
 */
import {
  executeStoredSyntheticStep,
  type ExecuteStoredSyntheticStepInput,
} from "../store/syntheticStoredRunExecutor";
import type { StoredSyntheticRun, SyntheticRunStore, SyntheticRunStoreViolation } from "../store/syntheticRunStore";
import type { SyntheticStepExecutor } from "../playwright/syntheticStepExecutor";

export const SYNTHETIC_WORKER_OUTCOMES = [
  /** Etapa concluída, o run continua (ainda há etapas pendentes). */
  "STEP_COMPLETED",
  /** Etapa concluída, e era a última — run chegou a `COMPLETED`. */
  "RUN_COMPLETED",
  /** Captcha sintético (ou outro bloqueio) — run em `WAITING_HUMAN`. */
  "WAITING_HUMAN",
  "RUN_FAILED",
  "RUN_EXPIRED",
  "RUN_CANCELLED",
  /** Nenhum run elegível — o executor nunca chegou a ser chamado. */
  "NO_RUN_AVAILABLE",
  "VERSION_CONFLICT",
  /** Claim já ativo (outro worker) — o executor nunca chegou a ser chamado. */
  "CLAIM_CONFLICT",
  /** `session` ausente — o executor nunca chegou a ser chamado. */
  "SESSION_REQUIRED",
  "SESSION_MISMATCH",
  /** Qualquer outra rejeição tipada do executor/coordenador (ex.: sessão inválida). */
  "EXECUTION_REJECTED",
] as const;

export type SyntheticWorkerOutcome = (typeof SYNTHETIC_WORKER_OUTCOMES)[number];

export interface RunSyntheticWorkerOnceInput {
  store: SyntheticRunStore;
  executor: SyntheticStepExecutor;
  workerId: string;
  /** Sessão sintética VIVA (com handle) — nunca lida do store, nunca persistida. */
  session: unknown;
  /** Relógio injetado — nunca `Date.now()`. */
  at: string;
  /** Duração do claim. Sem renovação automática — ver limite conhecido no topo do arquivo. */
  claimTtlMs: number;
  /** Chave de idempotência da ETAPA — repetir a mesma nunca duplica evento/evidência/protocolo. */
  idempotencyKey: string;
  reason?: string;
}

export interface SyntheticWorkerResult {
  outcome: SyntheticWorkerOutcome;
  runId: string | null;
  /** `null` só quando nada chegou a ser tocado (`NO_RUN_AVAILABLE`/`SESSION_REQUIRED`). */
  run: StoredSyntheticRun | null;
  violations: readonly SyntheticRunStoreViolation[];
}

function successOutcome(runState: StoredSyntheticRun["runState"]): SyntheticWorkerOutcome {
  switch (runState) {
    case "COMPLETED":
      return "RUN_COMPLETED";
    case "WAITING_HUMAN":
      return "WAITING_HUMAN";
    case "FAILED":
      return "RUN_FAILED";
    case "EXPIRED":
      return "RUN_EXPIRED";
    case "CANCELLED":
      return "RUN_CANCELLED";
    default:
      return "STEP_COMPLETED";
  }
}

function failureOutcome(violations: readonly SyntheticRunStoreViolation[]): SyntheticWorkerOutcome {
  const code = violations[0]?.code;
  switch (code) {
    case "RUN_NOT_FOUND":
      // O candidato escolhido sumiu entre a busca e a reserva — não há mais o que processar.
      return "NO_RUN_AVAILABLE";
    case "CLAIM_ALREADY_ACTIVE":
      return "CLAIM_CONFLICT";
    case "VERSION_CONFLICT":
      return "VERSION_CONFLICT";
    case "SESSION_MISMATCH":
      return "SESSION_MISMATCH";
    case "RUN_TERMINAL":
      // `listRecoverable` já filtra terminal; só ocorre numa corrida (outro
      // worker concluiu entre a busca e a reserva) — o efeito é o mesmo de
      // não haver run elegível.
      return "NO_RUN_AVAILABLE";
    case "RUN_WAITING_HUMAN":
      return "WAITING_HUMAN";
    default:
      return "EXECUTION_REJECTED";
  }
}

/**
 * Processa NO MÁXIMO um run e uma etapa, depois retorna. Não chama a si
 * mesma, não agenda nova chamada, não faz retry.
 */
export async function runSyntheticWorkerOnce(input: RunSyntheticWorkerOnceInput): Promise<SyntheticWorkerResult> {
  const { store, executor, workerId, session, at, claimTtlMs, idempotencyKey, reason } = input;

  if (session === undefined || session === null) {
    return {
      outcome: "SESSION_REQUIRED",
      runId: null,
      run: null,
      violations: [{ code: "MISSING_FIELD", field: "session", detail: "sessão sintética viva é obrigatória" }],
    };
  }

  // 1. buscar — o primeiro run elegível, e só ele; nenhuma segunda tentativa
  // com outro candidato se este falhar.
  const candidates = await store.listRecoverable({ at });
  const candidate = candidates[0];
  if (candidate === undefined) {
    return { outcome: "NO_RUN_AVAILABLE", runId: null, run: null, violations: [] };
  }

  // 2-5. reservar → executar UMA etapa → salvar → concluir/liberar — tudo
  // dentro do serviço já existente, chamado exatamente uma vez.
  const executeInput: ExecuteStoredSyntheticStepInput = {
    store,
    runId: candidate.runId,
    workerId,
    session,
    executor,
    at,
    ttlMs: claimTtlMs,
    idempotencyKey,
    reason,
  };
  const executed = await executeStoredSyntheticStep(executeInput);

  if (!executed.ok) {
    return { outcome: failureOutcome(executed.violations), runId: candidate.runId, run: executed.run, violations: executed.violations };
  }
  return { outcome: successOutcome(executed.run.runState), runId: candidate.runId, run: executed.run, violations: [] };
}
