/**
 * Contrato do provedor de pagamento Pix — Fase 5 (docs/15 §3.4, docs/17 §4).
 *
 * ARQUITETURA OBRIGATORIA: o dominio so conhece esta interface. Trocar
 * Mercado Pago por Asaas (ou outro PSP) = nova implementacao, sem reescrever
 * services/UI. Nesta fase so existem:
 *  - "fake": dev local, sem credencial, sem rede;
 *  - "mercadopago": SANDBOX preparado (token de TESTE via env).
 * NUNCA cobranca real aqui.
 */

export type CreatePixChargeInput = {
  /** Id interno do Payment (referencia externa/idempotencia na criacao). */
  paymentId: string;
  amountCents: number;
  /** Descricao neutra, SEM PII (ex.: codigo do processo). */
  description: string;
};

export type PixCharge = {
  providerPaymentId: string;
  /** Payload do QR. No fake e claramente ficticio (nunca EMV real). */
  pixQrCode: string;
  pixCopyPaste: string;
  expiresAt: Date;
};

export interface PaymentProvider {
  readonly name: "fake" | "mercadopago";
  createPixCharge(input: CreatePixChargeInput): Promise<PixCharge>;
}
