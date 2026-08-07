/**
 * Runner LOCAL: liga o coordenador puro (`syntheticRunCoordinator.ts`) a um
 * `SyntheticStepExecutor` (o adaptador Playwright, ou um fake de teste).
 *
 * É a ÚNICA camada assíncrona: chama o executor, converte o resultado tipado
 * numa chamada ao coordenador puro, e devolve o novo run. Não guarda fila
 * paralela, não decide qual etapa roda (sempre a cabeça de `pendingSteps`, a
 * mesma regra do coordenador) e não pula nem repete etapa.
 *
 * Run terminal ou aguardando humano NUNCA chega a chamar o executor — a
 * checagem roda ANTES, delegando a rejeição para o próprio coordenador (que já
 * sabe produzir a violação certa), sem abrir navegador à toa.
 */
import {
  executeNextSyntheticStep,
  interruptSyntheticRun,
  isSyntheticRunTerminalState,
  type SyntheticAutomationRun,
  type SyntheticRunOperationResult,
} from "../syntheticRunCoordinator";
import type { SyntheticFailureKind } from "../sessionLifecycle";
import type { SyntheticStepExecutionOutcome, SyntheticStepExecutor } from "./syntheticStepExecutor";

export interface RunNextSyntheticStepLocallyInput {
  run: SyntheticAutomationRun;
  executor: SyntheticStepExecutor;
  /** Relógio sintético injetado — o runner nunca lê `Date.now()`. */
  at: string;
  reason?: string;
}

/** Falha sintética correspondente a cada desfecho do executor que não é sucesso nem captcha. */
const OUTCOME_TO_FAILURE: Readonly<
  Record<Exclude<SyntheticStepExecutionOutcome, "SUCCESS" | "CAPTCHA_DETECTED">, SyntheticFailureKind>
> = {
  TIMEOUT: "TIMEOUT",
  PAGE_MISMATCH: "INVALID_EVIDENCE",
  STEP_UNAVAILABLE: "STEP_UNAVAILABLE",
  LOCAL_NAVIGATION_BLOCKED: "EXTERNAL_URL",
};

/**
 * Executa a PRÓXIMA etapa do run contra o executor local, e converte o
 * resultado numa chamada ao coordenador puro. Uma etapa por chamada, sempre a
 * cabeça da fila — a mesma garantia estrutural do coordenador.
 */
export async function runNextSyntheticStepLocally(
  input: RunNextSyntheticStepLocallyInput,
): Promise<SyntheticRunOperationResult> {
  const { run, executor, at } = input;
  const reason = input.reason ?? "execução local via Playwright";

  const nextStep = run.pendingSteps[0];
  const cannotProceed = isSyntheticRunTerminalState(run.state) || run.state === "WAITING_HUMAN" || nextStep === undefined;
  if (cannotProceed) {
    // O próprio coordenador puro produz a violação certa — sem tocar o Playwright.
    return executeNextSyntheticStep({ run, at, reason });
  }

  const execution = await executor.execute({
    runId: run.runId,
    stepId: nextStep.stepId,
    type: nextStep.type,
    at,
    allowedSyntheticProcessCode: run.session.allowedSyntheticProcessCode,
  });

  if (execution.outcome === "SUCCESS") {
    return executeNextSyntheticStep({ run, at, reason: execution.detail });
  }
  if (execution.outcome === "CAPTCHA_DETECTED") {
    return interruptSyntheticRun({ run, at, reason: execution.detail, cause: { kind: "CAPTCHA" } });
  }
  return interruptSyntheticRun({
    run,
    at,
    reason: execution.detail,
    cause: { kind: "FAILURE", failure: OUTCOME_TO_FAILURE[execution.outcome] },
  });
}
