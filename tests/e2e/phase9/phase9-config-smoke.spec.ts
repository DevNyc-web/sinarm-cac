import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { expect, test, type Page, type Request } from "@playwright/test";
import phase9Config from "../../../playwright.phase9.config";
import {
  assertUrlAllowed,
  createPhase9NetworkPolicy,
} from "../../../src/server/automation/phase9/networkGuard";

/**
 * Fase 9 — SMOKE da config segura (docs/34 Parte D, docs/35).
 *
 * Prova que:
 * - `playwright.phase9.config.ts` roda (config valida, contexto novo por teste);
 * - trace/video/screenshot AUTOMATICOS estao `off`;
 * - a execucao so toca `localhost`/`127.0.0.1` (servidor efemero proprio);
 * - NENHUMA URL real (Gov.br/SINARM) e acessada — guard de rede vazio.
 *
 * NAO sobe a app real, NAO usa dado real, NAO acessa site publico.
 */

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

/** Sobe um servidor efemero em 127.0.0.1 servindo uma pagina trivial (sem PII). */
function startLocalServer(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<!doctype html><html><body><main data-testid='phase9-smoke'>" +
          "Fase 9 — smoke local (sem dado real, sem Gov.br/SINARM)" +
          "</main></body></html>",
      );
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

test("config da Fase 9 tem trace/video/screenshot automaticos OFF", () => {
  // Verificavel direto do arquivo de config (docs/35 §4).
  expect(phase9Config.use?.trace).toBe("off");
  expect(phase9Config.use?.video).toBe("off");
  expect(phase9Config.use?.screenshot).toBe("off");
});

test("guard de rede da Fase 9: localhost permitido, Gov.br bloqueado", () => {
  const policy = createPhase9NetworkPolicy();
  expect(policy.externalAccessAllowed).toBe(false);
  expect(assertUrlAllowed("http://localhost:3000/", policy).allowed).toBe(true);
  expect(assertUrlAllowed("https://servicos.pf.gov.br/", policy).allowed).toBe(false);
});

test("smoke: a config roda contra localhost, sem tocar URL real", async ({ page }) => {
  const offenders = attachNetworkGuard(page);
  const { server, url } = await startLocalServer();
  try {
    await page.goto(url);
    await expect(page.getByTestId("phase9-smoke")).toContainText("smoke local");
    await expect(page.locator("body")).toContainText("sem Gov.br/SINARM");
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }

  expect(offenders, `requisicoes externas/proibidas: ${offenders.join(", ")}`).toEqual([]);
});
