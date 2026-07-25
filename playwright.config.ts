import { defineConfig, devices } from "@playwright/test";

/**
 * Fase 8B — Automacao Playwright contra o laboratorio SINTETICO (docs/28).
 *
 * ESCOPO INEGOCIAVEL:
 * - Alvo unico: a rota fake `/admin/lab/guia-trafego` em `localhost`.
 * - NENHUMA URL externa. NENHUM Gov.br/SINARM. NENHUM site publico real.
 * - Sem credenciais reais: o login usa o mecanismo mock/dev existente (Fase 2).
 *
 * O `webServer` sobe o app local (`npm run dev`) so para o teste e o derruba
 * ao final. A prova de prontidao aponta para `/login` (rota que NAO toca o banco).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // ISOLAMENTO: os testes da Fase 9 tem config PROPRIA e SEGURA
  // (`playwright.phase9.config.ts`, com screenshot/video/trace OFF). Esta config do
  // laboratorio sintetico grava evidencias — nunca deve capturar um teste da Fase 9
  // (docs/35 §3). Por isso ignoramos a pasta phase9 aqui. NAO altera o comportamento
  // do laboratorio sintetico; apenas impede vazamento de escopo entre as configs.
  testIgnore: "**/phase9/**",
  // Um unico fluxo, deterministico: sem paralelismo, sem retries.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    // baseURL LOCAL — todo goto('/...') resolve para localhost. Nunca externo.
    baseURL: "http://localhost:3000",
    // Evidencias sempre geradas (docs/28 §evidencias). Ficam em test-results/
    // (gitignored).
    screenshot: "on",
    video: "on",
    trace: "on",
  },

  // Chromium apenas (instalacao minima — sem Firefox/WebKit).
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Sobe o app local so para o teste. reuseExistingServer local: se ja houver
  // um dev server em 3000, reaproveita.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
