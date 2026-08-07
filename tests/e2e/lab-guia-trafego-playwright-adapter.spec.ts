import { expect, test } from "@playwright/test";
import {
  createSyntheticRun,
  type SyntheticRunPlan,
} from "../../src/server/automation/synthetic/syntheticRunCoordinator";
import type { SyntheticSessionContract } from "../../src/server/automation/synthetic/sessionContract";
import { LocalSyntheticPlaywrightAdapter } from "../../src/server/automation/synthetic/playwright/localSyntheticPlaywrightAdapter";
import { runNextSyntheticStepLocally } from "../../src/server/automation/synthetic/playwright/localSyntheticRunner";

/**
 * Adaptador Playwright LOCAL conectado ao coordenador sintético, contra o
 * laboratório fictício `/admin/lab/guia-trafego` (config padrão
 * `playwright.config.ts` — a MESMA que já roda `lab-guia-trafego.spec.ts`;
 * nenhuma config nova, nenhum toque em `playwright.phase9.config.ts`).
 *
 * LIMITE: só `http://localhost:3000`/`127.0.0.1`. O guard de rede aborta de
 * fato (não só observa) qualquer requisição fora do loopback — provado abaixo
 * com uma tentativa real de navegação e de recurso externo.
 */

const BASE_URL = "http://localhost:3000";
const SHORT_TIMEOUT_MS = 3_000;

function session(overrides: Partial<SyntheticSessionContract> = {}): SyntheticSessionContract {
  return {
    sessionHandle: "sh_e2e_adapter_0001",
    processId: "proc-e2e-adapter-0001",
    actorId: "actor-e2e-adapter-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: "2026-08-07T23:59:59.000Z",
    issuedAt: "2026-08-07T10:00:00.000Z",
    environment: "synthetic",
    consentMarker: "consent-sintetico-e2e-adapter-0001",
    handoffState: "CLAIMED",
    auditCorrelationId: "corr-e2e-adapter-0001",
    allowedSyntheticProcessCode: "PROT-FICT-E2E-0001",
    ...overrides,
  };
}

function plan(overrides: Partial<SyntheticRunPlan> = {}): SyntheticRunPlan {
  return {
    planId: "plan-e2e-adapter-0001",
    version: "1.0.0",
    allowedSyntheticData: ["destino fictício"],
    steps: [
      { stepId: "step-1", type: "VALIDATE_INPUT", description: "validar dados sintéticos", expectedResult: "página fictícia carregada" },
      { stepId: "step-2", type: "OPEN_FORM", description: "abrir formulário fictício", expectedResult: "formulário fictício visível" },
      { stepId: "step-3", type: "FILL_FORM", description: "preencher dados fictícios", expectedResult: "revisão pronta" },
      { stepId: "step-4", type: "CONFIRM_RESULT", description: "confirmar resultado fictício", expectedResult: "protocolo fictício confirmado" },
    ],
    ...overrides,
  };
}

function isoTick(seq: number): string {
  return new Date(Date.parse("2026-08-07T11:00:00.000Z") + seq * 1000).toISOString();
}

// ============================================================ caminho feliz

test("caminho feliz: 4 etapas via adaptador local concluem o run com protocolo sintético", async () => {
  const created = createSyntheticRun({ runId: "run-e2e-adapter-0001", session: session(), plan: plan() });
  expect(created.ok).toBe(true);
  if (!created.ok) return;

  const adapter = new LocalSyntheticPlaywrightAdapter({ baseUrl: BASE_URL, timeoutMs: 15_000 });
  try {
    let run = created.run;
    for (let i = 0; i < 4; i += 1) {
      const result = await runNextSyntheticStepLocally({ run, executor: adapter, at: isoTick(i + 1) });
      expect(result.ok, `etapa ${i + 1} falhou: ${JSON.stringify(!result.ok ? result.violations : [])}`).toBe(true);
      if (!result.ok) return;
      run = result.run;
    }

    expect(run.state).toBe("COMPLETED");
    expect(run.pendingSteps).toHaveLength(0);
    expect(run.completedSteps).toHaveLength(4);
    expect(run.result?.outcome).toBe("SUCCESS");
    expect(run.result?.syntheticProtocol).toMatch(/^PROT-FICT-/);

    // evidência: sem sessionHandle, credencial, CPF, screenshot ou objeto arbitrário
    const serialized = JSON.stringify({ evidence: run.evidence, events: run.events });
    for (const forbidden of ["sh_e2e_adapter", "senha", "password", "cookie", "token", "000.000.000-00", "screenshot"]) {
      expect(serialized.toLowerCase(), `vazou "${forbidden}"`).not.toContain(forbidden.toLowerCase());
    }
    expect(run.evidence.every((e) => e.stepId && e.runId === run.runId)).toBe(true);
  } finally {
    await adapter.dispose();
  }
});

