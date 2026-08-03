"use server";

/**
 * Server Actions do detalhe admin do processo — Fase 3.6.
 * Marcar checklist exige a permissao "review.checklist" (so ADMIN/OPERADOR —
 * docs/11 §3). FINANCEIRO/SUPORTE nao passam pelo guard.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminRole, requirePermission } from "@/server/auth/guards";
import { cancelProcess } from "@/server/services/cancelProcess";
import { createProcessNote } from "@/server/services/createProcessNote";
import {
  advanceManualExecution,
  registerManualGru,
  registerManualGruPayment,
  registerManualProtocol,
} from "@/server/services/manualExecution";
import { approveDocumentOutOfFlow } from "@/server/services/approveDocumentOutOfFlow";
import { reopenDocumentReview } from "@/server/services/reopenDocumentReview";
import { reviewProcessDocument, type ReviewDecision } from "@/server/services/reviewProcessDocument";
import { submitToAutomationQueue } from "@/server/services/submitToAutomationQueue";
import { toggleChecklistItem } from "@/server/services/toggleChecklistItem";
import {
  assignProcess,
  changeOperationalStatus,
  changePriority,
} from "@/server/services/updateProcessOperations";

/** Redireciona de volta ao detalhe, com erro na query quando houver. */
function backTo(processId: string, error?: string): never {
  const base = `/admin/processos/${encodeURIComponent(processId)}`;
  if (error) redirect(`${base}?erro=${encodeURIComponent(error)}`);
  revalidatePath(base);
  redirect(base);
}

export async function toggleChecklistAction(formData: FormData) {
  const actor = await requirePermission("review.checklist");

  const processId = String(formData.get("processId") ?? "");
  const key = String(formData.get("key") ?? "");
  const nextChecked = String(formData.get("nextChecked") ?? "") === "true";

  const result = await toggleChecklistItem(actor, processId, key, nextChecked);

  const base = `/admin/processos/${encodeURIComponent(processId)}`;
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(base);
}

