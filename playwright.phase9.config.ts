import { defineConfig, devices } from "@playwright/test";

/**
 * Fase 9 — Configuracao SEGURA e SEPARADA (docs/33, docs/34, docs/35).
 *
 * Este arquivo NAO substitui `playwright.config.ts` (laboratorio sintetico).
 * Ele so roda quando chamado EXPLICITAMENTE:
 *   - npm run test:e2e:phase9
 *   - npm run test:e2e:phase9:headed
 *
 * REGRAS DE SEGURANCA (docs/35 §4/§5/§6):
 * - `trace: "off"`      — nenhum trace automatico (o trace registra rede/DOM/PII).
 * - `video: "off"`      — nenhum video automatico.
 * - `screenshot: "off"` — nenhuma captura automatica; se algum dia for preciso,
 *                          sera manual e mascarada, nunca fullPage automatico.
 * - Sem `storageState` persistente: contexto novo por execucao (default Playwright),
 *   sem cookies/localStorage/sessionStorage salvos entre runs.
 * - Sem profile persistente (nao usa launchPersistentContext).
 * - `outputDir` proprio e gitignored (tests/e2e/phase9-artifacts).
 * - SEM `webServer`: esta config NUNCA sobe/aponta para servico real.
 *
 * ESCOPO ATUAL: a Fase 9 real ainda NAO esta autorizada (docs/34 §16 pendente).
 * NENHUMA URL Gov.br/SINARM aqui. Os testes desta config so tocam `localhost`.
 */
export default defineConfig({
  testDir: "./tests/e2e/phase9",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],

  // Artifacts em pasta SEPARADA da config do sintetico (e gitignored — ver .gitignore).
  // Subpasta `runs/`: o Playwright LIMPA o outputDir a cada execucao, entao mantemos
  // o `.gitkeep` no diretorio-pai (tests/e2e/phase9-artifacts/) fora do alcance da
  // limpeza. Assim a pasta segue versionada e os artifacts ficam ignorados.
  outputDir: "./tests/e2e/phase9-artifacts/runs",

  use: {
    // Evidencias automaticas DESLIGADAS por padrao (docs/35 §4).
    trace: "off",
    video: "off",
    screenshot: "off",

    // Sessao efemera: nenhum estado de sessao persistente (docs/35 §6).
    // `undefined` = contexto limpo por teste, sem cookies/tokens reaproveitados.
    storageState: undefined,

    // Sem baseURL para host real: cada teste fornece o proprio alvo localhost.
  },

  // Chromium apenas — contexto novo por execucao (default), sem profile persistente.
  projects: [
    {
      name: "phase9-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Intencionalmente SEM `webServer`: a config da Fase 9 nunca inicia um servico
  // real nem depende de subir a app. O smoke local sobe seu proprio servidor
  // efemero em 127.0.0.1 (ver tests/e2e/phase9/phase9-config-smoke.spec.ts).
});
