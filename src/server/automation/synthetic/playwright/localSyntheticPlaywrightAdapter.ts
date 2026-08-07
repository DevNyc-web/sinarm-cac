/**
 * Adaptador LOCAL: implementa `SyntheticStepExecutor` contra o laboratório
 * fictício `/admin/lab/guia-trafego`, via Playwright. Só existe aqui — o
 * coordenador (`syntheticRunCoordinator.ts`) nunca importa Playwright, e este
 * arquivo nunca é importado por ele.
 *
 * Escopo inegociável, verificado ANTES de abrir qualquer navegador:
 * - a base URL só pode ser `http://localhost[:porta]` ou `http://127.0.0.1[:porta]`
 *   (`assertLoopbackBaseUrl`, lançado no construtor);
 * - toda requisição da página passa por `context.route()`: o que não é
 *   loopback é ABORTADO, não só observado — inclusive recurso de terceiro
 *   (imagem, script) carregado pela própria página;
 * - toda navegação (goto, clique que navega, redirect) é conferida depois do
 *   fato — sair do loopback interrompe com `LOCAL_NAVIGATION_BLOCKED`.
 *
 * Não é a Fase 9: não importa `phase9/`, não usa a config
 * `playwright.phase9.config.ts` e não liga execução real.
 */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { assertLoopbackBaseUrl, isLoopbackUrl } from "./localSyntheticNetworkGuard";
import type {
  SyntheticStepExecutionInput,
  SyntheticStepExecutionResult,
  SyntheticStepExecutionOutcome,
  SyntheticStepExecutor,
} from "./syntheticStepExecutor";

const GUIA_TRAFEGO_ROUTE = "/admin/lab/guia-trafego";
const EQUIPE_ROUTE = "/equipe";
const PROTOCOL_PREFIX = "PROT-FICT-";

/** Timeout curto e explícito — nunca o default longo do Playwright. */
const DEFAULT_TIMEOUT_MS = 5_000;

/** Valores claramente fictícios exigidos pelo escopo desta PR — nunca formato de CPF. */
const FICTITIOUS_VALUES = {
  evento: "DADO-FICTICIO",
  logradouro: "PROCESSO-LOCAL",
  justificativa: "JUSTIFICATIVA-FICTICIA",
} as const;

/** Lançado internamente quando qualquer navegação sai do loopback — nunca escapa como erro bruto. */
class LocalNavigationBlockedError extends Error {
  constructor(url: string) {
    super(`navegação bloqueada fora do loopback: ${url}`);
    this.name = "LocalNavigationBlockedError";
  }
}

export interface LocalSyntheticPlaywrightAdapterOptions {
  /** Precisa ser loopback — validado ANTES de abrir o navegador. */
  baseUrl: string;
  /** Cenário nativo do laboratório fictício (docs/27/§30) — "normal" por padrão. */
  scenario?: string;
  timeoutMs?: number;
}

export class LocalSyntheticPlaywrightAdapter implements SyntheticStepExecutor {
  private readonly baseUrl: string;
  private readonly scenario: string;
  private readonly timeoutMs: number;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly blockedRequestUrls: string[] = [];

