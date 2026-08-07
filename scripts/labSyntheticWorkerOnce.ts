/**
 * CLI de DESENVOLVIMENTO: roda o worker sintético de EXECUÇÃO ÚNICA uma vez
 * e imprime um resumo redigido.
 *
 *   npm run lab:synthetic:worker-once
 *   npm run lab:synthetic:worker-once -- --prisma
 *
 * Cria um run sintético fictício, chama `runSyntheticWorkerOnce` EXATAMENTE
 * uma vez (processa no máximo uma etapa) e encerra — sem `while`, sem
 * `setInterval`, sem polling, sem cron, sem retry automático.
 *
 * Store em memória por padrão. `--prisma` usa `PrismaSyntheticRunStore`
 * (precisa de `DATABASE_URL` válido) — ESCOLHA EXPLÍCITA, nunca fallback
 * silencioso: se `--prisma` for pedido e a conexão falhar, o comando
 * encerra com erro, não degrada para memória.
 *
 * Executor fictício embutido (sempre `SUCCESS`) — este comando demonstra o
 * WORKER (claim/versão/idempotência), não o adaptador Playwright, que já
 * tem seu próprio comando (`npm run lab:synthetic:playwright`).
 *
 * Não imprime `sessionHandle` nem valores de `.env`.
 */
import { createSyntheticRun, type SyntheticRunPlan } from "../src/server/automation/synthetic/syntheticRunCoordinator";
import { createSyntheticRunStore, type SyntheticRunStoreKind } from "../src/server/automation/synthetic/store/syntheticRunStoreFactory";
import { runSyntheticWorkerOnce, type SyntheticWorkerResult } from "../src/server/automation/synthetic/worker/syntheticSingleStepWorker";
import type { SyntheticSessionContract } from "../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const CLOCK = "2026-08-11T12:00:00.000Z";
const CLAIM_TTL_MS = 30_000;

/** Executor fictício: sempre confirma sucesso, sem tocar navegador nem rede. */
class AlwaysSucceedExecutor implements SyntheticStepExecutor {
  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    return { outcome: "SUCCESS", stepId: input.stepId, detail: "executor fictício do worker-once", capturedProtocol: null };
  }
}

function demoSession(): SyntheticSessionContract {
  return {
    sessionHandle: "sh_cli_worker_0001",
    processId: "proc-cli-worker-0001",
    actorId: "actor-cli-worker-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    issuedAt: "2026-08-11T11:00:00.000Z",
    expiresAt: "2026-08-11T23:59:59.000Z",
    environment: "synthetic",
    consentMarker: "consentimento-sintetico-cli-worker",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-cli-worker-0001",
    allowedSyntheticProcessCode: "PROT-FICT-CLIWORKER-0001",
  };
}

function demoPlan(): SyntheticRunPlan {
  return {
    planId: "plan-cli-worker-0001",
    version: "1.0.0",
    allowedSyntheticData: [],
    steps: [
      { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "página fictícia carregada" },
    ],
  };
}

function storeKindFromArgs(): SyntheticRunStoreKind {
  return process.argv.includes("--prisma") ? "prisma" : "memory";
}

function printSummary(kind: SyntheticRunStoreKind, result: SyntheticWorkerResult): void {
  console.log("");
  console.log(`=== Worker sintético (execução única, store: ${kind}) ===`);
  console.log(`resultado: ${result.outcome}`);
  console.log(`run: ${result.runId ?? "—"}`);
  console.log(`estado do run: ${result.run?.runState ?? "—"}`);
  console.log(`versão: ${result.run?.version ?? "—"}`);
  console.log(`fallback humano: ${result.run?.humanFallbackRequired ? "sim" : "não"}`);
  console.log(`protocolo fictício: ${result.run?.result?.syntheticProtocol ?? "—"}`);
  if (result.violations.length > 0) {
    console.log(`violações: ${result.violations.map((v) => v.code).join(", ")}`);
  }
  console.log("Execução local e sintética. Nenhum acesso a Gov.br/SINARM.");
}

/** Resultados que representam o worker funcionando como esperado — não uma falha técnica. */
const CONTROLLED_OUTCOMES = new Set<SyntheticWorkerResult["outcome"]>([
  "STEP_COMPLETED",
  "RUN_COMPLETED",
  "WAITING_HUMAN",
  "RUN_FAILED",
  "RUN_EXPIRED",
  "RUN_CANCELLED",
  "NO_RUN_AVAILABLE",
]);

async function main(): Promise<number> {
  const kind = storeKindFromArgs();
  const store = createSyntheticRunStore(kind);

  const created = createSyntheticRun({ runId: "run-cli-worker-0001", session: demoSession(), plan: demoPlan() });
  if (!created.ok) {
    console.error("Falha ao criar o run fictício:", created.violations.map((v) => v.code).join(", "));
    return 1;
  }
  const savedCreation = await store.create({ run: created.run, idempotencyKey: "idem-cli-worker-0001", at: CLOCK });
  if (!savedCreation.ok) {
    console.error("Falha ao gravar o run fictício:", savedCreation.violations.map((v) => v.code).join(", "));
    return 1;
  }

  const result = await runSyntheticWorkerOnce({
    store,
    executor: new AlwaysSucceedExecutor(),
    workerId: "worker-cli-0001",
    session: demoSession(),
    at: CLOCK,
    claimTtlMs: CLAIM_TTL_MS,
    idempotencyKey: "attempt-cli-worker-0001",
  });

  printSummary(kind, result);
  return CONTROLLED_OUTCOMES.has(result.outcome) ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Falha técnica no worker sintético:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
