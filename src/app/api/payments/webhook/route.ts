import { NextResponse } from "next/server";
import { getEnv } from "@/server/config/env";
import { confirmPixPayment } from "@/server/services/confirmPixPayment";

/**
 * Webhook de pagamento — Fase 5, formato DEV/SANDBOX.
 *
 * Recebe eventos fake/sandbox: { eventId, providerPaymentId, type: "payment.paid" }.
 * IDEMPOTENTE: reentregas do mesmo eventId respondem 200 sem reprocessar.
 *
 * Protecao dev: se MERCADO_PAGO_WEBHOOK_SECRET estiver definido, exige o
 * header `x-dev-webhook-secret` igual. ANTES de expor publicamente para o
 * sandbox do Mercado Pago, implementar a validacao oficial de assinatura
 * (x-signature/HMAC) e o mapeamento do payload real — fica para o passo
 * "webhook testado" que bloqueia producao (docs/15 §3.4). Nao chama PSP algum.
 */
export async function POST(request: Request) {
  const secret = getEnv().MERCADO_PAGO_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-dev-webhook-secret") !== secret) {
    return NextResponse.json({ error: "assinatura invalida" }, { status: 401 });
  }

  let body: { eventId?: string; providerPaymentId?: string; type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  // Eventos que nao sao de pagamento aprovado: reconhecer e ignorar.
  if (body.type !== "payment.paid") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const result = await confirmPixPayment(String(body.eventId ?? ""), String(body.providerPaymentId ?? ""));
  if (!result.ok) {
    const status = result.error === "Pagamento nao encontrado." ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ received: true, alreadyProcessed: result.alreadyProcessed });
}
