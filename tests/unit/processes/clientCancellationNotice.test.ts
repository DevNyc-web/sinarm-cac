/**
 * Aviso read-only de cancelamento real no detalhe do CLIENTE — docs/56, mais
 * o bloqueio VISUAL das acoes em processo encerrado — docs/57 PR 4 (§3).
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

/* ============================================================================
 * docs/57 PR 4 — a UI para de OFERECER as acoes que o backend ja recusa.
 *
 * Mesmo estilo dos testes acima (varredura de fonte): Server Component com
 * `notFound()`/DB real nao roda em `node:test`. O que estes testes travam e a
 * ligacao entre a condicao `closed` e cada acao — o comportamento de bloqueio
 * em si ja e testado nos services (PRs 1-3), que continuam a autoridade.
 * ========================================================================= */

const INTAKE_PANEL = "src/components/documents/DocumentIntakePanel.tsx";

/** Trecho do arquivo entre dois marcadores, para asserir "dentro deste bloco". */
function blocoApos(source: string, inicio: string, chars: number): string {
  const idx = source.indexOf(inicio);
  assert.ok(idx > -1, `marcador nao encontrado: ${inicio}`);
  return source.slice(idx, idx + chars);
}

test("a pagina deriva 'closed' reusando isClosed — nao inventa outra definicao de encerrado", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(source, /import \{ isClosed \} from "@\/server\/processes\/operationalSignals"/);
  assert.match(
    source,
    /const closed = isClosed\(process\.operationalStatus, process\.internalStatus\)/,
  );
});

test("encerrado NAO oferece a simulacao de pagamento", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(
    source,
    /\{closed \? null : \(\s*<form action=\{simulatePaymentApprovedAction\}/,
    "o form de simular pagamento precisa estar atras de `closed`",
  );
});

test("encerrado NAO oferece a geracao de cobranca Pix", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(source, /\{canCreateCharge && !closed \?/);
});

test("encerrado NAO oferece upload: o painel recebe uploadAction indefinido", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(source, /uploadAction=\{closed \? undefined : uploadDocumentAction\}/);
});

test("encerrado NAO oferece aplicar sugestao/correcao de destino", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(
    source,
    /applyAction=\{closed \? undefined : applyDocumentFieldSuggestionAction\}/,
  );
});

test("o painel de intake so renderiza o form de anexar quando ha uploadAction", () => {
  const source = readFileSync(INTAKE_PANEL, "utf8");
  assert.match(source, /uploadAction\?: \(formData: FormData\)/, "a prop virou opcional");
  assert.match(
    source,
    /\{uploadAction \? \(\s*<form\s+action=\{uploadAction\}/,
    "sem a action, nenhum <form> de upload pode ser renderizado",
  );
});

test("mostra o texto neutro de encerrado, sem linguagem financeira", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  assert.match(
    source,
    /Este processo está encerrado\.\s*Novas ações não estão disponíveis\./,
  );

  const bloco = blocoApos(source, "{closed ? (", 400);
  assert.doesNotMatch(bloco, /reembolso|estorno|devolu[cç][aã]o|financeir/i);
  assert.doesNotMatch(bloco, /[Mm]otivo/);
  assert.doesNotMatch(bloco, /needsFinanceReview/i);
  assert.doesNotMatch(bloco, /<Button|contest/i);
});

test("a condicao `closed` nao usa userFacingStatus como fonte (docs/45 continua valendo)", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  // Janela do proprio gate — o arquivo cita `userFacingStatus` em prosa, no
  // comentario do docs/56, exatamente para dizer que NAO deve ser lido.
  assert.doesNotMatch(blocoApos(source, "const closed = isClosed", 200), /userFacingStatus/);
  assert.doesNotMatch(blocoApos(source, "{closed ? (", 400), /userFacingStatus/);
});

/* ----------------------------------- read-only continua na tela (docs/57 §4) */

test("o que era LEITURA continua sendo renderizado sem depender de closed", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  // Cada um destes e conteudo de leitura: nao pode ter ganhado gate de `closed`.
  for (const trecho of [
    "Arquivos enviados",
    "documentFileHref(doc.id)",
    "Ver documento enviado",
    "clientVisibleStatusLabel(process)",
    "Destino / evento",
    "Mensagens da equipe",
  ]) {
    const idx = source.indexOf(trecho);
    assert.ok(idx > -1, `sumiu da pagina: ${trecho}`);
    // A linha que renderiza o trecho nao pode estar condicionada a `closed`.
    const linha = source.slice(source.lastIndexOf("\n", idx) + 1, idx + trecho.length);
    assert.doesNotMatch(linha, /closed/, `${trecho} nao pode depender de closed`);
  }
});

test("o codigo Pix continua visivel em processo encerrado — so a acao some", () => {
  const source = readFileSync(CLIENT_DETAIL_PAGE, "utf8");
  const idxPix = source.indexOf("Pix copia e cola");
  const idxGate = source.indexOf("{closed ? null : (");
  assert.ok(idxPix > -1 && idxGate > -1);
  assert.ok(idxPix < idxGate, "o gate de `closed` tem de vir DEPOIS da exibicao do codigo Pix");
});

/* --------------------------------------- os guards server-side ficam intactos */

test("os tres guards de service continuam no lugar — a UI nao os substitui", () => {
  for (const service of [
    "src/server/services/confirmPixPayment.ts",
    "src/server/services/uploadProcessDocument.ts",
    "src/server/services/applyDestinationSuggestion.ts",
  ]) {
    const code = readFileSync(service, "utf8");
    assert.match(code, /import \{ isClosed \}/, `${service}: perdeu o import de isClosed`);
    assert.match(code, /if \(isClosed\(/, `${service}: perdeu o guard`);
  }
});

test("nenhuma action nova, nenhum service alterado por este PR de UI", () => {
  const actions = readFileSync(CLIENT_ACTIONS, "utf8");
  assert.doesNotMatch(actions, /isClosed|closed/, "o gate e do render, nao da action");
  const upload = readFileSync("src/server/services/uploadProcessDocument.ts", "utf8");
  assert.doesNotMatch(upload, /Este processo está encerrado/, "texto de UI nao vaza para o service");
});

test("PHASE9_REAL_EXECUTION_ENABLED continua false as const", () => {
  const safety = readFileSync("src/server/automation/phase9/safety.ts", "utf8");
  assert.match(safety, /export const PHASE9_REAL_EXECUTION_ENABLED = false as const;/);
});
