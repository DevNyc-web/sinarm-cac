import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Request } from "@playwright/test";

/**
 * Fase 8B — Automacao Playwright contra o laboratorio SINTETICO (docs/27/§28).
 *
 * Prova, de ponta a ponta, que a automacao determinista consegue:
 *   abrir o lab -> autenticar (mock/dev) -> preencher destino ficticio ->
 *   selecionar arma ficticia -> validar documento ficticio -> confirmar revisao
 *   -> chegar a tela fake "Dados da GRU" -> gerar GRU ficticia -> validar
 *   protocolo ficticio -> salvar evidencia local.
 *
 * LIMITES (verificados pelo proprio teste, ver "guarda de rede" abaixo):
 * - So `localhost`. NENHUM Gov.br/SINARM. NENHUM site publico real.
 * - So dados FICTICIOS. Sem upload real, sem pagamento real, sem protocolo real.
 */

const LAB_ROUTE = "/admin/lab/guia-trafego";
const ARTIFACTS_DIR = path.join("tests", "e2e", "artifacts");

// Dominios que o teste JAMAIS pode tocar (prova negativa de escopo).
const FORBIDDEN = /gov\.br|servicos\.pf|sinarm|acesso\.gov/i;

function isLocal(url: string): boolean {
  if (/^(about:|data:|blob:)/i.test(url)) return true;
  return /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
}

test("laboratorio sintetico da Guia de Trafego roda ponta a ponta (fake)", async ({ page }) => {
  // ---- guarda de rede: registra qualquer requisicao externa ou proibida ----
  const offenders: string[] = [];
  page.on("request", (req: Request) => {
    const url = req.url();
    if (!isLocal(url) || FORBIDDEN.test(url)) offenders.push(url);
  });

  // ---- 1) login mock/dev existente (Fase 2): clicar o perfil Admin ----------
  await page.goto("/login");
  await page.getByRole("button", { name: "Admin Exemplo" }).click();
  await page.waitForURL("**/admin");

  // ---- 2/3) abrir o laboratorio sintetico -----------------------------------
  await page.goto(LAB_ROUTE);
  await expect(
    page.getByRole("heading", { name: "Laboratório — Guia de Tráfego (sintético)" }),
  ).toBeVisible();

  // ---- 4) validar aviso inicial (ambiente sintetico / nao oficial) ----------
  const body = page.locator("body");
  await expect(body).toContainText("Laboratório sintético");
  await expect(body).toContainText("não é o Gov.br");
  await expect(body).toContainText("não é o SINARM");
  await expect(body).toContainText("fictício");
  await expect(body).toContainText("Não oficial");

  await page.getByTestId("lab-start").click();

  // solicitante (fake) — apenas exibicao
  await expect(page.getByRole("heading", { name: "Dados do solicitante (fictício)" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // servico (fake)
  await expect(page.getByRole("heading", { name: "Seleção de serviço (fictício)" })).toBeVisible();
  await page.getByTestId("service-select").click();

  // ---- 5) preencher destino ficticio ----------------------------------------
  await expect(page.getByTestId("destination-form")).toBeVisible();
  await page.getByLabel("Nome do evento/clube").fill("Clube Fictício Playwright");
  await page.getByLabel("UF").fill("SP");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("Logradouro").fill("Rua de Teste Automatizado");
  await page.getByLabel("Número").fill("123");
  await page.getByLabel("Complemento").fill("Laboratório sintético");
  await page.getByRole("button", { name: "Continuar" }).click();

  // ---- 6) selecionar arma ficticia (com prova do gate desabilitado) ---------
  await expect(page.getByRole("heading", { name: "Arma/PCE (fictícia)" })).toBeVisible();
  await expect(page.getByTestId("weapon-table")).toBeVisible();
  const armaContinue = page.getByRole("button", { name: "Continuar" });
  await expect(armaContinue).toBeDisabled();
  await page.getByTestId("weapon-select-fict-001").click();
  await expect(armaContinue).toBeEnabled();
  await armaContinue.click();

  // ---- 7) validar documento ficticio ----------------------------------------
  await expect(page.getByRole("heading", { name: "Documento (fictício)" })).toBeVisible();
  const docStatus = page.getByTestId("fake-document-status");
  await expect(docStatus).toContainText("documento-ficticio.pdf");
  await expect(docStatus).toContainText("documento fictício carregado");
  await page.getByRole("button", { name: "Continuar" }).click();

  // justificativa (fake)
  await expect(
    page.getByRole("heading", { name: "Observações / justificativa (fictícia)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // ---- 8) confirmar revisao (gate: nao libera sem o checkbox) ---------------
  await expect(page.getByRole("heading", { name: "Revisão antes da GRU (fictícia)" })).toBeVisible();
  // os dados que a automacao preencheu/selecionou aparecem no resumo
  await expect(body).toContainText("Clube Fictício Playwright");
  await expect(body).toContainText("FICT-001");

  const continueToGru = page.getByTestId("continue-to-gru");
  await expect(continueToGru).toBeDisabled();
  await page.getByTestId("review-confirm-checkbox").check();
  await expect(continueToGru).toBeEnabled();
  await continueToGru.click();

  // ---- 9) validar tela fake "Dados da GRU" ----------------------------------
  const gruScreen = page.getByTestId("fake-gru-screen");
  await expect(gruScreen).toBeVisible();
  await expect(gruScreen).toContainText("REF-FICT-0001");
  await expect(gruScreen).toContainText("R$ 20,00");
  await expect(page.getByText("Esta GRU é fictícia. Não pague. Não possui validade.")).toBeVisible();

  // ---- 10) gerar GRU ficticia -----------------------------------------------
  await page.getByTestId("generate-fake-gru").click();

  // ---- 11) validar sucesso ficticio -----------------------------------------
  const success = page.getByTestId("fake-success");
  await expect(success).toBeVisible();
  await expect(page.getByTestId("fake-protocol-number")).toHaveText("PROT-FICT-0001");
  await expect(page.getByTestId("fake-gru-reference")).toHaveText("REF-FICT-0001");
  await expect(success).toContainText("Nenhum processo real foi protocolado");

  // ---- 12) evidencia local (screenshot da tela final) -----------------------
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, `lab-final-${Date.now()}.png`),
    fullPage: true,
  });

  // ---- prova negativa de escopo: nenhuma requisicao externa/Gov/SINARM ------
  expect(offenders, `requisicoes externas/proibidas detectadas: ${offenders.join(", ")}`).toEqual(
    [],
  );
});
