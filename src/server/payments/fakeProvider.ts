/**
 * Provider FAKE/DEV — Fase 5. Sem credencial, sem rede, sem PSP.
 * Gera uma "cobranca" claramente ficticia para desenvolver o fluxo local.
 * O payload NAO e um codigo Pix EMV valido de proposito: ninguem consegue
 * paga-lo por engano.
 */
import { randomUUID } from "node:crypto";
import { type CreatePixChargeInput, type PaymentProvider, type PixCharge } from "./adapter";

const EXPIRES_IN_MINUTES = 30;

export const fakePaymentProvider: PaymentProvider = {
  name: "fake",

  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
    const id = randomUUID();
    const fakePayload = `PIX-FICTICIO-DEV|NAO-PAGAVEL|payment=${input.paymentId}|charge=${id}|valor=${input.amountCents}`;
    return {
      providerPaymentId: `FAKE-${id}`,
      pixQrCode: fakePayload,
      pixCopyPaste: fakePayload,
      expiresAt: new Date(Date.now() + EXPIRES_IN_MINUTES * 60 * 1000),
    };
  },
};
