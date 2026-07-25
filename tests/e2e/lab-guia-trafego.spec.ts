import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Request } from "@playwright/test";
import {
  buildLabRunReport,
  type LabRunStatus,
  type LabStepInput,
} from "../../src/server/automation/lab/labRunReport";

/**
 * Fase 8B/8C/8D — Automacao Playwright contra o laboratorio SINTETICO
 * (docs/28, docs/30, docs/37).
 *
 * - Fase 8B: caminho feliz ponta a ponta.
 * - Fase 8C: cada CENARIO DE EXCECAO falha com seguranca — para o fluxo, mostra o
 *   erro, NAO gera sucesso/protocolo fake, e so faz retry quando explicitamente
 *   permitido.
 * - Fase 8D: cada execucao emite um RELATORIO estruturado e seguro em
 *   `tests/e2e/artifacts/` (gitignored), e o proprio teste prova que nenhum
 *   segredo sobreviveu ao relatorio.
 *
 * LIMITES (verificados pelo proprio teste via "guarda de rede"):
 * - So `localhost`. NENHUM Gov.br/SINARM. NENHUM site publico real.
 * - So dados FICTICIOS. Sem upload real, sem pagamento real, sem protocolo real.
 */

const LAB_ROUTE = "/admin/lab/guia-trafego";
const ARTIFACTS_DIR = path.join("tests", "e2e", "artifacts");
/** Mesmo caminho em POSIX — e o formato que o relatorio aceita. */
const ARTIFACTS_ROOT_POSIX = "tests/e2e/artifacts";

// Dominios que o teste JAMAIS pode tocar (prova negativa de escopo).
const FORBIDDEN = /gov\.br|servicos\.pf|sinarm|acesso\.gov/i;

function isLocal(url: string): boolean {
  if (/^(about:|data:|blob:)/i.test(url)) return true;
  return /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
}

/** Guard de rede: acumula qualquer requisicao externa/proibida. */
function attachNetworkGuard(page: Page): string[] {
  const offenders: string[] = [];
  page.on("request", (req: Request) => {
    const url = req.url();
    if (!isLocal(url) || FORBIDDEN.test(url)) offenders.push(url);
  });
  return offenders;
}

// ================================================ relatorio seguro (Fase 8D)

/** Termos que JAMAIS podem aparecer no relatorio serializado. */
const SECRET_MARKERS = [/senha/i, /password/i, /\btoken\b/i, /cookie/i, /\botp\b/i, /authorization/i];

interface EmitReportOptions {
  scenario: string;
  status: LabRunStatus;
  startedAt: Date;
  steps: LabStepInput[];
  offenders: string[];
  artifacts?: string[];
  errors?: unknown[];
  syntheticProtocol?: string | null;
}

/**
 * Monta o relatorio, grava em `tests/e2e/artifacts/` (gitignored) e AFIRMA que
 * ele e sintetico e nao carrega segredo. Devolve o texto serializado.
 *
 * Nao altera o laboratorio: apenas observa e registra.
 */
function emitLabReport(options: EmitReportOptions): string {
  const report = buildLabRunReport({
    scenario: options.scenario,
    status: options.status,
    startedAt: options.startedAt,
    finishedAt: new Date(),
    steps: options.steps,
    artifacts: options.artifacts ?? [],
    networkPolicy: {
      allowedHosts: ["localhost", "127.0.0.1"],
      externalAccessAllowed: false,
      offenders: options.offenders,
    },
    errors: options.errors ?? [],
    syntheticProtocol: options.syntheticProtocol ?? null,
  });

  // Marcacao obrigatoria: ninguem pode confundir com execucao real.
  expect(report.kind).toBe("LAB_SINTETICO");
  expect(report.synthetic).toBe(true);
  expect(report.disclaimer).toContain("LABORATÓRIO SINTÉTICO");
  expect(report.networkPolicy.externalAccessAllowed).toBe(false);
  expect(report.networkPolicy.offenders).toEqual([]);

  const serialized = JSON.stringify(report, null, 2);

  // Prova negativa de segredo. Uma chave redigida pode NOMEAR o segredo
  // (`"token": "[REDACTED]"`) — isso e auditoria, nao vazamento. O que nao pode
  // e o termo aparecer em qualquer outro lugar, entao os pares ja redigidos sao
  // retirados antes da checagem e o resto tem de estar limpo.
  const withoutRedactedPairs = serialized.replace(
    /"[^"]*"\s*:\s*"\[REDACTED\]"/g,
    '"[REDACTED_PAIR]"',
  );
  for (const marker of SECRET_MARKERS) {
    expect(withoutRedactedPairs, `relatorio contem termo sensivel ${marker}`).not.toMatch(marker);
  }

  // Prova negativa de escopo: toda URL citada no relatorio e local. (O texto do
  // disclaimer cita Gov.br/SINARM de proposito, para dizer que NAO os acessa —
  // por isso a checagem e sobre URL, nao sobre a palavra.)
  for (const url of serialized.match(/\b(?:https?|wss?):\/\/[^\s"']+/gi) ?? []) {
    expect(url).toMatch(/^(?:https?|wss?):\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i);
  }

  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(
    path.join(ARTIFACTS_DIR, `lab-run-report-${options.scenario}-${Date.now()}.json`),
    serialized,
    "utf8",
  );

  return serialized;
}

function step(name: string, status: LabStepInput["status"]): LabStepInput {
  return { name, status };
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: "Admin Exemplo" }).click();
  await page.waitForURL("**/admin");
}