// ==================================================== guarda de rede (real)

test("guarda de rede: navegação e recurso externo são abortados de fato pelo context.route", async () => {
  const adapter = new LocalSyntheticPlaywrightAdapter({ baseUrl: BASE_URL, timeoutMs: 15_000 });
  try {
    // Abre a página (login + laboratório fictício) via o próprio adaptador.
    const opened = await adapter.execute({
      runId: "run-e2e-guard-0001",
      stepId: "step-1",
      type: "VALIDATE_INPUT",
      at: isoTick(1),
      allowedSyntheticProcessCode: "PROT-FICT-GUARD-0001",
    });
    expect(opened.outcome).toBe("SUCCESS");

    const page = adapter.getPageForTesting();
    expect(page).not.toBeNull();
    if (!page) return;

    // recurso externo (imagem) carregado pela própria página
    await page.evaluate(() => {
      const img = new Image();
      img.src = "https://example.com/pixel-externo.png";
    });
    await page.waitForTimeout(500);

    // navegação de página inteira para host externo
    const navigationError = await page.goto("https://example.com/", { timeout: 5_000 }).catch((error) => error);
    expect(navigationError, "navegação externa deveria falhar (abortada pelo guard)").toBeTruthy();

    const blocked = adapter.getBlockedRequestUrls();
    expect(blocked.some((url) => url.includes("example.com"))).toBe(true);

    // a página nunca chegou a sair do loopback
    expect(page.url()).toMatch(/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/);
  } finally {
    await adapter.dispose();
  }
});

// ============================================================ 11/12/13 captcha

test("captcha sintético (pausa humana): CAPTCHA_DETECTED leva o run a WAITING_HUMAN, sem bypass", async () => {
  const created = createSyntheticRun({
    runId: "run-e2e-captcha-0001",
    session: session({ sessionHandle: "sh_e2e_captcha_0001", auditCorrelationId: "corr-e2e-captcha-0001" }),
    plan: plan(),
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;

  const adapter = new LocalSyntheticPlaywrightAdapter({ baseUrl: BASE_URL, scenario: "human-pause", timeoutMs: 15_000 });
  try {
    let run = created.run;
    for (let i = 0; i < 3; i += 1) {
      const result = await runNextSyntheticStepLocally({ run, executor: adapter, at: isoTick(i + 1) });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      run = result.run;
    }

    // 4a etapa (CONFIRM_RESULT): o cenário "human-pause" mostra o marcador antes da GRU.
    const result = await runNextSyntheticStepLocally({ run, executor: adapter, at: isoTick(4) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    run = result.run;

    expect(run.state).toBe("WAITING_HUMAN");
    expect(run.humanFallbackRequired).toBe(true);
    expect(run.pendingSteps, "a etapa bloqueada não é consumida").toHaveLength(1);

    const serialized = JSON.stringify(run.evidence);
    expect(serialized).not.toContain("resolver");
    expect(serialized).not.toContain("bypass");
  } finally {
    await adapter.dispose();
  }
});

// ================================================================= 14/15 timeout

test("timeout sintético: cenário sem saída expira o tempo limite e não avança a fila", async () => {
  const created = createSyntheticRun({
    runId: "run-e2e-timeout-0001",
    session: session({ sessionHandle: "sh_e2e_timeout_0001", auditCorrelationId: "corr-e2e-timeout-0001" }),
    plan: plan(),
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;

  // "missing-document" trava o botão "Continuar" desabilitado para sempre — o
  // timeout curto do adaptador estoura esperando ele habilitar.
  const adapter = new LocalSyntheticPlaywrightAdapter({
    baseUrl: BASE_URL,
    scenario: "missing-document",
    timeoutMs: SHORT_TIMEOUT_MS,
  });
  try {
    let run = created.run;
    for (let i = 0; i < 2; i += 1) {
      const result = await runNextSyntheticStepLocally({ run, executor: adapter, at: isoTick(i + 1) });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      run = result.run;
    }

    const pendingBefore = run.pendingSteps.length;
    const result = await runNextSyntheticStepLocally({ run, executor: adapter, at: isoTick(3) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    run = result.run;

    expect(run.state).toBe("FAILED");
    expect(run.result?.syntheticProtocol).toBeNull();
    expect(run.pendingSteps, "timeout não avança a fila").toHaveLength(pendingBefore);
  } finally {
    await adapter.dispose();
  }
});
