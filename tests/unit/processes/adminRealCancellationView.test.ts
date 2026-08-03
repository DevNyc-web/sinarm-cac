/**
 * Visualizacao e acao admin do cancelamento real — docs/51/docs/52/docs/53.
 *
 * Secao 1 cobre o callout READ-ONLY (PR anterior). Secao 1b cobre o form de
 * cancelamento em si (este PR — docs/53): server action `cancelProcessAction`
 * chamando `cancelProcess`, sem Client Component, sem modal, gated por
 * `process.cancel` + `isCancellableInternalStatus` (exportada de
 * `cancelProcess.ts`, nunca uma allowlist reescrita na pagina). Secao 2 cobre
 * a fila (nunca ganha o form). Secao 3, nao-regressao cruzada.
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

test("admin detail: o dropdown/acao de mudar operationalStatus continua intacto (regressao)", () => {
  // Mesma checagem que statusDivergence.test.ts ja faz para a Fase 5c — aqui
  // so para provar que este PR nao tocou a acao existente.
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  assert.match(source, /action=\{changeOperationalStatusAction\}/);
  assert.match(source, /name="operationalStatus"/);
});

/* -------------------------------- 1b. form de cancelamento (docs/53) */

test("cancelProcess.ts exporta isCancellableInternalStatus, sem reescrever a allowlist", () => {
  const source = readFileSync("src/server/services/cancelProcess.ts", "utf8");
  assert.match(source, /export function isCancellableInternalStatus/);
});

test("admin detail: canCancelProcess usa process.cancel + isCancellableInternalStatus, nada mais", () => {
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  assert.match(
    source,
    /canCancelProcess =\s*\n?\s*hasPermission\(admin, "process\.cancel"\) && isCancellableInternalStatus\(detail\.internalStatus\)/,
    "canCancelProcess deveria ser exatamente hasPermission(process.cancel) && isCancellableInternalStatus(...)",
  );
  // Import vem do modulo do backend, nunca redeclarado/copiado na pagina.
  assert.match(
    source,
    /import \{ isCancellableInternalStatus, MIN_CANCEL_REASON_LENGTH \} from "@\/server\/services\/cancelProcess"/,
  );
});

test("admin detail: o form de cancelamento so renderiza quando canCancelProcess e verdadeiro", () => {
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  assert.match(
    source,
    /\{canCancelProcess \? \(\s*\n\s*<form\s*\n\s*action=\{cancelProcessAction\}/,
    "form de cancelamento deveria estar condicionado a canCancelProcess",
  );
});

test("admin detail: form de cancelamento tem processId oculto, motivo obrigatorio e botao 'Cancelar processo'", () => {
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  const idx = source.indexOf("action={cancelProcessAction}");
  assert.ok(idx > -1, "form action={cancelProcessAction} nao encontrado");
  const window = source.slice(idx, idx + 900);
  assert.match(window, /type="hidden" name="processId" value=\{detail\.id\}/);
  assert.match(window, /name="cancelReason"/);
  assert.match(window, /required/);
  assert.match(window, /minLength=\{MIN_CANCEL_REASON_LENGTH\}/);
  assert.match(window, />\s*Cancelar processo\s*</);
});

test("admin detail: aviso do form cobre documentos/pagamentos preservados e motivo nao automatico ao cliente", () => {
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  const idx = source.indexOf("action={cancelProcessAction}");
  const window = source.slice(idx, idx + 1200);
  assert.match(window, /encerra o processo operacionalmente/i);
  assert.match(window, /Documentos e pagamentos nao sao\s*\n?\s*apagados/i);
  assert.match(window, /cliente nao vera o motivo automaticamente/i);
});

test("admin detail: nenhum Client Component/modal foi introduzido", () => {
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  assert.doesNotMatch(source, /^"use client"/m, "pagina nao deveria virar Client Component");
  assert.doesNotMatch(source, /useState|useEffect|Dialog|Modal/);
});

test("admin detail: banner de sucesso segue o mesmo padrao do banner de erro (query param)", () => {
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  assert.match(source, /searchParams: Promise<\{ erro\?: string; sucesso\?: string \}>/);
  assert.match(source, /\{sucesso \? \(/);
});

test("actions.ts: cancelProcessAction exige process.cancel e chama cancelProcess com o motivo do form", () => {
  const source = readFileSync(ADMIN_ACTIONS, "utf8");
  assert.match(source, /export async function cancelProcessAction/);

  const idx = source.indexOf("export async function cancelProcessAction");
  const window = source.slice(idx, idx + 900);
  assert.match(window, /requirePermission\("process\.cancel"\)/);
  assert.match(window, /formData\.get\("cancelReason"\)/);
  assert.match(window, /cancelProcess\(actor, processId, reason\)/);
});

test("actions.ts: cancelProcessAction trata erro e sucesso pelo mesmo padrao de query param das demais actions", () => {
  const source = readFileSync(ADMIN_ACTIONS, "utf8");
  const idx = source.indexOf("export async function cancelProcessAction");
  const window = source.slice(idx, idx + 900);
  assert.match(window, /redirect\(`\$\{base\}\?erro=\$\{encodeURIComponent\(result\.error\)\}`\)/);
  assert.match(window, /revalidatePath\(base\)/);
  assert.match(
    window,
    /redirect\(`\$\{base\}\?sucesso=\$\{encodeURIComponent\("Processo cancelado operacionalmente\."\)\}`\)/,
  );
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

test("cancelProcess so e referenciado pelo detalhe admin (docs/53) — a fila continua sem UI/rota", () => {
  // O detalhe PRECISA referenciar cancelProcess.ts agora (isCancellableInternalStatus,
  // MIN_CANCEL_REASON_LENGTH, e actions.ts chamando cancelProcess) — e exatamente
  // o que este PR implementa. A fila/listagem continua sem NENHUMA mencao,
  // por decisao do docs/53 (botao nunca aparece na fila).
  const detailSource = readFileSync(ADMIN_DETAIL_PAGE, "utf8");
  const queueSource = readFileSync(ADMIN_QUEUE_PAGE, "utf8");
  assert.match(detailSource, /cancelProcess/i);
  assert.doesNotMatch(queueSource, /cancelProcess/i);
});

test("cliente (src/app/(user)) nao ganhou nenhuma mencao a CANCELADO_OPERACIONAL", () => {
  const dashboard = readFileSync("src/app/(user)/dashboard/page.tsx", "utf8");
  assert.doesNotMatch(dashboard, /CANCELADO_OPERACIONAL/);
  assert.doesNotMatch(dashboard, /internalStatus/);
});
