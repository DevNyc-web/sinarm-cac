import { getPrisma } from "@/server/db/prisma";
import { type PixCharge } from "@/server/payments/adapter";

/**
 * Repositorio de pagamentos (docs/12 §3.9) — Fase 5 sandbox/dev.
 */

export function createPendingPayment(processId: string, provider: string, amountCents: number) {
  return getPrisma().payment.create({
    data: { processId, provider, amountCents },
    // status usa o default PENDENTE; currency o default BRL.
  });
}

/** Anexa a cobranca criada no provider e move para AGUARDANDO_PAGAMENTO. */
export function attachCharge(paymentId: string, charge: PixCharge) {
  return getPrisma().payment.update({
    where: { id: paymentId },
    data: {
      status: "AGUARDANDO_PAGAMENTO",
      providerPaymentId: charge.providerPaymentId,
      pixQrCode: charge.pixQrCode,
      pixCopyPaste: charge.pixCopyPaste,
      expiresAt: charge.expiresAt,
    },
  });
}

export function markFailed(paymentId: string) {
  return getPrisma().payment.update({
    where: { id: paymentId },
    data: { status: "FALHOU" },
  });
}

/** Cobranca ativa (aguardando pagamento e nao expirada) do processo, se houver. */
export function findActivePaymentForProcess(processId: string) {
  return getPrisma().payment.findFirst({
    where: {
      processId,
      status: "AGUARDANDO_PAGAMENTO",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export function listPaymentsForProcess(processId: string) {
  return getPrisma().payment.findMany({
    where: { processId },
    orderBy: { createdAt: "desc" },
  });
}

export function findPaymentByProviderPaymentId(providerPaymentId: string) {
  return getPrisma().payment.findFirst({
    where: { providerPaymentId },
    include: { process: true },
  });
}

export function findPaymentByWebhookEventId(webhookEventId: string) {
  return getPrisma().payment.findUnique({ where: { webhookEventId } });
}

/** Confirma o pagamento gravando o eventId (unico) — idempotencia no banco. */
export function markPaid(paymentId: string, webhookEventId: string) {
  return getPrisma().payment.update({
    where: { id: paymentId },
    data: { status: "PAGO", paidAt: new Date(), webhookEventId },
  });
}
