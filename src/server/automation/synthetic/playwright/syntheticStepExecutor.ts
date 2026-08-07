/**
 * Contrato PEQUENO e tipado para executar uma etapa sintética contra um alvo
 * real (o portal fictício, via Playwright). NÃO importa Playwright nem nada
 * assíncrono do adaptador — só o tipo da fronteira, para que
 * `syntheticRunCoordinator.ts` continue puro e nunca precise saber que
 * Playwright existe.
 *
 * A entrada é fechada de propósito: nada além de `runId`, `stepId`, o tipo da
 * etapa, o relógio injetado e o código de processo fictício necessário para
 * `CONFIRM_RESULT` validar o protocolo. Sem `sessionHandle`, credencial, CPF,
 * senha, cookie, token, storage state ou payload arbitrário.
 */
import type { SyntheticRunStepType } from "../syntheticRunCoordinator";

export interface SyntheticStepExecutionInput {
  runId: string;
  stepId: string;
  type: SyntheticRunStepType;
  /** Relógio sintético injetado — nunca `Date.now()` dentro do executor. */
  at: string;
  /** Único identificador fictício necessário: valida o protocolo em `CONFIRM_RESULT`. */
  allowedSyntheticProcessCode: string;
}

/**
 * Resultado fechado de UMA execução. `CAPTCHA_DETECTED`/`TIMEOUT`/
 * `PAGE_MISMATCH`/`STEP_UNAVAILABLE`/`LOCAL_NAVIGATION_BLOCKED` mapeiam para
 * falhas sintéticas já existentes — o runner que faz essa tradução, não o
 * executor.
 */
export const SYNTHETIC_STEP_EXECUTION_OUTCOMES = [
  "SUCCESS",
  "CAPTCHA_DETECTED",
  "TIMEOUT",
  "PAGE_MISMATCH",
  "STEP_UNAVAILABLE",
  "LOCAL_NAVIGATION_BLOCKED",
] as const;

export type SyntheticStepExecutionOutcome = (typeof SYNTHETIC_STEP_EXECUTION_OUTCOMES)[number];

/**
 * Saída fechada. `detail` é sempre um rótulo curto e fixo — nunca a mensagem
 * bruta de um erro do Playwright (stack, seletor, HTML). `capturedProtocol` só
 * é preenchido quando `outcome === "SUCCESS"` na etapa `CONFIRM_RESULT` E o
 * texto capturado já começa com `PROT-FICT-`.
 */
export interface SyntheticStepExecutionResult {
  outcome: SyntheticStepExecutionOutcome;
  stepId: string;
  detail: string;
  capturedProtocol: string | null;
}

/** Implementado pelo adaptador local (Playwright); o coordenador nunca depende disso diretamente. */
export interface SyntheticStepExecutor {
  execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult>;
}