async function openLab(page: Page, scenario?: string): Promise<void> {
  await page.goto(scenario ? `${LAB_ROUTE}?scenario=${scenario}` : LAB_ROUTE);
  await expect(
    page.getByRole("heading", { name: "Laboratório — Guia de Tráfego (sintético)" }),
  ).toBeVisible();
  await expect(page.getByTestId("scenario-selector")).toBeVisible();
}

/** aviso -> solicitante -> servico. */
async function startFlow(page: Page): Promise<void> {
  await page.getByTestId("lab-start").click();
  await page.getByRole("button", { name: "Continuar" }).click(); // solicitante
  await page.getByTestId("service-select").click(); // servico -> destino
}

async function fillDestino(page: Page): Promise<void> {
  await expect(page.getByTestId("destination-form")).toBeVisible();
  await page.getByLabel("Nome do evento/clube").fill("Clube Fictício Playwright");
  await page.getByLabel("UF").fill("SP");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("Logradouro").fill("Rua de Teste Automatizado");
  await page.getByLabel("Número").fill("123");
  await page.getByLabel("Complemento").fill("Laboratório sintético");
}

/** Vai do inicio ate a etapa de revisao (com arma FICT-001 selecionada). */
async function traverseToReview(page: Page): Promise<void> {
  await startFlow(page);
  await fillDestino(page);
  await page.getByRole("button", { name: "Continuar" }).click(); // destino -> arma
  await page.getByTestId("weapon-select-fict-001").click();
  await page.getByRole("button", { name: "Continuar" }).click(); // arma -> documento
  await page.getByRole("button", { name: "Continuar" }).click(); // documento -> justificativa
  await page.getByRole("button", { name: "Continuar" }).click(); // justificativa -> revisao
  await expect(page.getByRole("heading", { name: "Revisão antes da GRU (fictícia)" })).toBeVisible();
}

/** Vai ate a tela fake "Dados da GRU". */
async function traverseToGru(page: Page): Promise<void> {
  await traverseToReview(page);
  await page.getByTestId("review-confirm-checkbox").check();
  await page.getByTestId("continue-to-gru").click();
  await expect(page.getByTestId("fake-gru-screen")).toBeVisible();
}

// ============================================================ caminho feliz

test("caminho feliz: laboratorio sintetico roda ponta a ponta (fake)", async ({ page }) => {
  const startedAt = new Date();
  const offenders = attachNetworkGuard(page);

  await loginAdmin(page);
  await openLab(page);

  const body = page.locator("body");
  await expect(body).toContainText("Laboratório sintético");
  await expect(body).toContainText("não é o Gov.br");
  await expect(body).toContainText("não é o SINARM");
  await expect(body).toContainText("fictício");
  await expect(body).toContainText("Não oficial");

  await traverseToGru(page);

  // conferencia da GRU fake
  const gruScreen = page.getByTestId("fake-gru-screen");
  await expect(gruScreen).toContainText("REF-FICT-0001");
  await expect(gruScreen).toContainText("R$ 20,00");
  await expect(page.getByText("Esta GRU é fictícia. Não pague. Não possui validade.")).toBeVisible();

  await page.getByTestId("generate-fake-gru").click();

  const success = page.getByTestId("fake-success");
  await expect(success).toBeVisible();
  await expect(page.getByTestId("fake-protocol-number")).toHaveText("PROT-FICT-0001");
  await expect(page.getByTestId("fake-gru-reference")).toHaveText("REF-FICT-0001");
  await expect(success).toContainText("Nenhum processo real foi protocolado");

  // evidencia local (screenshot da tela final)
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const screenshotName = `lab-final-${Date.now()}.png`;
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, screenshotName),
    fullPage: true,
  });

  expect(offenders, `requisicoes externas/proibidas: ${offenders.join(", ")}`).toEqual([]);

  // Fase 8D — relatorio estruturado da execucao (gitignored).
  const serialized = emitLabReport({
    scenario: "normal",
    status: "SUCESSO",
    startedAt,
    offenders,
    steps: [
      step("abrir laboratorio", "OK"),
      step("percorrer etapas ate a GRU ficticia", "OK"),
      step("gerar GRU ficticia", "OK"),
    ],
    artifacts: [`${ARTIFACTS_ROOT_POSIX}/${screenshotName}`],
    // Protocolo SINTETICO — o mesmo que a tela fake exibe.
    syntheticProtocol: "PROT-FICT-0001",
  });

  const report = JSON.parse(serialized);
  expect(report.status).toBe("SUCESSO");
  expect(report.syntheticProtocol).toBe("PROT-FICT-0001");
  expect(report.artifacts).toEqual([`${ARTIFACTS_ROOT_POSIX}/${screenshotName}`]);
  expect(report.steps).toHaveLength(3);
});

