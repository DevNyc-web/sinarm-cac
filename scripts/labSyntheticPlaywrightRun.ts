/**
 * CLI de DESENVOLVIMENTO: roda o plano sintético completo pelo harness contra
 * o adaptador Playwright local, e imprime um resumo redigido.
 *
 *   npm run lab:synthetic:playwright
 *
 * Reusa o MESMO padrão de `playwright.config.ts` (`reuseExistingServer`): sobe
 * `npm run dev` só se `http://localhost:3000/login` ainda não responder — não
 * duplica lógica de servidor nova.
 *
 * A base é SEMPRE `http://localhost:3000`, fixa no código — não recebe URL
 * livre por argumento, flag ou variável de ambiente. O adaptador ainda assim
 * valida a origem contra o guard de loopback antes de abrir o navegador
 * (defesa em profundidade).
 *
 * Não persiste relatório em arquivo: só imprime um resumo redigido no
 * console. `WAITING_HUMAN` é um resultado CONTROLADO (exit 0), não uma falha
 * técnica — só uma exceção real (servidor não sobe, adaptador recusa a base
 * URL) sai com código diferente de zero.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { LocalSyntheticPlaywrightAdapter } from "../src/server/automation/synthetic/playwright/localSyntheticPlaywrightAdapter";
import {
  runSyntheticPlaywrightPlan,
  type SyntheticPlaywrightRunReport,
} from "../src/server/automation/synthetic/playwright/syntheticPlaywrightRunHarness";
import type { SyntheticSessionContract } from "../src/server/automation/synthetic/sessionContract";
import type { SyntheticRunPlan } from "../src/server/automation/synthetic/syntheticRunCoordinator";

const BASE_URL = "http://localhost:3000";
const READINESS_URL = `${BASE_URL}/login`;
const READINESS_TIMEOUT_MS = 120_000;

function demoSession(): SyntheticSessionContract {
  return {
    sessionHandle: "sh_cli_lab_0001",
    processId: "proc-cli-lab-0001",
    actorId: "actor-cli-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    issuedAt: "2026-08-08T12:00:00.000Z",
    expiresAt: "2026-08-08T23:59:59.000Z",
    environment: "synthetic",
    consentMarker: "consentimento-sintetico-cli",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-cli-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-CLI-0001",
  };
}

/** O mesmo plano fictício de 4 etapas do laboratório (validar/abrir/preencher/confirmar). */
function demoPlan(): SyntheticRunPlan {
  return {
    planId: "plan-cli-lab-0001",
    version: "1.0.0",
    allowedSyntheticData: ["destino fictício"],
    steps: [
      { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "página fictícia carregada" },
      { stepId: "step-2", type: "OPEN_FORM", description: "abrir formulário fictício", expectedResult: "formulário fictício visível" },
      { stepId: "step-3", type: "FILL_FORM", description: "preencher dados fictícios", expectedResult: "revisão pronta" },
      { stepId: "step-4", type: "CONFIRM_RESULT", description: "confirmar resultado fictício", expectedResult: "protocolo fictício confirmado" },
    ],
  };
}

/** Relógio sintético fixo — nunca `Date.now()`. */
function demoClock(): string[] {
  const base = Date.parse("2026-08-08T13:00:00.000Z");
  return Array.from({ length: 5 }, (_, i) => new Date(base + i * 1_000).toISOString());
}

async function isServerReady(): Promise<boolean> {
  try {
    const response = await fetch(READINESS_URL);
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForReady(deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await isServerReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

/**
 * `child.kill()` sozinho só derruba o processo `npm`, não a árvore inteira
 * (`npm` -> `next dev` -> `node`) — no Windows isso deixa o servidor real
 * órfão, ainda escutando a porta. `taskkill /t` mata a árvore.
 */
function killDevServerTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    // Síncrono de propósito: o script termina logo em seguida, e um
    // `spawn` assíncrono aqui poderia nunca chegar a rodar antes do exit.
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } catch {
      // Já pode ter saído sozinho; nada a fazer.
    }
    return;
  }
  child.kill();
}

/** Sobe `npm run dev` só se o servidor local ainda não responder. */
async function ensureDevServer(): Promise<ChildProcess | null> {
  if (await isServerReady()) {
    console.log(`Servidor local já respondendo em ${BASE_URL} — reaproveitando.`);
    return null;
  }
  console.log("Subindo `npm run dev` local...");
  // Comando fixo (sem argumento externo/dinâmico) — `shell: true` aqui não
  // concatena entrada de fora, então não reabre o aviso de segurança do Node
  // sobre `spawn` com `shell` + array de argumentos.
  const child = spawn("npm run dev", { stdio: "ignore", shell: true });
  const ready = await waitForReady(Date.now() + READINESS_TIMEOUT_MS);
  if (!ready) {
    child.kill();
    throw new Error("servidor local não respondeu a tempo");
  }
  return child;
}

/** Resumo redigido — nunca imprime `sessionHandle`, evidência bruta ou objeto arbitrário. */
function printSummary(report: SyntheticPlaywrightRunReport): void {
  console.log("");
  console.log("=== Laboratório sintético — resumo (LOCAL, LOOPBACK, FICTÍCIO) ===");
  console.log(`run: ${report.runId} · plano: ${report.planId}`);
  console.log(`resultado: ${report.outcome}`);
  console.log(`etapas: ${report.executedSteps.length}/${report.totalSteps} executadas`);
  console.log(`fallback humano: ${report.humanFallbackRequired ? "sim" : "não"}`);
  console.log(`protocolo fictício: ${report.syntheticProtocol ?? "—"}`);
  console.log(`início: ${report.startedAt} · fim: ${report.finishedAt}`);
  console.log("Nenhum processo real foi protocolado. Nenhum acesso a Gov.br/SINARM.");
}

async function main(): Promise<number> {
  const devServer = await ensureDevServer();
  const adapter = new LocalSyntheticPlaywrightAdapter({ baseUrl: BASE_URL, timeoutMs: 15_000 });

  try {
    const report = await runSyntheticPlaywrightPlan({
      runId: "run-cli-lab-0001",
      session: demoSession(),
      plan: demoPlan(),
      executor: adapter,
      clock: demoClock(),
    });
    printSummary(report);
    // WAITING_HUMAN é controlado, não crash; qualquer outro desfecho fora de
    // COMPLETED indica que o laboratório fictício não terminou como esperado.
    return report.outcome === "COMPLETED" || report.outcome === "WAITING_HUMAN" ? 0 : 1;
  } finally {
    await adapter.dispose();
    if (devServer) killDevServerTree(devServer);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Falha técnica ao rodar o laboratório sintético:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
