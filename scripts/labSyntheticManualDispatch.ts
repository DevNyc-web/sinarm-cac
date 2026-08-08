/**
 * CLI de DESENVOLVIMENTO: aciona manualmente UM lote sintético pequeno via
 * `triggerManualSyntheticDispatch` — contexto administrativo fictício,
 * confirmação explícita, health/readiness calculados localmente, store em
 * memória, logger em memória. Termina sozinho: sem `while`, sem polling,
 * sem cron, sem servidor.
 *
 *   npm run lab:synthetic:manual-dispatch
 *
 * Sempre store em memória (modo Prisma explícito ficaria atrás de uma nova
 * flag, ainda não adicionada — fora do escopo deste comando). Executor
 * fictício embutido — este comando demonstra o ACIONADOR ADMINISTRATIVO,
 * não o adaptador Playwright.
 *
 * Não imprime `sessionHandle`, credencial nem valor de `.env`.
 */
import { createSyntheticRun, type SyntheticRunPlan } from "../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { InMemorySyntheticEngineLogger } from "../src/server/automation/synthetic/observability/inMemorySyntheticEngineLogger";
import { buildSyntheticEngineHealth } from "../src/server/automation/synthetic/observability/syntheticEngineHealth";
import { zeroSyntheticEngineMetrics } from "../src/server/automation/synthetic/observability/syntheticEngineMetrics";
import { buildSyntheticEngineReadiness } from "../src/server/automation/synthetic/observability/syntheticEngineReadiness";
import { InMemoryManualDispatchRequestRegistry } from "../src/server/automation/synthetic/admin/inMemoryManualDispatchRequestRegistry";
import { triggerManualSyntheticDispatch } from "../src/server/automation/synthetic/admin/manualSyntheticDispatchTrigger";
import type { ManualSyntheticDispatchAdminContext } from "../src/server/automation/synthetic/admin/manualSyntheticDispatchTypes";
import type { SyntheticSessionContract } from "../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const CLOCK = "2026-08-14T12:00:00.000Z";
const DEADLINE = "2026-08-14T12:05:00.000Z";
const CLAIM_TTL_MS = 30_000;
const REQUEST_ID = "cli-manual-dispatch-0001";
const BATCH_ID = "cli-manual-batch-0001";
const RUN_IDS = ["run-cli-manual-0001", "run-cli-manual-0002"] as const;

/** Contexto administrativo FICTÍCIO — este PR não resolve sessão real nem credencial. */
const ADMIN_CONTEXT: ManualSyntheticDispatchAdminContext = {
  role: "ADMIN",
  environment: "SYNTHETIC_LAB",
  explicitConfirmation: true,
  requestedBy: "admin-fictício-cli-local",
};

class AlwaysSucceedExecutor implements SyntheticStepExecutor {
  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    return { outcome: "SUCCESS", stepId: input.stepId, detail: "executor fictício do acionador manual", capturedProtocol: null };
  }
}

function demoSession(runId: string): SyntheticSessionContract {
  return {
    sessionHandle: `sh_cli_manual_${runId}`,
    processId: `proc-cli-manual-${runId}`,
    actorId: "actor-cli-manual-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    issuedAt: "2026-08-14T11:00:00.000Z",
    expiresAt: "2026-08-14T23:59:59.000Z",
    environment: "synthetic",
    consentMarker: `consentimento-sintetico-cli-manual-${runId}`,
    handoffState: "CLAIMED",
    auditCorrelationId: `corr-cli-manual-${runId}`,
    allowedSyntheticProcessCode: `PROT-FICT-CLIMANUAL-${runId}`,
  };
}

function demoPlan(runId: string): SyntheticRunPlan {
  return {
    planId: `plan-cli-manual-${runId}`,
    version: "1.0.0",
    allowedSyntheticData: [],
    steps: [{ stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" }],
  };
}

async function main(): Promise<number> {
  const store = new InMemorySyntheticRunStore();
  const logger = new InMemorySyntheticEngineLogger();
  const registry = new InMemoryManualDispatchRequestRegistry();

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

  // Health/readiness calculados localmente — o acionador nunca os consulta sozinho.
  const health = buildSyntheticEngineHealth({
    storeAccessible: true,
    configValid: true,
    internalErrorOccurred: false,
    corruptedRecordDetected: false,
    lastBatchHadIsolatedFailures: false,
    metrics: zeroSyntheticEngineMetrics(),
  });
  const readiness = buildSyntheticEngineReadiness({
    storeAvailable: true,
    executorAvailable: true,
    configValid: true,
    requiredDependenciesPresent: true,
    operationalBlock: false,
  });

  const result = await triggerManualSyntheticDispatch({
    requestId: REQUEST_ID,
    batchId: BATCH_ID,
    requestedBy: ADMIN_CONTEXT.requestedBy,
    reason: "demonstração local do acionador administrativo manual",
    requestedAt: CLOCK,
    maxRuns: 2,
    maxConcurrency: 2,
    deadlineAt: DEADLINE,
    claimTtlMs: CLAIM_TTL_MS,
    store,
    executor: new AlwaysSucceedExecutor(),
    resolveSession: (runId) => Promise.resolve(demoSession(runId)),
    logger,
    now: () => new Date().toISOString(),
    context: ADMIN_CONTEXT,
    health,
    readiness,
    registry,
  });

  console.log("");
  console.log("=== Acionador administrativo manual do dispatcher sintético (store: memory) ===");
  console.log(`decisão: ${result.decision} · outcome: ${result.outcome}`);
  console.log(`requestId: ${result.requestId} · batchId: ${result.batchId} · solicitante: ${result.requestedBy}`);
  console.log(`motivo: ${result.reason}`);
  if (result.batch !== null) {
    console.log(`lote: ${result.batch.stopReason} — solicitado=${result.batch.requested} despachado=${result.batch.dispatched} concluído=${result.batch.completed}`);
  }
  if (result.metrics !== null) {
    console.log(`métricas: etapas=${result.metrics.stepsExecuted} concluídos=${result.metrics.runsCompleted} duraçãoMs=${result.metrics.batchDurationMs}`);
  }
  console.log(`health: ${result.health} · readiness: ${result.readiness}`);
  console.log(`eventos de log emitidos: ${logger.snapshot().length}`);
  if (result.warnings.length > 0) {
    console.log(`avisos: ${result.warnings.map((w) => `${w.code}: ${w.detail}`).join(" | ")}`);
  } else {
    console.log("avisos: nenhum");
  }
  console.log("Execução local e sintética. Nenhum acesso a Gov.br/SINARM. Nenhuma credencial real.");

  return result.outcome === "REQUEST_DENIED" || result.outcome === "DISPATCH_FAILED" ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Falha técnica no acionador administrativo manual:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