// ============================================================ excecoes (8C)

test("sessao expirada: pausa segura, sem sucesso fake", async ({ page }) => {
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page, "session-expired");

  await page.getByTestId("lab-start").click();

  await expect(page.getByTestId("exception-banner")).toBeVisible();
  await expect(page.getByTestId("exception-message")).toContainText("Sessão fictícia expirada");
  await expect(page.getByTestId("no-success-assertion-marker")).toBeAttached();
  await expect(page.getByTestId("fake-success")).toHaveCount(0);
  await expect(page.getByTestId("fake-gru-screen")).toHaveCount(0);

  expect(offenders).toEqual([]);
});

test("campo obrigatorio invalido: bloqueia avanco e mostra erro", async ({ page }) => {
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page, "invalid-field");

  await startFlow(page); // chega ao destino com Cidade vazia
  await expect(page.getByTestId("destination-form")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByTestId("exception-message")).toContainText("Campo obrigatório");
  // continua na etapa de destino — nao avancou
  await expect(page.getByTestId("destination-form")).toBeVisible();
  await expect(page.getByTestId("fake-gru-screen")).toHaveCount(0);
  await expect(page.getByTestId("fake-success")).toHaveCount(0);

  expect(offenders).toEqual([]);
});

test("arma ambigua: exige selecao manual, sem auto-avanco", async ({ page }) => {
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page, "weapon-ambiguous");

  await startFlow(page);
  await fillDestino(page);
  await page.getByRole("button", { name: "Continuar" }).click(); // -> arma

  await expect(page.getByRole("heading", { name: "Arma/PCE (fictícia)" })).toBeVisible();
  await expect(page.getByTestId("human-review-required")).toBeVisible();
  await expect(page.getByTestId("exception-message")).toContainText("não conseguiu decidir");
  // sem selecao, nao avanca
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await expect(page.getByTestId("fake-success")).toHaveCount(0);

  expect(offenders).toEqual([]);
});

test("documento ausente: bloqueia continuidade", async ({ page }) => {
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page, "missing-document");

  await startFlow(page);
  await fillDestino(page);
  await page.getByRole("button", { name: "Continuar" }).click(); // -> arma
  await page.getByTestId("weapon-select-fict-001").click();
  await page.getByRole("button", { name: "Continuar" }).click(); // -> documento

  await expect(page.getByTestId("exception-message")).toContainText("Documento fictício ausente");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await expect(page.getByTestId("fake-gru-screen")).toHaveCount(0);
  await expect(page.getByTestId("fake-success")).toHaveCount(0);

  expect(offenders).toEqual([]);
});

test("falha ao gerar GRU: sem protocolo, com retry seguro visivel", async ({ page }) => {
  const startedAt = new Date();
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page, "gru-failure");

  await traverseToGru(page);
  await page.getByTestId("generate-fake-gru").click();

  await expect(page.getByTestId("exception-message")).toContainText("Falha fictícia ao gerar GRU");
  await expect(page.getByTestId("fake-success")).toHaveCount(0);
  await expect(page.getByTestId("fake-protocol-number")).toHaveCount(0);
  await expect(page.getByTestId("retry-button")).toBeVisible();

  expect(offenders).toEqual([]);

  // Fase 8D — a falha tem relatorio, e o relatorio NAO tem protocolo. Mesmo que
  // a execucao insista em passar um, o builder descarta.
  const serialized = emitLabReport({
    scenario: "gru-failure",
    status: "FALHA",
    startedAt,
    offenders,
    steps: [step("percorrer etapas ate a GRU ficticia", "OK"), step("gerar GRU ficticia", "FALHOU")],
    errors: [new Error("Falha fictícia ao gerar GRU")],
    syntheticProtocol: "PROT-FICT-0001",
  });

  const report = JSON.parse(serialized);
  expect(report.status).toBe("FALHA");
  expect(report.syntheticProtocol).toBeNull();
  expect(serialized).not.toContain("PROT-FICT-0001");
  expect(report.errors[0].message).toContain("Falha fictícia ao gerar GRU");
  expect(report.errors[0]).not.toHaveProperty("stack");
});

