/**
 * Preco da Guia — FONTE UNICA e consistencia da cobranca.
 *
 * O relatorio de cobertura encontrou o mesmo valor declarado duas vezes
 * (`SERVICE_PRICE_CENTS` no service de cobranca e `SERVICE_TOTAL_CENTS` no
 * pricing). Estes testes travam a unificacao: se alguem reintroduzir uma
 * constante paralela, ou fizer a UI e a cobranca divergirem, o teste falha.
 *
 * Modulo puro: sem banco, sem rede, sem provider real.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  GRU_ESTIMATED_CENTS,
  SERVICE_FEE_CENTS,
  SERVICE_TOTAL_CENTS,
  formatBRL,
} from "../../../src/server/processes/pricing";
import { gruFeeCentsOf } from "../../../src/server/processes/processCatalog";
import { checklistLabel } from "../../../src/server/processes/checklistDefinition";

const CREATE_PIX = "src/server/services/createPixPayment.ts";
const PRICING = "src/server/processes/pricing.ts";
const CHECKLIST = "src/server/processes/checklistDefinition.ts";

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ------------------------------------------------------------ decomposicao --- */

test("a decomposicao fecha: assistencia + GRU = total", () => {
  assert.equal(SERVICE_FEE_CENTS + GRU_ESTIMATED_CENTS, SERVICE_TOTAL_CENTS);
});

test("nenhuma parcela e negativa ou maior que o total", () => {
  for (const [nome, valor] of Object.entries({ SERVICE_FEE_CENTS, GRU_ESTIMATED_CENTS })) {
    assert.ok(valor > 0, `${nome} deve ser positivo`);
    assert.ok(valor < SERVICE_TOTAL_CENTS, `${nome} nao pode alcancar o total`);
  }
});

test("os valores atuais do MVP estao preservados", () => {
  // Trava de regressao: mudar preco e decisao comercial, nao refatoracao.
  assert.equal(SERVICE_TOTAL_CENTS, 10_000, "total R$ 100,00");
  assert.equal(GRU_ESTIMATED_CENTS, 2_000, "GRU estimada R$ 20,00");
  assert.equal(SERVICE_FEE_CENTS, 8_000, "assistencia R$ 80,00");
});

test("formatBRL formata em real brasileiro", () => {
  assert.equal(formatBRL(SERVICE_TOTAL_CENTS), "R$ 100,00");
  assert.equal(formatBRL(GRU_ESTIMATED_CENTS), "R$ 20,00");
  assert.equal(formatBRL(0), "R$ 0,00");
});

/* -------------------------------------------------------------- fonte unica --- */

test("a cobranca usa a constante do pricing, nao uma propria", () => {
  const code = codeOnly(readFileSync(CREATE_PIX, "utf8"));
  assert.match(code, /from "@\/server\/processes\/pricing"/, "deve importar do pricing");
  assert.match(code, /SERVICE_TOTAL_CENTS/, "deve usar o total centralizado");
  assert.ok(
    !code.includes("SERVICE_PRICE_CENTS"),
    "a constante paralela do service nao pode voltar",
  );
});

test("o service de cobranca nao declara valor em centavos no proprio arquivo", () => {
  const code = codeOnly(readFileSync(CREATE_PIX, "utf8"));
  // Qualquer literal numerico grande aqui seria preco duplicado de novo.
  assert.doesNotMatch(code, /=\s*\d[\d_]{3,}/, "sem literal de preco no service");
});

test("o pricing e o unico lugar que declara os centavos do servico", () => {
  const pricing = readFileSync(PRICING, "utf8");
  assert.match(pricing, /SERVICE_TOTAL_CENTS\s*=\s*10_000/);
  assert.match(pricing, /GRU_ESTIMATED_CENTS\s*=\s*2_000/);
  // A parcela de assistencia e DERIVADA, nunca um terceiro numero solto.
  assert.match(pricing, /SERVICE_FEE_CENTS\s*=\s*SERVICE_TOTAL_CENTS\s*-\s*GRU_ESTIMATED_CENTS/);
});

test("a GRU estimada bate com a do catalogo da Guia", () => {
  // Dois lugares descrevem a mesma taxa do orgao; divergir faria a tela do
  // cliente e o catalogo interno contarem historias diferentes.
  assert.equal(gruFeeCentsOf("GUIA_TRAFEGO"), GRU_ESTIMATED_CENTS);
});

