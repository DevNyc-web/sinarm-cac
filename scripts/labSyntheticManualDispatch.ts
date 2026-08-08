/**
 * CLI de DESENVOLVIMENTO: aciona manualmente UM lote sintético pequeno via
 * `triggerManualSyntheticDispatch` — contexto administrativo fictício,
 * confirmação explícita, health/readiness calculados localmente, store em
 * memória, logger em memória. Repete a MESMA chamada em seguida para
 * demonstrar o replay (nada é despachado de novo). Termina sozinho: sem
 * `while`, sem polling, sem cron, sem servidor.
 *
 *   npm run lab:synthetic:manual-dispatch
 *   npm run lab:synthetic:manual-dispatch -- --prisma
 *
 * Registry em memória por padrão. `--prisma` usa
 * `PrismaManualDispatchRequestRegistry` (precisa de `DATABASE_URL` válido)
 * — ESCOLHA EXPLÍCITA, nunca fallback silencioso: se a conexão falhar, o
 * comando encerra com erro. O run sintético em si continua sempre em
 * `InMemorySyntheticRunStore` — este comando demonstra o ACIONADOR
 * ADMINISTRATIVO e a durabilidade do REGISTRY, não o store do motor.
 *
 * Não imprime `sessionHandle`, credencial, string de conexão nem valor de
 * `.env`.
 */
import { createSyntheticRun, type SyntheticRunPlan } from "../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { InMemorySyntheticEngineLogger } from "../src/server/automation/synthetic/observability/inMemorySyntheticEngineLogger";
import { buildSyntheticEngineHealth } from "../src/server/automation/synthetic/observability/syntheticEngineHealth";
import { zeroSyntheticEngineMetrics } from "../src/server/automation/synthetic/observability/syntheticEngineMetrics";
import { buildSyntheticEngineReadiness } from "../src/server/automation/synthetic/observability/syntheticEngineReadiness";
import { createManualDispatchRequestRegistry, type ManualDispatchRegistryKind } from "../src/server/automation/synthetic/admin/manualDispatchRequestRegistryFactory";
import { triggerManualSyntheticDispatch, type ManualSyntheticDispatchInput } from "../src/server/automation/synthetic/admin/manualSyntheticDispatchTrigger";
import type { ManualSyntheticDispatchAdminContext } from "../src/server/automation/synthetic/admin/manualSyntheticDispatchTypes";
import type { SyntheticSessionContract } from "../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const CLOCK = "2026-08-15T12:00:00.000Z";
const DEADLINE = "2026-08-15T12:05:00.000Z";
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
  calls = 0;
  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    this.calls += 1;
    return { outcome: "SUCCESS", stepId: input.stepId, detail: "executor fictício do acionador manual", capturedProtocol: null };
  }
}

function demoSession(runId: string): SyntheticSessionContract {
  return {
    sessionHandle: `sh_cli_manual_${runId}`,
    processId: `proc-cli-manual-${runId}`,
    actorId: "actor-cli-manual-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    issuedAt: "2026-08-15T11:00:00.000Z",
    expiresAt: "2026-08-15T23:59:59.000Z",
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

function registryKindFromArgs(): ManualDispatchRegistryKind {
  return process.argv.includes("--prisma") ? "prisma" : "memory";
}

function printResult(label: string, result: Awaited<ReturnType<typeof triggerManualSyntheticDispatch>>, executorCalls: number): void {
  console.log("");
  console.log(`=== ${label} ===`);
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
  console.log(`chamadas ao executor até agora: ${executorCalls}`);
  console.log(result.warnings.length > 0 ? `avisos: ${result.warnings.map((w) => `${w.code}: ${w.detail}`).join(" | ")}` : "avisos: nenhum");
}

async function main(): Promise<number> {
  const kind = registryKindFromArgs();
  const store = new InMemorySyntheticRunStore();
  const logger = new InMemorySyntheticEngineLogger();
  const registry = createManualDispatchRequestRegistry(kind);
  const executor = new AlwaysSucceedExecutor();

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

  const requestInput: ManualSyntheticDispatchInput = {
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
    executor,
    resolveSession: (runId) => Promise.resolve(demoSession(runId)),
    logger,
    now: () => new Date().toISOString(),
    context: ADMIN_CONTEXT,
    health,
    readiness,
    registry,
  };

  const first = await triggerManualSyntheticDispatch(requestInput);
  printResult(`Acionador administrativo manual (registry: ${kind}) — 1ª chamada`, first, executor.calls);

  // Mesmo requestId de novo: demonstra que o registry reconhece o replay e
  // o dispatcher NÃO é chamado uma segunda vez, mesmo com o mesmo payload.
  const second = await triggerManualSyntheticDispatch(requestInput);
  printResult(`Acionador administrativo manual (registry: ${kind}) — 2ª chamada (replay esperado)`, second, executor.calls);

  console.log("");
  console.log(
    `replay confirmado: ${second.outcome === "REQUEST_REPLAYED" ? "sim" : "não"} · executor chamado ${executor.calls}x NESTE processo` +
      (kind === "prisma" ? " (0x é esperado se este requestId já tinha sido processado numa execução anterior — prova de durabilidade entre reinícios)" : ""),
  );
  console.log("Execução local e sintética. Nenhum acesso a Gov.br/SINARM. Nenhuma credencial real.");

  const ok = second.outcome === "REQUEST_REPLAYED" && second.batch?.completed === RUN_IDS.length;
  return ok ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Falha técnica no acionador administrativo manual:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
