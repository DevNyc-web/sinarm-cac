/**
 * Caso de uso: confirmar pagamento Pix (webhook/simulacao) — Fase 5 sandbox.
 *
 * IDEMPOTENTE por eventId (docs/15 §7 #10):
 * - `webhookEventId` e UNIQUE em payments: o mesmo evento nunca confirma duas
 *   vezes (reentrega do webhook -> "alreadyProcessed").
 * - Pagamento ja PAGO por outro evento tambem e no-op.
 * Ao confirmar: payment -> PAGO, processo -> PAGO_EM_FILA (docs/12 §6) e
 * evento registrado no historico.
 */
import {
  findPaymentByProviderPaymentId,
  findPaymentByWebhookEventId,
  markPaid,
} from "@/server/repositories/paymentRepository";
import { recordStatusEvent } from "@/server/repositories/processEventRepository";
import { getPrisma } from "@/server/db/prisma";

export type ConfirmPixPaymentResult =
  | { ok: true; alreadyProcessed: boolean }
  | { ok: false; error: string };

export async function confirmPixPayment(
  eventId: string,
  providerPaymentId: string,
): Promise<ConfirmPixPaymentResult> {
  if (!eventId.trim() || !providerPaymentId.trim()) {
    return { ok: false, error: "eventId e providerPaymentId sao obrigatorios." };
  }

  try {
    // Idempotencia 1: evento ja processado -> no-op.
    const processedBefore = await findPaymentByWebhookEventId(eventId);
    if (processedBefore) return { ok: true, alreadyProcessed: true };

    const payment = await findPaymentByProviderPaymentId(providerPaymentId);
    if (!payment) return { ok: false, error: "Pagamento nao encontrado." };

    // Idempotencia 2: pagamento ja confirmado por outro evento -> no-op.
    if (payment.status === "PAGO") return { ok: true, alreadyProcessed: true };
    if (payment.status !== "AGUARDANDO_PAGAMENTO" && payment.status !== "PENDENTE") {
      return { ok: false, error: `Pagamento em estado ${payment.status} nao pode ser confirmado.` };
    }

    await markPaid(payment.id, eventId);

    // Processo: RASCUNHO/AGUARDANDO_PAGAMENTO -> PAGO_EM_FILA (docs/11 §8).
    // Move as tres visoes juntas: interna (docs/12 §6), operacional (fila) e a
    // visivel ao usuario — para nao divergirem.
    const fromStatus = payment.process.internalStatus;
    await getPrisma().process.update({
      where: { id: payment.processId },
      data: {
        internalStatus: "PAGO_EM_FILA",
        operationalStatus: "PAGO_EM_FILA",
        userFacingStatus: "PAGAMENTO_CONFIRMADO",
      },
    });
    await recordStatusEvent({
      processId: payment.processId,
      fromStatus,
      toStatus: "PAGO_EM_FILA",
      actorMockUserId: "webhook",
      actorRole: "SYSTEM",
      note: `Pix confirmado (sandbox/dev) — evento ${eventId.slice(0, 24)}`,
    });

    return { ok: true, alreadyProcessed: false };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel confirmar. Verifique o Postgres local (npm run db:push).",
    };
  }
}