test("as telas que exibem preco leem do pricing", () => {
  for (const tela of [
    "src/app/(user)/processos/[id]/page.tsx",
    "src/app/(public)/reembolso/page.tsx",
    "src/app/(admin)/admin/processos/[id]/page.tsx",
  ]) {
    const source = readFileSync(tela, "utf8");
    assert.match(source, /@\/server\/processes\/pricing/, `${tela} deve importar do pricing`);
  }
});

test("nenhuma tela redefine formatBRL por conta propria", () => {
  for (const tela of [
    "src/app/(user)/processos/[id]/page.tsx",
    "src/app/(public)/reembolso/page.tsx",
    "src/app/(admin)/admin/processos/[id]/page.tsx",
  ]) {
    const source = readFileSync(tela, "utf8");
    assert.ok(!/function formatBRL/.test(source), `${tela} nao pode ter copia de formatBRL`);
  }
});

/* ------------------------------------------------------------- checklist GRU --- */

test("o label do checklist da GRU deriva do pricing", () => {
  const label = checklistLabel("gru_amount_expected");
  assert.ok(
    label.includes(formatBRL(GRU_ESTIMATED_CENTS)),
    `o label deve conter o valor formatado da fonte unica: ${label}`,
  );
});

test("hoje o label do checklist continua exibindo R$ 20,00", () => {
  // Comportamento preservado: derivar nao pode ter mudado o texto visto pelo operador.
  assert.equal(checklistLabel("gru_amount_expected"), "Valor da GRU esperado conferido (R$ 20,00)");
});

test("o checklist NAO volta a escrever valor em real na mao", () => {
  const source = codeOnly(readFileSync(CHECKLIST, "utf8"));
  assert.doesNotMatch(source, /R\$\s*\d/, "nenhum valor em real literal no checklist");
  assert.match(source, /formatBRL\(GRU_ESTIMATED_CENTS\)/, "o valor vem do pricing");
});

/* ------------------------------------------------------ preco vem do servidor --- */

test("o valor NAO vem do cliente: a cobranca so recebe ator e processo", () => {
  const code = codeOnly(readFileSync(CREATE_PIX, "utf8"));
  assert.match(
    code,
    /createPixPayment\(\s*actor:\s*AuthUser,\s*processId:\s*string,\s*\)/,
    "a assinatura nao pode aceitar valor",
  );
  assert.doesNotMatch(code, /amountCents\s*[:=]\s*(input|body|formData|params)/, "sem valor externo");
});

test("a server action de pagamento nao le valor do formulario", () => {
  const action = codeOnly(readFileSync("src/app/(user)/processos/[id]/actions.ts", "utf8"));
  const trecho = action.slice(action.indexOf("createPixPaymentAction"));
  assert.doesNotMatch(trecho, /get\("(amount|valor|price|amountCents)"\)/, "sem preco do cliente");
});

/* ------------------------------------------------------------------ provider --- */

test("o provider fake continua sendo o padrao e nao e pagavel", () => {
  const factory = codeOnly(readFileSync("src/server/payments/index.ts", "utf8"));
  assert.match(factory, /mercadopago.*\?|:\s*fakePaymentProvider/s, "fake e o default");
  const fake = readFileSync("src/server/payments/fakeProvider.ts", "utf8");
  assert.match(fake, /NAO-PAGAVEL/, "o payload fake precisa ser inutilizavel");
});

test("Mercado Pago segue travado em token de TESTE", () => {
  const mp = codeOnly(readFileSync("src/server/payments/mercadoPagoProvider.ts", "utf8"));
  assert.match(mp, /startsWith\("TEST-"\)/, "a trava de sandbox nao pode sair");
  assert.match(mp, /throw new Error/, "token fora do padrao TEST- deve falhar");
});

/* ------------------------------------------------------------ escopo proibido --- */

test("o caminho do preco nao toca Gov.br/SINARM, Fase 9 nem automacao", () => {
  for (const arquivo of [PRICING, CREATE_PIX]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    assert.doesNotMatch(code, /gov\.?br|sinarm/i, `${arquivo}: sem Gov.br/SINARM`);
    assert.doesNotMatch(code, /phase9|PHASE9/i, `${arquivo}: sem Fase 9`);
    assert.doesNotMatch(code, /automationQueue|submitToAutomationQueue/, `${arquivo}: sem automacao`);
  }
});

test("o pricing continua puro — sem banco, rede ou provider", () => {
  const code = codeOnly(readFileSync(PRICING, "utf8"));
  assert.doesNotMatch(code, /@prisma\/client|getPrisma|Repository/, "sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
  assert.doesNotMatch(code, /getPaymentProvider/, "sem provider");
});