/** Aprovar/rejeitar documento ficticio — exige "document.review" (ADMIN/OPERADOR). */
export async function reviewDocumentAction(formData: FormData) {
  const actor = await requirePermission("document.review");

  const processId = String(formData.get("processId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const decisionRaw = String(formData.get("decision") ?? "");
  const rejectionReason = String(formData.get("rejectionReason") ?? "");

  const base = `/admin/processos/${encodeURIComponent(processId)}`;
  if (decisionRaw !== "APROVADO" && decisionRaw !== "REJEITADO") {
    redirect(`${base}?erro=${encodeURIComponent("Decisao invalida.")}`);
  }

  const result = await reviewProcessDocument(
    actor,
    documentId,
    decisionRaw as ReviewDecision,
    rejectionReason,
  );
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(base);
}

/**
 * Reabrir conferencia documental — exige "document.review.reopen" (docs/50 §5).
 *
 * Permissao PROPRIA, nao `document.review`: desfazer a decisao de outra pessoa
 * e ato distinto de conferir. Hoje so ADMIN a tem.
 */
export async function reopenDocumentReviewAction(formData: FormData) {
  const actor = await requirePermission("document.review.reopen");

  const processId = String(formData.get("processId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const reason = String(formData.get("reopenReason") ?? "");

  const base = `/admin/processos/${encodeURIComponent(processId)}`;
  const result = await reopenDocumentReview(actor, documentId, reason);
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(base);
}

/**
 * Registrar aprovacao documental feita FORA do fluxo normal — exige
 * "document.review.approveOutOfFlow" (docs/50 §6).
 *
 * Permissao PROPRIA, nao `document.review`: assinar uma conferencia feita por
 * outro canal e ato distinto de conferir pelo formulario. Hoje so ADMIN a tem.
 */
export async function approveDocumentOutOfFlowAction(formData: FormData) {
  const actor = await requirePermission("document.review.approveOutOfFlow");

  const processId = String(formData.get("processId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const reason = String(formData.get("outOfFlowReason") ?? "");

  const base = `/admin/processos/${encodeURIComponent(processId)}`;
  const result = await approveDocumentOutOfFlow(actor, documentId, reason);
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(base);
}

/** Atribuir/trocar responsavel — exige "process.assign" (ADMIN/OPERADOR). */
export async function assignProcessAction(formData: FormData) {
  const actor = await requirePermission("process.assign");
  const processId = String(formData.get("processId") ?? "");
  const assigneeRaw = String(formData.get("assigneeId") ?? "");

  const result = await assignProcess(actor, processId, assigneeRaw || null);
  backTo(processId, result.ok ? undefined : result.error);
}

/** Alterar prioridade — exige "process.priority" (ADMIN/OPERADOR). */
export async function changePriorityAction(formData: FormData) {
  const actor = await requirePermission("process.priority");
  const processId = String(formData.get("processId") ?? "");

  const result = await changePriority(actor, processId, String(formData.get("priority") ?? ""));
  backTo(processId, result.ok ? undefined : result.error);
}

/** Mover status operacional — exige "process.operationalStatus" (ADMIN/OPERADOR). */
export async function changeOperationalStatusAction(formData: FormData) {
  const actor = await requirePermission("process.operationalStatus");
  const processId = String(formData.get("processId") ?? "");

  const result = await changeOperationalStatus(
    actor,
    processId,
    String(formData.get("operationalStatus") ?? ""),
  );
  backTo(processId, result.ok ? undefined : result.error);
}

/**
 * Enviar processo pronto para a FILA DE AUTOMACAO futura (docs/25).
 * Exige "automation.queue.submit" (ADMIN/OPERADOR). O gate NAO executa
 * automacao, NAO acessa Gov.br/SINARM: apenas marca o processo na trilha.
 * A prontidao e regenerada no servico — o formulario so informa a confirmacao.
 */
export async function submitToAutomationQueueAction(formData: FormData) {
  const actor = await requirePermission("automation.queue.submit");
  const processId = String(formData.get("processId") ?? "");
  const confirmed = formData.get("confirmacao") === "on";

  const result = await submitToAutomationQueue(actor, processId, confirmed);
  backTo(processId, result.ok ? undefined : result.error);
}

/**
 * Fase 7 — registrar avanco da EXECUCAO MANUAL feita fora do app.
 * Exige "manual.execution.register" (ADMIN/OPERADOR). O app nao executa nada.
 */
export async function advanceManualExecutionAction(formData: FormData) {
  const actor = await requirePermission("manual.execution.register");
  const processId = String(formData.get("processId") ?? "");

  const result = await advanceManualExecution(
    actor,
    processId,
    String(formData.get("manualStatus") ?? ""),
    String(formData.get("observation") ?? ""),
    formData.get("declared") === "on",
  );
  backTo(processId, result.ok ? undefined : result.error);
}

/** Fase 7 — registrar o protocolo obtido pelo humano no orgao (ficticio/dev). */
export async function registerManualProtocolAction(formData: FormData) {
  const actor = await requirePermission("manual.execution.register");
  const processId = String(formData.get("processId") ?? "");

  const result = await registerManualProtocol(
    actor,
    processId,
    String(formData.get("protocolNumber") ?? ""),
    String(formData.get("observation") ?? ""),
    formData.get("declared") === "on",
  );
  backTo(processId, result.ok ? undefined : result.error);
}

/** Fase 7 — registrar os dados da GRU lidos pelo humano (ficticios/dev). */
export async function registerManualGruAction(formData: FormData) {
  const actor = await requirePermission("manual.execution.register");
  const processId = String(formData.get("processId") ?? "");

  const result = await registerManualGru(
    actor,
    processId,
    String(formData.get("gruReference") ?? ""),
    String(formData.get("gruDueDate") ?? ""),
    String(formData.get("gruAmount") ?? ""),
    String(formData.get("observation") ?? ""),
  );
  backTo(processId, result.ok ? undefined : result.error);
}

/**
 * Fase 7 — registrar o pagamento da GRU pela EMPRESA (docs/11 §9).
 * Exige "payment.gru.register" (ADMIN/FINANCEIRO) — segregacao de funcoes:
 * quem executou o protocolo nao e quem libera o pagamento.
 */
export async function registerManualGruPaymentAction(formData: FormData) {
  const actor = await requirePermission("payment.gru.register");
  const processId = String(formData.get("processId") ?? "");

  const result = await registerManualGruPayment(
    actor,
    processId,
    String(formData.get("observation") ?? ""),
  );
  backTo(processId, result.ok ? undefined : result.error);
}

/**
 * Cancelar processo (cancelamento REAL) — exige "process.cancel" (ADMIN-only,
 * docs/51/docs/53). `cancelProcess` ja checa a mesma permissao internamente
 * (decisao do proprio service, docs/51) — chamar `requirePermission` aqui e
 * so para manter o mesmo padrao de erro/redirect das demais actions;
 * `hasPermission` e idempotente, checar duas vezes nao muda o resultado.
 *
 * Redireciona com `?sucesso=` em vez de so `revalidatePath` (diferente das
 * demais acoes desta pagina) porque docs/53 pede uma mensagem de sucesso
 * explicita para esta acao especifica — cancelamento e mais serio que mover
 * prioridade/responsavel, que nunca tiveram esse requisito.
 */
export async function cancelProcessAction(formData: FormData) {
  const actor = await requirePermission("process.cancel");
  const processId = String(formData.get("processId") ?? "");
  const reason = String(formData.get("cancelReason") ?? "");

  const base = `/admin/processos/${encodeURIComponent(processId)}`;
  const result = await cancelProcess(actor, processId, reason);
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(`${base}?sucesso=${encodeURIComponent("Processo cancelado operacionalmente.")}`);
}

/**
 * Criar nota interna ou mensagem ao usuario. O guard aqui e apenas "perfil
 * interno"; a permissao especifica por visibilidade e checada no service
 * (`note.internal` vs `message.send`) — docs/11 §3.
 */
export async function createNoteAction(formData: FormData) {
  const actor = await requireAdminRole();
  const processId = String(formData.get("processId") ?? "");

  const result = await createProcessNote(
    actor,
    processId,
    String(formData.get("visibility") ?? ""),
    String(formData.get("body") ?? ""),
  );
  backTo(processId, result.ok ? undefined : result.error);
}