test("relatorio 8D: meta envenenada com segredo nao sobrevive a serializacao", async ({ page }) => {
  const startedAt = new Date();
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page);

  // Simula um passo cujo `meta` foi contaminado com segredo/PII FICTICIOS. Nada
  // disso vem da pagina: e um envenenamento deliberado para provar a redacao.
  const serialized = emitLabReport({
    scenario: "normal",
    status: "PAUSA_HUMANA",
    startedAt,
    offenders,
    steps: [
      {
        name: "login ficticio",
        status: "BLOQUEADO",
        meta: {
          senha: "SenhaFicticia123",
          token: "eyJhbGciOiJIUzI1NiJ9.ficticio",
          cookie: "session=abc123",
          otp: "123456",
          authorization: "Bearer ficticio-abc",
          cpf: "123.456.789-09",
          email: "fulano.teste@example.com",
          uf: "SP",
        },
      },
    ],
  });

  for (const secret of [
    "SenhaFicticia123",
    "eyJhbGciOiJIUzI1NiJ9.ficticio",
    "session=abc123",
    "Bearer ficticio-abc",
    "123.456.789-09",
    "fulano.teste@example.com",
  ]) {
    expect(serialized, `"${secret}" vazou no relatorio`).not.toContain(secret);
  }

  const report = JSON.parse(serialized);
  expect(report.steps[0].meta.senha).toBe("[REDACTED]");
  expect(report.steps[0].meta.uf).toBe("SP");
  expect(report.syntheticProtocol).toBeNull();
  expect(report.redactionSummary.total).toBeGreaterThan(0);

  expect(offenders).toEqual([]);
});

test("instabilidade fake do orgao: bloqueia inicio do fluxo", async ({ page }) => {
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page, "external-instability");

  await expect(page.getByTestId("exception-message")).toContainText(
    "Serviço externo fictício indisponível",
  );
  await expect(page.locator("body")).toContainText("Bloqueado por instabilidade fictícia");
  await expect(page.getByTestId("lab-start")).toHaveCount(0); // nao ha como iniciar
  await expect(page.getByTestId("fake-success")).toHaveCount(0);

  expect(offenders).toEqual([]);
});

test("pausa para humano: fluxo para antes do ato sensivel", async ({ page }) => {
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page, "human-pause");

  await traverseToReview(page);
  await page.getByTestId("review-confirm-checkbox").check();
  await page.getByTestId("continue-to-gru").click();

  await expect(page.getByTestId("human-review-required")).toBeVisible();
  await expect(page.getByTestId("exception-message")).toContainText("Intervenção humana necessária");
  await expect(page.getByTestId("fake-gru-screen")).toHaveCount(0);
  await expect(page.getByTestId("fake-success")).toHaveCount(0);

  expect(offenders).toEqual([]);
});

test("retry permitido: sucesso so apos retry explicito", async ({ page }) => {
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page, "retry");

  await traverseToGru(page);
  await page.getByTestId("generate-fake-gru").click(); // tentativa 1 falha

  await expect(page.getByTestId("exception-message")).toContainText("Tentativa 1 falhou");
  await expect(page.getByTestId("fake-success")).toHaveCount(0); // ainda sem sucesso

  await page.getByTestId("retry-button").click(); // tentativa 2 (explicita)

  await expect(page.getByTestId("fake-success")).toBeVisible();
  await expect(page.getByTestId("fake-protocol-number")).toHaveText("PROT-FICT-0001");
  await expect(page.locator("body")).toContainText("Tentativa 2 concluída");

  expect(offenders).toEqual([]);
});

test("bloqueio operacional: exige motivo e nao gera sucesso", async ({ page }) => {
  const offenders = attachNetworkGuard(page);
  await loginAdmin(page);
  await openLab(page, "operational-block");

  await expect(page.getByTestId("operational-block-message")).toContainText(
    "Laboratório bloqueado operacionalmente",
  );
  await expect(page.getByLabel("Motivo fictício do bloqueio")).toBeVisible();
  await expect(page.getByTestId("lab-start")).toHaveCount(0);
  await expect(page.getByTestId("no-success-assertion-marker")).toBeAttached();
  await expect(page.getByTestId("fake-success")).toHaveCount(0);

  expect(offenders).toEqual([]);
});
