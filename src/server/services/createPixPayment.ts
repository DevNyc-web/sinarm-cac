/**
 * Caso de uso: gerar cobranca Pix SANDBOX/DEV do processo — Fase 5.
 *
 * Fluxo (docs/10 §9, adaptado ao modo sandbox):
 * - Valor FICTICIO do servico: R$ 100,00 (docs/00/10 — preco provavel).
 * - Uma cobranca ativa por processo (reaproveita se ja existir).
 * - Provider via adapter (fake por padrao; Mercado Pago sandbox opcional).
 * - NUNCA cobranca real: aviso na UI + provider fake nao-pagavel + trava de
 *   token TEST- no provider Mercado Pago.
 */
import { type AuthUser } from "@/server/auth/mockUsers";
import { getPaymentProvider } from "@/server/payments";
import {
  attachCharge,
  createPendingPayment,
  findActivePaymentForProcess,
  markFailed,
} from "@/server/repositories/paymentRepository";
import { findProcessByIdForUser } from "@/server/repositories/processRepository";

/** Valor FICTICIO do servico no MVP (R$ 100,00). */
export const SERVICE_PRICE_CENTS = 10_000;

export type CreatePixPaymentResult = { ok: true } | { ok: false; error: string };

export async function createPixPayment(
  actor: AuthUser,
  processId: string,
): Promise<CreatePixPaymentResult> {
  try {
    // Dono do processo: usuario so gera cobranca do proprio processo.
    const process = await findProcessByIdForUser(processId, actor.id);
    if (!process) return { ok: false, error: "Processo nao encontrado." };
    if (process.internalStatus !== "RASCUNHO" && process.internalStatus !== "AGUARDANDO_PAGAMENTO") {
      return { ok: false, error: "Este processo nao esta aguardando pagamento." };
    }

    // Reaproveita cobranca ativa (evita duplicar).
    const active = await findActivePaymentForProcess(process.id);
    if (active) return { ok: true };

    const provider = getPaymentProvider();
    const payment = await createPendingPayment(process.id, provider.name, SERVICE_PRICE_CENTS);

    try {
      const charge = await provider.createPixCharge({
        paymentId: payment.id,
        amountCents: SERVICE_PRICE_CENTS,
        description: `Servico Guia de Trafego (sandbox/dev) — ${process.code}`,
      });
      await attachCharge(payment.id, charge);
    } catch (error) {
      await markFailed(payment.id);
      const message = error instanceof Error ? error.message : "Falha no provider.";
      return { ok: false, error: message };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel gerar a cobranca. Verifique o Postgres local (npm run db:push).",
    };
  }
}
