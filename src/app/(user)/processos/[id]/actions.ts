"use server";

/**
 * Server Actions da tela de revisao do processo do usuario — Fase 4.
 * Upload FICTICIO/DEV: guard de usuario + delegacao ao service.
 * O formulario informa o TIPO do documento (um anexo por documento esperado).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_MODE } from "@/server/auth/config";
import { requireUser } from "@/server/auth/guards";
import { isDocumentKind } from "@/server/documents";
import { findProcessByIdForUser } from "@/server/repositories/processRepository";
import { listPaymentsForProcess } from "@/server/repositories/paymentRepository";
import { applyDestinationSuggestion } from "@/server/services/applyDestinationSuggestion";
import { confirmPixPayment } from "@/server/services/confirmPixPayment";
import { createPixPayment } from "@/server/services/createPixPayment";
import { uploadProcessDocument } from "@/server/services/uploadProcessDocument";

export async function uploadDocumentAction(formData: FormData) {
  const user = await requireUser();

  const processId = String(formData.get("processId") ?? "");
  const file = formData.get("file");
  // Tipo vindo do card. Ausente => identificacao (compatibilidade com o form antigo).
  const rawKind = formData.get("documentKind") ?? "IDENTIFICACAO_PESSOAL";

  const base = `/processos/${encodeURIComponent(processId)}`;
  if (!(file instanceof File)) {
    redirect(`${base}?erro=${encodeURIComponent("Selecione um arquivo ficticio.")}`);
  }
  if (!isDocumentKind(rawKind)) {
    redirect(`${base}?erro=${encodeURIComponent("Tipo de documento invalido.")}`);
  }

  const result = await uploadProcessDocument(user, processId, file, rawKind);
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(`${base}?ok=${encodeURIComponent(rawKind)}`);
}

/**
 * Aplica MANUALMENTE uma sugestao de preenchimento no destino do processo.
 *
 * O formulario envia apenas QUAL sugestao e a confirmacao do usuario. O VALOR
 * nunca vem do cliente: o service regenera as sugestoes no servidor a partir dos
 * documentos conferidos. Campos fora do destino sao recusados pelo dominio.
 */
export async function applyDocumentFieldSuggestionAction(formData: FormData) {
  const user = await requireUser();

  const processId = String(formData.get("processId") ?? "");
  const suggestionId = String(formData.get("suggestionId") ?? "");
  // Checkbox nao marcada nem aparece no FormData — ausencia significa "nao".
  const confirmed = formData.get("confirmacao") === "on";

  const base = `/processos/${encodeURIComponent(processId)}`;

  const result = await applyDestinationSuggestion(user, processId, suggestionId, confirmed);
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(`${base}?aplicado=${encodeURIComponent(result.target)}`);
}

/** Gera a cobranca Pix SANDBOX/DEV do proprio processo (valor ficticio R$ 100). */
export async function createPixPaymentAction(formData: FormData) {
  const user = await requireUser();
  const processId = String(formData.get("processId") ?? "");
  const base = `/processos/${encodeURIComponent(processId)}`;

  const result = await createPixPayment(user, processId);
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(base);
}

/**
 * Simula o pagamento aprovado — FERRAMENTA DEV, so existe no modo mock.
 * eventId deterministico (SIM-<paymentId>): clicar duas vezes exercita a
 * idempotencia do webhook. NUNCA usar em producao.
 */
export async function simulatePaymentApprovedAction(formData: FormData) {
  const user = await requireUser();
  const processId = String(formData.get("processId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  const base = `/processos/${encodeURIComponent(processId)}`;

  if ((AUTH_MODE as string) !== "mock") {
    redirect(`${base}?erro=${encodeURIComponent("Simulacao disponivel apenas em modo dev/mock.")}`);
  }

  // Dono do processo + pagamento pertence ao processo.
  const process = await findProcessByIdForUser(processId, user.id).catch(() => null);
  if (!process) redirect(`${base}?erro=${encodeURIComponent("Processo nao encontrado.")}`);
  const payments = await listPaymentsForProcess(processId).catch(() => []);
  const payment = payments.find((candidate) => candidate.id === paymentId);
  if (!payment?.providerPaymentId) {
    redirect(`${base}?erro=${encodeURIComponent("Cobranca nao encontrada.")}`);
  }

  const result = await confirmPixPayment(`SIM-${payment.id}`, payment.providerPaymentId);
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(`${base}?pago=1`);
}
