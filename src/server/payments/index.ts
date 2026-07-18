/**
 * Fabrica do payment provider (docs/15 §3.4). Escolha via env PAYMENT_PROVIDER:
 * "fake" (padrao, sem credencial) ou "mercadopago" (SANDBOX). Trocar de PSP no
 * futuro = nova implementacao registrada aqui.
 */
import { getEnv } from "@/server/config/env";
import { type PaymentProvider } from "./adapter";
import { fakePaymentProvider } from "./fakeProvider";
import { mercadoPagoProvider } from "./mercadoPagoProvider";

export function getPaymentProvider(): PaymentProvider {
  return getEnv().PAYMENT_PROVIDER === "mercadopago" ? mercadoPagoProvider : fakePaymentProvider;
}
