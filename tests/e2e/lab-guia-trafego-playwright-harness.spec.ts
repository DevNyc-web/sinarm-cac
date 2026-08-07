import { expect, test } from "@playwright/test";
import type { SyntheticSessionContract } from "../../src/server/automation/synthetic/sessionContract";
import type { SyntheticRunPlan } from "../../src/server/automation/synthetic/syntheticRunCoordinator";
import { LocalSyntheticPlaywrightAdapter } from "../../src/server/automation/synthetic/playwright/localSyntheticPlaywrightAdapter";
import {
  runSyntheticPlaywrightPlan,
  validateSyntheticPlaywrightRunReport,
} from "../../src/server/automation/synthetic/playwright/syntheticPlaywrightRunHarness";

/**
 * Harness de alto nível (`syntheticPlaywrightRunHarness.ts`) contra o
 * adaptador Playwright REAL e o laboratório fictício `/admin/lab/guia-trafego`
 * — mesma config `playwright.config.ts` de sempre, sem rede externa.
 */

const BASE_URL = "http://localhost:3000";

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_e2e_harness_0001",
    processId: "proc-e2e-harness-0001",
    actorId: "actor-e2e-harness-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-08T23:59:59.000Z",
    issuedAt: "2026-08-08T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-e2e-harness-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-e2e-harness-0001",
    allowedSyntheticProcessCode: "PROT-FICT-E2EH-0001",
    ...overrides,
  };
}