  constructor(options: LocalSyntheticPlaywrightAdapterOptions) {
    const check = assertLoopbackBaseUrl(options.baseUrl);
    if (!check.allowed) {
      throw new Error(`base URL recusada pelo guard de loopback: ${check.reason}`);
    }
    this.baseUrl = options.baseUrl;
    this.scenario = options.scenario ?? "normal";
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** URLs abortadas pelo guard de rede nesta sessão — prova negativa para os testes. */
  getBlockedRequestUrls(): readonly string[] {
    return [...this.blockedRequestUrls];
  }

  /**
   * @internal Só para o spec Playwright provar que o `context.route` real
   * bloqueia navegação/requisição externa. Nenhum produtor deste pacote deve
   * usar isso para pilotar a página por fora dos 4 tipos de etapa.
   */
  getPageForTesting(): Page | null {
    return this.page;
  }

  async execute(input: SyntheticStepExecutionInput): Promise<SyntheticStepExecutionResult> {
    try {
      const page = await this.ensurePage();
      switch (input.type) {
        case "VALIDATE_INPUT":
          return await this.runValidateInput(page, input);
        case "OPEN_FORM":
          return await this.runOpenForm(page, input);
        case "FILL_FORM":
          return await this.runFillForm(page, input);
        case "CONFIRM_RESULT":
          return await this.runConfirmResult(page, input);
      }
    } catch (error) {
      return this.classifyError(input.stepId, error);
    }
  }

  async dispose(): Promise<void> {
    await this.page?.close().catch(() => undefined);
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  // ---------------------------------------------------------------- setup

  private async ensurePage(): Promise<Page> {
    if (this.page) return this.page;

    this.browser = await chromium.launch();
    this.context = await this.browser.newContext();

    // Bloqueio de rede DURO: aborta qualquer requisição fora do loopback,
    // inclusive recurso de terceiro carregado pela própria página.
    await this.context.route("**/*", (route) => {
      const url = route.request().url();
      if (isLoopbackUrl(url)) return route.continue();
      this.blockedRequestUrls.push(url);
      return route.abort();
    });

    this.page = await this.context.newPage();
    await this.loginAsAdmin(this.page);
    return this.page;
  }

  private async loginAsAdmin(page: Page): Promise<void> {
    await page.goto(`${this.baseUrl}${EQUIPE_ROUTE}`, { timeout: this.timeoutMs });
    this.assertCurrentUrlLoopback(page);
    await page.getByRole("button", { name: "Admin Exemplo" }).click({ timeout: this.timeoutMs });
    await page.waitForURL("**/admin", { timeout: this.timeoutMs });
    this.assertCurrentUrlLoopback(page);
  }

  private assertCurrentUrlLoopback(page: Page): void {
    const url = page.url();
    if (!isLoopbackUrl(url)) throw new LocalNavigationBlockedError(url);
  }

  // ------------------------------------------------------------- 4 etapas

  /** Verifica que a página fictícia carregou e o indicador sintético está visível — não preenche nada. */
  private async runValidateInput(
    page: Page,
    input: SyntheticStepExecutionInput,
  ): Promise<SyntheticStepExecutionResult> {
    await page.goto(`${this.baseUrl}${GUIA_TRAFEGO_ROUTE}?scenario=${this.scenario}`, {
      timeout: this.timeoutMs,
    });
    this.assertCurrentUrlLoopback(page);
    await page.getByTestId("scenario-selector").waitFor({ state: "visible", timeout: this.timeoutMs });
    return this.success(input.stepId, "página fictícia carregada; indicador sintético visível");
  }

  /** Abre o formulário fictício (até a etapa de destino) e confirma que ficou visível. */
  private async runOpenForm(
    page: Page,
    input: SyntheticStepExecutionInput,
  ): Promise<SyntheticStepExecutionResult> {
    await page.getByTestId("lab-start").click({ timeout: this.timeoutMs });
    await page.getByRole("button", { name: "Continuar" }).click({ timeout: this.timeoutMs }); // solicitante -> servico
    await page.getByTestId("service-select").click({ timeout: this.timeoutMs }); // servico -> destino
    await page.getByTestId("destination-form").waitFor({ state: "visible", timeout: this.timeoutMs });
    this.assertCurrentUrlLoopback(page);
    return this.success(input.stepId, "formulário fictício aberto");
  }

  /** Preenche somente dados claramente fictícios e avança até a revisão. */
  private async runFillForm(
    page: Page,
    input: SyntheticStepExecutionInput,
  ): Promise<SyntheticStepExecutionResult> {
    await page.getByLabel("Nome do evento/clube").fill(FICTITIOUS_VALUES.evento, { timeout: this.timeoutMs });
    await page.getByLabel("Logradouro").fill(FICTITIOUS_VALUES.logradouro, { timeout: this.timeoutMs });
    await page.getByRole("button", { name: "Continuar" }).click({ timeout: this.timeoutMs }); // destino -> arma

    await page.getByTestId("weapon-select-fict-001").click({ timeout: this.timeoutMs });
    await page.getByRole("button", { name: "Continuar" }).click({ timeout: this.timeoutMs }); // arma -> documento
    await page.getByRole("button", { name: "Continuar" }).click({ timeout: this.timeoutMs }); // documento -> justificativa

    await page
      .getByLabel("Justificativa")
      .fill(FICTITIOUS_VALUES.justificativa, { timeout: this.timeoutMs });
    await page.getByRole("button", { name: "Continuar" }).click({ timeout: this.timeoutMs }); // justificativa -> revisao

    await page.getByTestId("review-confirm-checkbox").check({ timeout: this.timeoutMs });
    this.assertCurrentUrlLoopback(page);
    return this.success(input.stepId, "dados fictícios preenchidos até a revisão");
  }

  /**
   * Confirma o resultado fictício. Se o marcador local de pausa humana
   * aparecer, para ali — nunca clica em "resolver", nunca tenta prosseguir.
   */
  private async runConfirmResult(
    page: Page,
    input: SyntheticStepExecutionInput,
  ): Promise<SyntheticStepExecutionResult> {
    await page.getByTestId("continue-to-gru").click({ timeout: this.timeoutMs });

    const nextMarker = page.locator(
      '[data-testid="human-review-required"], [data-testid="fake-gru-screen"], [data-testid="exception-message"]',
    );
    await nextMarker.first().waitFor({ state: "visible", timeout: this.timeoutMs });

    if (await page.getByTestId("human-review-required").isVisible()) {
      // Captcha sintético equivalente: pausa antes do ato sensível. Sem bypass.
      return { outcome: "CAPTCHA_DETECTED", stepId: input.stepId, detail: "pausa humana sintética detectada", capturedProtocol: null };
    }
    if (!(await page.getByTestId("fake-gru-screen").isVisible())) {
      return this.pageMismatch(input.stepId, "tela da GRU fictícia não apareceu como esperado");
    }

    await page.getByTestId("generate-fake-gru").click({ timeout: this.timeoutMs });

    const outcomeMarker = page.locator('[data-testid="fake-success"], [data-testid="exception-message"]');
    await outcomeMarker.first().waitFor({ state: "visible", timeout: this.timeoutMs });

    if (!(await page.getByTestId("fake-success").isVisible())) {
      return this.pageMismatch(input.stepId, "resultado fictício não confirmou sucesso");
    }

    const protocol = (await page.getByTestId("fake-protocol-number").textContent())?.trim() ?? "";
    if (!protocol.startsWith(PROTOCOL_PREFIX)) {
      return this.pageMismatch(input.stepId, "protocolo capturado fora do padrão sintético");
    }
    this.assertCurrentUrlLoopback(page);
    return { outcome: "SUCCESS", stepId: input.stepId, detail: "resultado fictício confirmado", capturedProtocol: protocol };
  }

  // -------------------------------------------------------------- helpers

  private success(stepId: string, detail: string): SyntheticStepExecutionResult {
    return { outcome: "SUCCESS", stepId, detail, capturedProtocol: null };
  }

  private pageMismatch(stepId: string, detail: string): SyntheticStepExecutionResult {
    return { outcome: "PAGE_MISMATCH", stepId, detail, capturedProtocol: null };
  }

  /**
   * Erro bruto do Playwright NUNCA vira evidência: aqui ele é classificado em
   * um dos 6 resultados fechados, com um rótulo fixo — nunca `error.message`
   * nem `error.stack`.
   */
  private classifyError(stepId: string, error: unknown): SyntheticStepExecutionResult {
    const outcome: SyntheticStepExecutionOutcome =
      error instanceof LocalNavigationBlockedError
        ? "LOCAL_NAVIGATION_BLOCKED"
        : isTimeoutError(error)
          ? "TIMEOUT"
          : "STEP_UNAVAILABLE";

    const detail =
      outcome === "LOCAL_NAVIGATION_BLOCKED"
        ? "navegação saiu do loopback"
        : outcome === "TIMEOUT"
          ? "tempo limite sintético excedido"
          : "etapa fictícia indisponível no estado atual";

    return { outcome, stepId, detail, capturedProtocol: null };
  }
}

function isTimeoutError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name: unknown }).name === "TimeoutError";
}
