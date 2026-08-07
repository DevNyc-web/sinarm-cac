/**
 * Serviço de aplicação: liga `store → claim → carregar run → executar UMA
 * etapa com o runner existente → salvar com `expectedVersion` → concluir ou
 * liberar claim`.
 *
 * Não importa Playwright: recebe `SyntheticStepExecutor` por injeção (o
 * mesmo contrato que `localSyntheticRunner.ts` já usa) e delega toda
 * transição de sessão/fila para `runNextSyntheticStepLocally`. Nenhuma
 * lógica de máquina de estados é reimplementada aqui.
 *
 * A SESSÃO VIVA (com `sessionHandle`) nunca vem do store — quem chama este
 * serviço fornece a sessão de novo, na hora, a cada chamada. O store só
 * guarda a projeção segura (`StoredSyntheticRun`); reconstituir o run
 * operável é responsabilidade DESTE módulo, e só dele.
 *
 * Idempotência de ETAPA: a chave é conferida DUAS vezes — aqui, ANTES de
 * reservar (`stored.lastStepIdempotencyKey`), para que repetir a chave depois
 * de um run já concluído devolva o resultado sem tentar reservar um run
 * terminal; e de novo dentro de `store.save()`, como segunda trava. Nenhuma
 * repetição chama o executor Playwright nem duplica evento, evidência, etapa
 * concluída ou protocolo.
 */
import type { SyntheticAutomationRun } from "../syntheticRunCoordinator";
import { validateSyntheticSessionContract } from "../sessionContract";
import { runNextSyntheticStepLocally } from "../playwright/localSyntheticRunner";
import type { SyntheticStepExecutor } from "../playwright/syntheticStepExecutor";
import type { StoredSyntheticRun, SyntheticRunStore, SyntheticRunStoreViolation } from "./syntheticRunStore";

export interface ExecuteStoredSyntheticStepInput {
  store: SyntheticRunStore;
  runId: string;
  workerId: string;
  /** Sessão VIVA e completa (com handle) — validada aqui, nunca lida do store. */
  session: unknown;
  executor: SyntheticStepExecutor;
  at: string;
  ttlMs: number;
  /** Idempotência de ETAPA: mesma chave numa repetição não duplica evento/evidência/etapa/protocolo. */
  idempotencyKey: string;
  reason?: string;
}

export type ExecuteStoredSyntheticStepResult =
  | { ok: true; run: StoredSyntheticRun; violations: readonly [] }
  | { ok: false; run: StoredSyntheticRun | null; violations: readonly SyntheticRunStoreViolation[] };

/**
 * Reconstrói o `SyntheticAutomationRun` operável a partir do registro seguro
 * + da sessão viva fornecida. Confere que a sessão bate com o registro pelo
 * `auditCorrelationId` — ninguém pode "sequestrar" um run com sessão alheia.
 */
function rebuildAutomationRun(
  stored: StoredSyntheticRun,
  sessionInput: unknown,
): { ok: true; run: SyntheticAutomationRun } | { ok: false; violations: readonly SyntheticRunStoreViolation[] } {
  const validation = validateSyntheticSessionContract(sessionInput);
  if (!validation.ok) return { ok: false, violations: validation.violations };

  const session = validation.contract;
  if (session.auditCorrelationId !== stored.auditCorrelationId) {
    return {
      ok: false,
      violations: [{ code: "SESSION_MISMATCH", field: "session", detail: "sessão fornecida não corresponde ao run armazenado" }],
    };
  }

  return {
    ok: true,
    run: {
      runId: stored.runId,
      session,
      plan: stored.plan,
      pendingSteps: stored.pendingSteps,
      currentStep: stored.pendingSteps[0] ?? null,
      completedSteps: stored.completedSteps,
      state: stored.runState,
      events: stored.events,
      evidence: stored.evidence,
      humanFallbackRequired: stored.humanFallbackRequired,
      result: stored.result,
    },
  };
}

/**
 * Executa UMA etapa de um run armazenado, de ponta a ponta:
 * claim → carregar → reconstruir → executar → salvar → concluir/liberar claim.
 */
export async function executeStoredSyntheticStep(
  input: ExecuteStoredSyntheticStepInput,
): Promise<ExecuteStoredSyntheticStepResult> {
  const { store, runId, workerId, at, ttlMs, idempotencyKey } = input;

  if (idempotencyKey.trim() === "") {
    return { ok: false, run: null, violations: [{ code: "EMPTY_VALUE", field: "idempotencyKey", detail: "chave de idempotência vazia" }] };
  }

  // Replay idempotente ANTES de reservar: nem chama claimNext, nem toca o
  // executor. Sem isso, repetir a chave depois da ÚLTIMA etapa (run já
  // COMPLETED) seria recusado por RUN_TERMINAL em vez de devolver o resultado.
  const beforeClaim = await store.getById(runId);
  if (beforeClaim !== null && beforeClaim.lastStepIdempotencyKey === idempotencyKey) {
    return { ok: true, run: beforeClaim, violations: [] };
  }

  // 1. obter claim
  const claimResult = await store.claimNext({ runId, workerId, at, ttlMs });
  if (!claimResult.ok) {
    return { ok: false, run: await store.getById(runId), violations: claimResult.violations };
  }

  // 2. carregar registro
  const stored = await store.getById(runId);
  if (stored === null) {
    await store.releaseClaim({ runId, claimId: claimResult.claim.claimId, workerId });
    return { ok: false, run: null, violations: [{ code: "RUN_NOT_FOUND", field: "runId", detail: `run ${runId} não encontrado` }] };
  }

  // 3. reconstruir a projeção necessária (sessão viva + registro seguro)
  const rebuilt = rebuildAutomationRun(stored, input.session);
  if (!rebuilt.ok) {
    await store.releaseClaim({ runId, claimId: claimResult.claim.claimId, workerId });
    return { ok: false, run: stored, violations: rebuilt.violations };
  }

  // 4. executar uma única etapa
  const executed = await runNextSyntheticStepLocally({
    run: rebuilt.run,
    executor: input.executor,
    at,
    reason: input.reason,
  });
  if (!executed.ok) {
    await store.releaseClaim({ runId, claimId: claimResult.claim.claimId, workerId });
    return { ok: false, run: stored, violations: executed.violations };
  }

  // 5. salvar com expectedVersion (o `save` também resolve idempotência de etapa)
  const saved = await store.save({ runId, expectedVersion: stored.version, run: executed.run, at, idempotencyKey });
  if (!saved.ok) {
    // Conflito de versão (ou outro): NÃO reexecuta a etapa — só libera o
    // claim e devolve o conflito tipado, preservando o que já foi salvo.
    await store.releaseClaim({ runId, claimId: claimResult.claim.claimId, workerId });
    return { ok: false, run: saved.run, violations: saved.violations };
  }

  // 6. concluir claim
  await store.completeClaim({ runId, claimId: claimResult.claim.claimId, workerId });

  // 7. devolver resultado tipado — relido depois do completeClaim: `saved.run`
  // ainda carregaria o claim que acabou de ser liberado.
  const final = await store.getById(runId);
  return { ok: true, run: final ?? saved.run, violations: [] };
}
