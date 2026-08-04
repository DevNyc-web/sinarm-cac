/**
 * Relatorio financeiro dedicado (read-only) — docs/59 §6 PR 1, permissao
 * final decidida na atualizacao de 2026-08-04 do docs/59
 * (`audit.view.financial`, nem `queue.view` nem `refund.approve`).
 *
 * Estilo (mesmo de `adminRealCancellationView.test.ts`/
 * `clientCancellationNotice.test.ts`): leitura de arquivo como texto —
 * Server Component com DB real nao roda em `node:test`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const REPORT_PAGE = "src/app/(admin)/admin/financeiro/page.tsx";
const ADMIN_INDEX_PAGE = "src/app/(admin)/admin/page.tsx";
const GET_ADMIN_QUEUE = "src/server/services/getAdminQueue.ts";
const PROCESS_REPOSITORY = "src/server/repositories/processRepository.ts";

/**
 * O comentario JSDoc do arquivo explica de proposito o que a tela NAO faz
 * (cita "motivo interno", "CSV", "registerRefund" em negacoes) — os testes
 * sobre o que RENDERIZA precisam olhar so o corpo do componente, depois do
 * comentario, senao a propria explicacao dispara falso positivo.
 */
function componentBody(source: string): string {
  const idx = source.indexOf("*/");
  return idx === -1 ? source : source.slice(idx + 2);
}

/* --------------------------------------------------------- 1. o gate */

test("a rota exige audit.view.financial, nao so a acao", () => {
  const source = readFileSync(REPORT_PAGE, "utf8");
  assert.match(source, /requirePermission\("audit\.view\.financial"\)/);
});

test("a rota nao usa queue.view como gate (nem requireAdminRole, nem a string)", () => {
  const source = readFileSync(REPORT_PAGE, "utf8");
  assert.doesNotMatch(source, /requireAdminRole/);
  assert.doesNotMatch(source, /"queue\.view"/);
});

test("a rota nao usa refund.approve como gate — reservado para acao futura (docs/59)", () => {
  const body = componentBody(readFileSync(REPORT_PAGE, "utf8"));
  assert.doesNotMatch(body, /refund\.approve/);
});

/* ------------------------------------------------ 2. fonte dos dados */

test("lista reusando getAdminQueue({ needsFinanceReview: true }) — mesma regra da fila, sem query nova", () => {
  const source = readFileSync(REPORT_PAGE, "utf8");
  assert.match(source, /getAdminQueue\(\{\s*needsFinanceReview:\s*true\s*\}\)/);
});

test("nao inventa fonte para data de cancelamento — fica fora desta fase (docs/59 §2/§3.14)", () => {
  const body = componentBody(readFileSync(REPORT_PAGE, "utf8"));
  assert.doesNotMatch(body, /ProcessStatusEvent/);
  assert.doesNotMatch(body, /[Cc]ancel(ado|amento)[A-Za-z]*[Dd]ate|dataCancelamento|cancelledAt/);
});

test("mostra link para o detalhe admin", () => {
  const source = readFileSync(REPORT_PAGE, "utf8");
  assert.match(source, /href=\{`\/admin\/processos\/\$\{row\.id\}`\}/);
});

test("valor pago e data de pagamento vem de paymentAmountCents/paymentPaidAt, ja expostos por getAdminQueue", () => {
  const reportSource = readFileSync(REPORT_PAGE, "utf8");
  assert.match(reportSource, /row\.paymentAmountCents/);
  assert.match(reportSource, /row\.paymentPaidAt/);

  const queueSource = readFileSync(GET_ADMIN_QUEUE, "utf8");
  assert.match(queueSource, /paymentAmountCents: number \| null/);
  assert.match(queueSource, /paymentPaidAt: Date \| null/);
});

test("processRepository: amountCents/paidAt vem do mesmo select de listAdminQueue, sem query propria nova", () => {
  const source = readFileSync(PROCESS_REPOSITORY, "utf8");
  assert.match(
    source,
    /payments:\s*\{\s*select:\s*\{\s*status:\s*true,\s*amountCents:\s*true,\s*paidAt:\s*true\s*\}/,
  );
});

/* ---------------------------------------------- 3. o que a tela NAO mostra */

test("nao mostra motivo interno do cancelamento", () => {
  const source = readFileSync(REPORT_PAGE, "utf8");
  assert.doesNotMatch(componentBody(source), /[Mm]otivo/);
});

test("nao promete reembolso/estorno — so nega, no texto de rodape (mesmo padrao do docs/56)", () => {
  const source = readFileSync(REPORT_PAGE, "utf8");
  assert.doesNotMatch(source, /reembolso (foi )?aprovado/i);
  assert.doesNotMatch(source, /reembolso devido/i);
  assert.doesNotMatch(source, /estorno em andamento/i);
  assert.doesNotMatch(source, /prazo de (devolu[cç][aã]o|reembolso)/i);
});

test("nao cria botao, form ou action financeira — tela e estritamente read-only", () => {
  const body = componentBody(readFileSync(REPORT_PAGE, "utf8"));
  assert.doesNotMatch(body, /<Button/);
  assert.doesNotMatch(body, /<form/);
  assert.doesNotMatch(body, /action=\{/);
  assert.doesNotMatch(body, /registerRefund/i);
});

test("nao usa userFacingStatus, projection ou statusDivergence", () => {
  const source = readFileSync(REPORT_PAGE, "utf8");
  assert.doesNotMatch(source, /userFacingStatus/);
  assert.doesNotMatch(source, /[Pp]rojection/);
  assert.doesNotMatch(source, /statusDivergence/i);
});

test("nao altera PaymentStatus/payment — nenhuma chamada de escrita, nenhum adapter/PSP", () => {
  const source = readFileSync(REPORT_PAGE, "utf8");
  assert.doesNotMatch(source, /\.update\(|\.create\(|paymentAdapter|mercadopago/i);
});

test("nao exporta CSV nesta fase", () => {
  const body = componentBody(readFileSync(REPORT_PAGE, "utf8"));
  assert.doesNotMatch(body, /csv/i);
});

/* --------------------------------------------------- 4. navegacao/descoberta */

test("o link a partir do painel admin so aparece para quem tem audit.view.financial", () => {
  const source = readFileSync(ADMIN_INDEX_PAGE, "utf8");
  assert.match(
    source,
    /hasPermission\(user, "audit\.view\.financial"\)\s*\?\s*\(\s*<Link href="\/admin\/financeiro">/,
  );
});

/* --------------------------------------------------------- 5. seguranca */

test("PHASE9_REAL_EXECUTION_ENABLED continua false as const", () => {
  const safety = readFileSync("src/server/automation/phase9/safety.ts", "utf8");
  assert.match(safety, /export const PHASE9_REAL_EXECUTION_ENABLED = false as const;/);
});
