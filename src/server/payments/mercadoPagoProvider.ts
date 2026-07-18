/**
 * Provider Mercado Pago — SANDBOX (Fase 5, docs/17 §4). PREPARADO, nao ativo
 * por padrao (PAYMENT_PROVIDER=fake).
 *
 * Regras:
 * - Usa APENAS o access token de TESTE (TEST-...) vindo de env — nunca
 *   credencial no codigo, nunca token de producao nesta fase.
 * - Sem SDK: REST direto via fetch (sem dependencia nova).
 * - Sem credencial configurada, falha com mensagem clara em RUNTIME — o
 *   build/typecheck nao dependem de credencial.
 * - Payer ficticio (e-mail de exemplo); NUNCA CPF/dados reais de cliente.
 */
import { randomUUID } from "node:crypto";
import { getEnv } from "@/server/config/env";
import { type CreatePixChargeInput, type PaymentProvider, type PixCharge } from "./adapter";

const MP_API_URL = "https://api.mercadopago.com/v1/payments";
const EXPIRES_IN_MINUTES = 30;

export const mercadoPagoProvider: PaymentProvider = {
  name: "mercadopago",

  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
    const token = getEnv().MERCADO_PAGO_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        "MERCADO_PAGO_ACCESS_TOKEN ausente. Configure o token de TESTE (sandbox) no .env ou use PAYMENT_PROVIDER=fake.",
      );
    }
    if (!token.startsWith("TEST-")) {
      // Trava da Fase 5: nada de credencial de producao (docs/15 §3.4).
      throw new Error(
        "Apenas token de TESTE (TEST-...) e aceito na Fase 5. Pix real/producao esta bloqueado.",
      );
    }

    const expiresAt = new Date(Date.now() + EXPIRES_IN_MINUTES * 60 * 1000);
    const response = await fetch(MP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // Idempotencia na criacao (recomendacao do proprio MP).
        "X-Idempotency-Key": input.paymentId,
      },
      body: JSON.stringify({
        transaction_amount: input.amountCents / 100,
        description: input.description,
        payment_method_id: "pix",
        date_of_expiration: expiresAt.toISOString(),
        // Pagador FICTICIO de sandbox — nunca dados reais de cliente.
        payer: { email: `sandbox-${randomUUID().slice(0, 8)}@example.com` },
        external_reference: input.paymentId,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mercado Pago sandbox retornou ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      id: number | string;
      point_of_interaction?: {
        transaction_data?: { qr_code?: string; qr_code_base64?: string };
      };
    };
    const qrCode = data.point_of_interaction?.transaction_data?.qr_code;
    if (!qrCode) {
      throw new Error("Resposta do sandbox sem QR Code Pix.");
    }

    return {
      providerPaymentId: String(data.id),
      pixQrCode: qrCode,
      pixCopyPaste: qrCode,
      expiresAt,
    };
  },
};
