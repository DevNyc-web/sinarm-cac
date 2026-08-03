/**
 * Aviso read-only de cancelamento real no detalhe do CLIENTE — docs/56.
 *
 * `cancelProcess` (docs/51) move `internalStatus` para
 * `CANCELADO_OPERACIONAL`. O admin ja mostra isso como callout read-only
 * (docs/52, PR #98). Este PR estende o MESMO tipo de aviso para o detalhe
 * do cliente — texto neutro, sem motivo, sem financeiro, sem promessa de
 * reembolso, sem `userFacingStatus` (docs/45 proibe novo leitor).
 *
 * Estilo (mesmo de `adminRealCancellationView.test.ts`): leitura de arquivo
 * como texto — Server Component com `notFound()`/DB real nao roda em
 * `node:test`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const CLIENT_DETAIL_PAGE = "src/app/(user)/processos/[id]/page.tsx";
const CLIENT_DASHBOARD_PAGE = "src/app/(user)/dashboard/page.tsx";
const CLIENT_ACTIONS = "src/app/(user)/processos/[id]/actions.ts";

/* --------------------------------------------------- 1. o aviso em si */

test("detalhe do cliente: mostra 'Processo cancelado' quando internalStatus = CANCELADO_OPERACIONAL", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(
    source,
    /process\.internalStatus === "CANCELADO_OPERACIONAL"/,
    "pagina deveria checar internalStatus diretamente",
  );
  assert.match(source, /Processo cancelado\./);
});

test("detalhe do cliente: mostra o texto de contexto aprovado no docs/56", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(
    source,
    /Este processo foi encerrado administrativamente\.\s*\n\s*Em caso de dúvidas, entre em contato com o atendimento\./,
  );
});

test("detalhe do cliente: o aviso esta fora de qualquer <form>", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  const idx = source.indexOf("Processo cancelado.");
  assert.ok(idx > -1, "aviso de cancelamento nao encontrado");
  const before = source.slice(0, idx);
  const lastFormOpen = before.lastIndexOf("<form");
  const lastFormClose = before.lastIndexOf("</form>");
  assert.ok(
    lastFormOpen === -1 || lastFormClose > lastFormOpen,
    "o aviso esta dentro de um <form> — deveria ser so leitura",
  );
});

test("detalhe do cliente: o aviso nao cria botao/action/contestacao", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  const idx = source.indexOf("Docs/56 — aviso SOMENTE LEITURA");
  assert.ok(idx > -1, "comentario do aviso nao encontrado");
  const window = source.slice(idx, idx + 900);
  assert.doesNotMatch(window, /<Button/);
  assert.doesNotMatch(window, /action=\{/);
  assert.doesNotMatch(window, /<a\s/);
});

/* ---------------------------------------- 2. o que o cliente NAO ve */

test("o aviso nao expõe motivo interno, financeiro ou promessa de reembolso", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  // Janela comeca no JSX de verdade (depois do comentario explicativo, que
  // legitimamente cita essas frases como exemplo do que NAO fazer).
  const idx = source.indexOf('process.internalStatus === "CANCELADO_OPERACIONAL"');
  assert.ok(idx > -1, "condicao do aviso nao encontrada");
  const window = source.slice(idx, idx + 400);
  assert.doesNotMatch(window, /[Mm]otivo/);
  assert.doesNotMatch(window, /needsFinanceReview/i);
  assert.doesNotMatch(window, /[Rr]evis[aã]o financeira/);
  assert.doesNotMatch(window, /reembolso (foi )?aprovado/i);
  assert.doesNotMatch(window, /reembolso devido/i);
  assert.doesNotMatch(window, /estorno em andamento/i);
});

test("nenhuma mencao a needsFinanceReview/revisao financeira em lugar nenhum do arquivo", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.doesNotMatch(source, /needsFinanceReview/i);
  assert.doesNotMatch(source, /[Rr]evis[aã]o financeira/);
});

test("o aviso nao usa userFacingStatus como fonte (docs/45 continua valendo)", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  const idx = source.indexOf('process.internalStatus === "CANCELADO_OPERACIONAL"');
  assert.ok(idx > -1, "condicao do aviso nao encontrada");
  const window = source.slice(idx, idx + 400);
  assert.doesNotMatch(window, /userFacingStatus/);
});

test("clientVisibleStatusLabel continua chamado do mesmo jeito — aviso e ADICIONAL, nao substituicao", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(source, /clientVisibleStatusLabel\(process\)/);
});

/* ------------------------------------------------- 3. nao-regressao */

test("dashboard do cliente nao ganhou nenhuma mencao a CANCELADO_OPERACIONAL/internalStatus", () => {
  const source = readFileSync(CLIENT_DASHBOARD_PAGE, "utf8");
  assert.doesNotMatch(source, /CANCELADO_OPERACIONAL/);
  assert.doesNotMatch(source, /internalStatus/);
});

test("nenhuma action nova foi criada em actions.ts do cliente", () => {
  const source = readFileSync(CLIENT_ACTIONS, "utf8");
  assert.doesNotMatch(source, /cancel/i);
});

test("cancelProcess.ts continua sem alsoSet e sem tocar pagamento (nao alterado por este PR)", () => {
  const source = readFileSync("src/server/services/cancelProcess.ts", "utf8");
  assert.doesNotMatch(source, /alsoSet\s*:/);
  assert.doesNotMatch(source, /paymentRepository|paymentAdapter/i);
});

test("PaymentStatus nao ganhou valor novo (schema intocado por este PR)", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const bloco = /enum PaymentStatus \{([\s\S]*?)\}/.exec(schema);
  assert.ok(bloco, "enum PaymentStatus nao encontrado");
  const valores = bloco![1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
  assert.equal(valores.length, 6, "PaymentStatus deveria continuar com 6 valores");
});

test("canCreateCharge continua o mesmo gate — nao foi alterado por este PR", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(
    source,
    /process\.internalStatus === "RASCUNHO" \|\| process\.internalStatus === "AGUARDANDO_PAGAMENTO"/,
  );
});