function plan(): SyntheticRunPlan {
  return {
    planId: "plan-e2e-harness-0001",
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

function isoTick(seq: number): string {
  return new Date(Date.parse("2026-08-08T12:00:00.000Z") + seq * 1000).toISOString();
}

function clock(count: number): string[] {
  return Array.from({ length: count }, (_, i) => isoTick(i));
}

// ================================================== 1/2/7/8. sucesso + relatório

test("execução completa: 4 etapas via harness produzem relatório de sucesso válido e redigido", async () => {
  const adapter = new LocalSyntheticPlaywrightAdapter({ baseUrl: BASE_URL, timeoutMs: 15_000 });
  try {
    const report = await runSyntheticPlaywrightPlan({
      runId: "run-e2e-harness-0001",
      session: session(),
      plan: plan(),
      executor: adapter,
      clock: clock(5),
    });

    expect(report.outcome).toBe("COMPLETED");
    expect(report.runState).toBe("COMPLETED");
    expect(report.sessionState).toBe("COMPLETED");
    expect(report.totalSteps).toBe(4);
    expect(report.executedSteps).toHaveLength(4);
    expect(report.remainingSteps).toHaveLength(0);
    expect(report.syntheticProtocol).toMatch(/^PROT-FICT-/);
    expect(report.humanFallbackRequired).toBe(false);

    const validation = validateSyntheticPlaywrightRunReport(report);
    expect(validation.ok, `relatório inválido: ${JSON.stringify(!validation.ok ? validation.violations : [])}`).toBe(true);

    const serialized = JSON.stringify(report).toLowerCase();
    for (const forbidden of ["sh_e2e_harness", "senha", "password", "cookie", "token", "screenshot", "stack"]) {
      expect(serialized, `vazou "${forbidden}"`).not.toContain(forbidden);
    }
  } finally {
    await adapter.dispose();
  }
});

// ============================================================= 3/6. captcha

test("captcha sintético (pausa humana): harness interrompe em WAITING_HUMAN, sem etapa posterior", async () => {
  const adapter = new LocalSyntheticPlaywrightAdapter({ baseUrl: BASE_URL, scenario: "human-pause", timeoutMs: 15_000 });
  try {
    const report = await runSyntheticPlaywrightPlan({
      runId: "run-e2e-harness-0002",
      session: session({ sessionHandle: "sh_e2e_harness_0002", auditCorrelationId: "corr-e2e-harness-0002" }),
      plan: plan(),
      executor: adapter,
      clock: clock(5),
    });

    expect(report.outcome).toBe("WAITING_HUMAN");
    expect(report.humanFallbackRequired).toBe(true);
    expect(report.executedSteps).toHaveLength(3);
    expect(report.remainingSteps, "etapa bloqueada não é consumida, e nenhuma outra roda depois").toHaveLength(1);
    expect(report.syntheticProtocol).toBeNull();
    expect(validateSyntheticPlaywrightRunReport(report).ok).toBe(true);
  } finally {
    await adapter.dispose();
  }
});

// ================================================================= 4. timeout

test("timeout: harness interrompe sem retry, sem protocolo, com erro redigido no relatório", async () => {
  const adapter = new LocalSyntheticPlaywrightAdapter({
    baseUrl: BASE_URL,
    scenario: "missing-document",
    timeoutMs: 3_000,
  });
  try {
    const report = await runSyntheticPlaywrightPlan({
      runId: "run-e2e-harness-0003",
      session: session({ sessionHandle: "sh_e2e_harness_0003", auditCorrelationId: "corr-e2e-harness-0003" }),
      plan: plan(),
      executor: adapter,
      clock: clock(5),
    });

    expect(report.outcome).toBe("FAILED");
    expect(report.syntheticProtocol).toBeNull();
    expect(report.remainingSteps.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("TimeoutError:");
    expect(serialized).not.toMatch(/at .*\.ts:\d+/); // sem stack trace de arquivo:linha
  } finally {
    await adapter.dispose();
  }
});

// ======================================================= 5/8. guarda de rede

test("bloqueio de rede real durante execução ativa do harness; relatório sem URL externa", async () => {
  const adapter = new LocalSyntheticPlaywrightAdapter({ baseUrl: BASE_URL, timeoutMs: 15_000 });
  try {
    const report = await runSyntheticPlaywrightPlan({
      runId: "run-e2e-harness-0004",
      session: session({ sessionHandle: "sh_e2e_harness_0004", auditCorrelationId: "corr-e2e-harness-0004" }),
      plan: plan(),
      executor: adapter,
      clock: clock(5),
      maxSteps: 1, // só abre a página; o resto do teste prova o bloqueio de rede nela
    });

    expect(report.outcome).toBe("SAFETY_LIMIT_REACHED");

    const page = adapter.getPageForTesting();
    expect(page).not.toBeNull();
    if (!page) return;

    await page.evaluate(() => fetch("https://example.com/probe-bloqueado").catch(() => "erro-esperado"));
    await page.waitForTimeout(300);

    expect(adapter.getBlockedRequestUrls().some((url) => url.includes("example.com"))).toBe(true);

    const serialized = JSON.stringify(report);
    expect(/https?:\/\/(?!localhost|127\.0\.0\.1)/i.test(serialized)).toBe(false);
  } finally {
    await adapter.dispose();
  }
});

// =========================================================== 9. limite de segurança

test("limite de segurança: harness real para no teto explícito, sem protocolo", async () => {
  const adapter = new LocalSyntheticPlaywrightAdapter({ baseUrl: BASE_URL, timeoutMs: 15_000 });
  try {
    const report = await runSyntheticPlaywrightPlan({
      runId: "run-e2e-harness-0005",
      session: session({ sessionHandle: "sh_e2e_harness_0005", auditCorrelationId: "corr-e2e-harness-0005" }),
      plan: plan(),
      executor: adapter,
      clock: clock(5),
      maxSteps: 2,
    });

    expect(report.outcome).toBe("SAFETY_LIMIT_REACHED");
    expect(report.executedSteps).toHaveLength(2);
    expect(report.remainingSteps).toHaveLength(2);
    expect(report.syntheticProtocol).toBeNull();
  } finally {
    await adapter.dispose();
  }
});

// ============================================================ 10. fechamento

test("dispose fecha o browser/context mesmo depois de uma falha", async () => {
  const adapter = new LocalSyntheticPlaywrightAdapter({
    baseUrl: BASE_URL,
    scenario: "missing-document",
    timeoutMs: 3_000,
  });

  const report = await runSyntheticPlaywrightPlan({
    runId: "run-e2e-harness-0006",
    session: session({ sessionHandle: "sh_e2e_harness_0006", auditCorrelationId: "corr-e2e-harness-0006" }),
    plan: plan(),
    executor: adapter,
    clock: clock(5),
  });
  expect(report.outcome).toBe("FAILED");

  await expect(adapter.dispose()).resolves.toBeUndefined();
  expect(adapter.getPageForTesting()).toBeNull();
});
