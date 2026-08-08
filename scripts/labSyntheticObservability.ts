/**
 * CLI de DESENVOLVIMENTO: roda um lote sintético PEQUENO com observabilidade
 * ligada — store em memória, dispatcher limitado, logger em memória — e
 * imprime um resumo redigido (métricas, health, readiness, snapshot).
 * Termina sozinho: sem `while`, sem polling, sem cron, sem servidor.
 *
 *   npm run lab:synthetic:observability
 *
 * Sempre store em memória (modo Prisma não é necessário para demonstrar
 * observabilidade). Executor fictício embutido — este comando demonstra a
 * CAMADA DE OBSERVABILIDADE, não o adaptador Playwright.
 *
 * Não imprime `sessionHandle`, evento cru nem valor de `.env`.
 */
import { createSyntheticRun, type SyntheticRunPlan } from "../src/server/automation/synthetic/syntheticRunCoordinator";
import { InMemorySyntheticRunStore } from "../src/server/automation/synthetic/store/inMemorySyntheticRunStore";
import { dispatchSyntheticBatch } from "../src/server/automation/synthetic/dispatcher/syntheticBatchDispatcher";
import { InMemorySyntheticEngineLogger } from "../src/server/automation/synthetic/observability/inMemorySyntheticEngineLogger";
import { buildSyntheticEngineMetrics } from "../src/server/automation/synthetic/observability/syntheticEngineMetrics";
import { buildSyntheticEngineHealth } from "../src/server/automation/synthetic/observability/syntheticEngineHealth";
import { buildSyntheticEngineReadiness } from "../src/server/automation/synthetic/observability/syntheticEngineReadiness";
import { buildSyntheticEngineOperationalSnapshot, validateSyntheticEngineOperationalSnapshot } from "../src/server/automation/synthetic/observability/syntheticEngineSnapshot";
import type { SyntheticSessionContract } from "../src/server/automation/synthetic/sessionContract";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionResult,
  SyntheticStepExecutor,
} from "../src/server/automation/synthetic/playwright/syntheticStepExecutor";

const CLOCK = "2026-08-13T12:00:00.000Z";
const DEADLINE = "2026-08-13T12:05:00.000Z";
const CLAIM_TTL_MS = 30_000;
const BATCH_ID = "cli-observability-0001";
const RUN_IDS = ["run-cli-obs-0001", "run-cli-obs-0002", "run-cli-obs-0003"] as const;

/** Executor fictício: sempre confirma sucesso, sem tocar navegador nem rede. */
class AlwaysSucceedExecutor implements SyntheticStepExecutor {
  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    return { outcome: "SUCCESS", stepId: input.stepId, detail: "executor fictício do lab de observabilidade", capturedProtocol: null };
  }
}

function demoSession(runId: string): SyntheticSessionContract {
  return {
    sessionHandle: `sh_cli_obs_${runId}`,
    processId: `proc-cli-obs-${runId}`,
    actorId: "actor-cli-obs-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    issuedAt: "2026-08-13T11:00:00.000Z",
    expiresAt: "2026-08-13T23:59:59.000Z",
    environment: "synthetic",
    consentMarker: `consentimento-sintetico-cli-obs-${runId}`,
    handoffState: "CLAIMED",
    auditCorrelationId: `corr-cli-obs-${runId}`,
    allowedSyntheticProcessCode: `PROT-FICT-CLIOBS-${runId}`,
  };
}

function demoPlan(runId: string): SyntheticRunPlan {
  return {
    planId: `plan-cli-obs-${runId}`,
    version: "1.0.0",
    allowedSyntheticData: [],
    steps: [{ stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "ok" }],
  };
}

async function main(): Promise<number> {
  const store = new InMemorySyntheticRunStore();
  const logger = new InMemorySyntheticEngineLogger();

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

  const recoverableBeforeDispatch = await store.listRecoverable({ at: CLOCK });

  const batch = await dispatchSyntheticBatch({
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
    workerIdPrefix: "worker-cli-obs",
    logger,
  });

  const recoverableAfterDispatch = await store.listRecoverable({ at: CLOCK });
  const logEvents = logger.snapshot();
  const metrics = buildSyntheticEngineMetrics({
    batch,
    runsFound: recoverableBeforeDispatch.length,
    recoverable: recoverableAfterDispatch,
    logEvents,
  });

  const health = buildSyntheticEngineHealth({
    storeAccessible: true,
    configValid: true,
    internalErrorOccurred: false,
    corruptedRecordDetected: false,
    lastBatchHadIsolatedFailures: metrics.runsFailed + metrics.runsExpired > 0,
    metrics,
  });

  const readiness = buildSyntheticEngineReadiness({
    storeAvailable: true,
    executorAvailable: true,
    configValid: true,
    requiredDependenciesPresent: true,
    operationalBlock: false,
  });

  const snapshot = buildSyntheticEngineOperationalSnapshot({
    timestamp: new Date().toISOString(),
    metrics,
    health,
    readiness,
    lastBatch: {
      stopReason: batch.stopReason,
      requested: batch.requested,
      dispatched: batch.dispatched,
      completed: batch.completed,
      conflicted: batch.conflicted,
      noWork: batch.noWork,
      interrupted: batch.interrupted,
      startedAt: batch.startedAt,
      finishedAt: batch.finishedAt,
    },
  });

  const snapshotValidation = validateSyntheticEngineOperationalSnapshot(snapshot);
  if (!snapshotValidation.ok) {
    console.error("Snapshot operacional inválido:", snapshotValidation.violations.join(", "));
    return 1;
  }

  console.log("");
  console.log("=== Observabilidade do motor sintético (store: memory) ===");
  console.log(`health: ${snapshot.health} · readiness: ${snapshot.readiness} · formatVersion: ${snapshot.formatVersion}`);
  console.log(`lote: ${batch.stopReason} — solicitado=${metrics.runsDispatched === 0 ? metrics.runsFound : batch.requested} despachado=${batch.dispatched} concluído=${batch.completed} conflito=${batch.conflicted} semTrabalho=${batch.noWork}`);
  console.log(
    `métricas: etapas=${metrics.stepsExecuted} concluídos=${metrics.runsCompleted} falhos=${metrics.runsFailed} expirados=${metrics.runsExpired} aguardandoHumano=${metrics.runsWaitingHuman} conflitoClaim=${metrics.claimConflicts} conflitoVersão=${metrics.versionConflicts} evidências=${metrics.evidenceProduced} eventos=${metrics.eventsProduced} duraçãoMs=${metrics.batchDurationMs} picoConcorrência=${metrics.peakConcurrency}`,
  );
  console.log(`eventos de log emitidos: ${logEvents.length} (${[...new Set(logEvents.map((e) => e.code))].join(", ")})`);
  if (snapshot.warnings.length > 0) {
    console.log(`avisos: ${snapshot.warnings.map((w) => `${w.code}: ${w.detail}`).join(" | ")}`);
  } else {
    console.log("avisos: nenhum");
  }
  console.log("Execução local e sintética. Nenhum acesso a Gov.br/SINARM. Nenhum log persistido.");

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Falha técnica no lab de observabilidade:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
