/**
 * CLI de DESENVOLVIMENTO: roda um lote sintético PEQUENO e LIMITADO — 3 runs,
 * concorrência 2 — e imprime um resumo redigido. Termina sozinho: sem
 * `while`, sem `setInterval`, sem polling, sem cron.
 *
 *   npm run lab:synthetic:dispatch-batch
 *   npm run lab:synthetic:dispatch-batch -- --prisma
 *
 * Store em memória por padrão. `--prisma` usa `PrismaSyntheticRunStore`
 * (precisa de `DATABASE_URL` válido) — ESCOLHA EXPLÍCITA, nunca fallback
 * silencioso: se a conexão falhar, o comando encerra com erro.
 *
 * Executor fictício embutido (sempre `SUCCESS`) — este comando demonstra o
 * DESPACHANTE (seleção, concorrência, limites), não o adaptador Playwright.
 *
 * Não imprime `sessionHandle` nem valores de `.env`.
 */
import { createSyntheticRun, type SyntheticRunPlan } from "../src/server/automation/synthetic/syntheticRunCoordinator";
import { createSyntheticRunStore, type SyntheticRunStoreKind } from "../src/server/automation/synthetic/store/syntheticRunStoreFactory";
import { dispatchSyntheticBatch, type SyntheticBatchDispatchResult } from "../src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher";
import type { SyntheticSessionContract } from "../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const CLOCK = "2026-08-12T12:00:00.000Z";
const DEADLINE = "2026-08-12T12:05:00.000Z";
const CLAIM_TTL_MS = 30_000;
const BATCH_ID = "cli-dispatch-batch-0001";
const RUN_IDS = ["run-cli-batch-0001", "run-cli-batch-0002", "run-cli-batch-0003"] as const;

/** Executor fictício: sempre confirma sucesso, sem tocar navegador nem rede. */
class AlwaysSucceedExecutor implements SyntheticStepExecutor {
  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    return { outcome: "SUCCESS", stepId: input.stepId, detail: "executor fictício do dispatch-batch", capturedProtocol: null };
  }
}

function demoSession(runId: string): SyntheticSessionContract {
  return {
    sessionHandle: `sh_cli_batch_${runId}`,
    processId: `proc-cli-batch-${runId}`,
    actorId: "actor-cli-batch-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    issuedAt: "2026-08-12T11:00:00.000Z",
    expiresAt: "2026-08-12T23:59:59.000Z",
    environment: "synthetic",
    consentMarker: `consentimento-sintetico-cli-batch-${runId}`,
    handoffState: "CLAIMED",
    auditCorrelationId: `corr-cli-batch-${runId}`,
    allowedSyntheticProcessCode: `PROT-FICT-CLIBATCH-${runId}`,
  };
}

function demoPlan(runId: string): SyntheticRunPlan {
  return {
    planId: `plan-cli-batch-${runId}`,
    version: "1.0.0",
    allowedSyntheticData: [],
    steps: [{ stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" }],
  };
}

function storeKindFromArgs(): SyntheticRunStoreKind {
  return process.argv.includes("--prisma") ? "prisma" : "memory";
}

function printSummary(kind: SyntheticRunStoreKind, result: SyntheticBatchDispatchResult): void {
  console.log("");
  console.log(`=== Despachante sintético em lote (store: ${kind}) ===`);
  console.log(`motivo de parada: ${result.stopReason}`);
  console.log(`solicitado: ${result.requested} · despachado: ${result.dispatched}`);
  console.log(`concluído: ${result.completed} · sem trabalho: ${result.noWork} · em conflito: ${result.conflicted} · interrompido: ${result.interrupted}`);
  console.log(`concorrência: max=${result.limits.maxConcurrency} efetiva=${result.limits.effectiveConcurrency} pico=${result.limits.peakConcurrency}`);
  for (const item of result.results) {
    console.log(`  - ${item.workerId} (${item.runId ?? "—"}): ${item.outcome} [${item.runState ?? "—"}]`);
  }
  console.log("Execução local e sintética. Nenhum acesso a Gov.br/SINARM.");
}

const CONTROLLED_STOP_REASONS = new Set<SyntheticBatchDispatchResult["stopReason"]>([
  "LIMIT_REACHED",
  "NO_RUN_AVAILABLE",
  "DEADLINE_REACHED",
  "CANCELLED",
  "COMPLETED_BATCH",
]);

async function main(): Promise<number> {
  const kind = storeKindFromArgs();
  const store = createSyntheticRunStore(kind);

  for (const runId of RUN_IDS) {
    const created = createSyntheticRun({ runId, session: demoSession(runId), plan: demoPlan(runId) });
    if (!created.ok) {
      console.error(`Falha ao criar o run fictício ${runId}:`, created.violations.map((v) => v.code).join(", "));
      return 1;
    }
    const savedCreation = await store.create({ run: created.run, idempotencyKey: `idem-${runId}`, at: CLOCK });
    if (!savedCreation.ok) {
      console.error(`Falha ao gravar o run fictício ${runId}:`, savedCreation.violations.map((v) => v.code).join(", "));
      return 1;
    }
  }

  const result = await dispatchSyntheticBatch({
    store,
    executor: new AlwaysSucceedExecutor(),
    maxRuns: 3,
    maxConcurrency: 2,
    at: CLOCK,
    deadlineAt: DEADLINE,
    now: () => new Date().toISOString(),
    claimTtlMs: CLAIM_TTL_MS,
    resolveSession: (runId) => Promise.resolve(demoSession(runId)),
    idempotencyKeyFor: (runId) => `${BATCH_ID}:${runId}`,
    workerIdPrefix: "worker-cli-batch",
  });

  printSummary(kind, result);
  return CONTROLLED_STOP_REASONS.has(result.stopReason) ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Falha técnica no despachante sintético:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
