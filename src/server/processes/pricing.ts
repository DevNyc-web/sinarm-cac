/**
 * Composicao do preco do servico (docs/10 §9/§10, docs/24 §8/§13).
 *
 * FONTE UNICA do valor cobrado da Guia. Quem gera cobranca (`createPixPayment`)
 * e quem exibe preco (telas do cliente/admin/reembolso) leem daqui — antes o
 * service tinha uma constante propria (`SERVICE_PRICE_CENTS`) com o mesmo numero
 * repetido, entao alterar um dos dois faria a tela mostrar um valor e a cobranca
 * gerar outro.
 *
 * Por que existe a decomposicao: o usuario precisa enxergar que **o que ele paga
 * a nos NAO e a GRU**. A GRU e uma **taxa do orgao competente**, recolhida pela
 * empresa e ja embutida no total — nunca uma cobranca oficial feita por este app.
 *
 * Valores de referencia do MVP; no ambiente atual tudo e FICTICIO/dev. Mudar
 * preco e decisao comercial, nao refatoracao: alterar SO aqui.
 */

/**
 * TOTAL cobrado do usuario no Pix — a unica base da cobranca (docs/10 §9).
 * O valor nunca vem do cliente: `createPixPayment` le esta constante no servidor.
 */
export const SERVICE_TOTAL_CENTS = 10_000;

/** Parcela referente a GRU (taxa do orgao) — docs/09 §15.11. */
export const GRU_ESTIMATED_CENTS = 2_000;

/** Parcela referente ao nosso servico de assistencia. */
export const SERVICE_FEE_CENTS = SERVICE_TOTAL_CENTS - GRU_ESTIMATED_CENTS;

export function formatBRL(amountCents: number): string {
  return `R$ ${(amountCents / 100).toFixed(2).replace(".", ",")}`;
}
