/**
 * Visualizacao admin do cancelamento real — docs/51/docs/52.
 *
 * `cancelProcess` ja move `internalStatus` para `CANCELADO_OPERACIONAL`, e o
 * admin ja enxergava isso como diagnostico bruto (`INTERNAL_STATUS_LABELS`).
 * Este PR so torna isso OBVIO: um callout no detalhe e um rotulo na fila,
 * ambos SOMENTE LEITURA — nenhum form, botao ou action nova.
 *
 * Estilo (mesmo do §7 de `statusDivergence.test.ts`): leitura de arquivo como
 * texto, sem importar `src/app` (Server Component com `notFound()`/DB real
 * nao roda em `node:test`). Prova o que importa sem montar Next.js.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ADMIN_DETAIL_PAGE = "src/app/(admin)/admin/processos/[id]/page.tsx";
const ADMIN_QUEUE_PAGE = "src/app/(admin)/admin/processos/page.tsx";
const GET_ADMIN_QUEUE = "src/server/services/getAdminQueue.ts";
const ADMIN_ACTIONS = "src/app/(admin)/admin/processos/[id]/actions.ts";

/* ------------------------------------------------- 1. detalhe do processo */

test("admin detail: mostra callout para CANCELADO_OPERACIONAL, fora de qualquer form", () => {
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");

  assert.match(
    source,
    /detail\.internalStatus === "CANCELADO_OPERACIONAL"/,
    "pagina deveria checar internalStatus === CANCELADO_OPERACIONAL",
  );
  assert.match(source, /INTERNAL_STATUS_LABELS\.CANCELADO_OPERACIONAL/);

  const idx = source.indexOf("Cancelamento real (docs/51/docs/52)");
  assert.ok(idx > -1, "comentario do callout de cancelamento nao encontrado");
  const before = source.slice(0, idx);
  const lastFormOpen = before.lastIndexOf("<form");
  const lastFormClose = before.lastIndexOf("</form>");
  assert.ok(
    lastFormOpen === -1 || lastFormClose > lastFormOpen,
    "o callout de cancelamento esta dentro de um <form> — deveria ser so leitura",
  );
});

test("admin detail: callout de cancelamento nao cria botao/acao propria", () => {
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  // Recorta uma janela em torno do callout (bem maior que o proprio paragrafo)
  // e garante que nenhum <Button>/action nova aparece junto dele.
  const calloutIdx = source.indexOf("Cancelamento real (docs/51/docs/52)");
  assert.ok(calloutIdx > -1, "comentario do callout nao encontrado");
  const window = source.slice(calloutIdx, calloutIdx + 800);
  assert.doesNotMatch(window, /<Button/);
  assert.doesNotMatch(window, /action=\{/);
  assert.doesNotMatch(window, /cancelProcessAction/);
});

test("admin detail: nenhuma action de cancelamento foi criada em actions.ts", () => {
  const source = readFileSync(ADMIN_ACTIONS, "utf8");
  assert.doesNotMatch(source, /cancelProcess/i);
});

test("admin detail: o dropdown/acao de mudar operationalStatus continua intacto (regressao)", () => {
  // Mesma checagem que statusDivergence.test.ts ja faz para a Fase 5c — aqui
  // so para provar que este PR (so-leitura) nao tocou a acao existente.
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  assert.match(source, /action=\{changeOperationalStatusAction\}/);
  assert.match(source, /name="operationalStatus"/);
});

/* --------------------------------------------------------- 2. fila admin */

test("getAdminQueue: expõe realCancellation calculado a partir de internalStatus", () => {
  const source = readFileSync(GET_ADMIN_QUEUE, "utf8");
  assert.match(source, /realCancellation:\s*boolean/);
  assert.match(
    source,
    /realCancellation:\s*row\.internalStatus === "CANCELADO_OPERACIONAL"/,
  );
});

test("admin queue: mostra rotulo de cancelamento real na tabela, sem novo form/botao", () => {
  const source = readFileSync(ADMIN_QUEUE_PAGE, "utf8");
  assert.match(source, /row\.realCancellation/);
  assert.match(source, /INTERNAL_STATUS_LABELS\.CANCELADO_OPERACIONAL/);

  const idx = source.indexOf("row.realCancellation");
  const window = source.slice(idx, idx + 300);
  assert.doesNotMatch(window, /<form/);
  assert.doesNotMatch(window, /<Button/);
});

/* --------------------------------------------- 3. nao-regressao cruzada */

test("clientVisibleStatusLabel continua SEM ler internalStatus (nao tocado por este PR)", () => {
  const source = readFileSync("src/server/processes/statusLabels.ts", "utf8");
  const fnMatch = source.match(
    /export function clientVisibleStatusLabel\(process:\s*\{([\s\S]*?)\}\):\s*string\s*\{/,
  );
  assert.ok(fnMatch, "assinatura de clientVisibleStatusLabel nao encontrada");
  assert.doesNotMatch(fnMatch![1], /internalStatus/);
});

test("cancelProcess.ts continua sem UI/rota — nenhum arquivo em src/app o importa alem deste PR nao criar nenhum", () => {
  const detailSource = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  const queueSource = readFileSync(ADMIN_QUEUE_PAGE, "utf8");
  assert.doesNotMatch(detailSource, /cancelProcess/i);
  assert.doesNotMatch(queueSource, /cancelProcess/i);
});

test("cliente (src/app/(user)) nao ganhou nenhuma mencao a CANCELADO_OPERACIONAL", () => {
  const dashboard = readFileSync("src/app/(user)/dashboard/page.tsx", "utf8");
  assert.doesNotMatch(dashboard, /CANCELADO_OPERACIONAL/);
  assert.doesNotMatch(dashboard, /internalStatus/);
});
