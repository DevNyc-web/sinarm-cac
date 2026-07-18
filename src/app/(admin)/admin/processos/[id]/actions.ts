"use server";

/**
 * Server Actions do detalhe admin do processo — Fase 3.6.
 * Marcar checklist exige a permissao "review.checklist" (so ADMIN/OPERADOR —
 * docs/11 §3). FINANCEIRO/SUPORTE nao passam pelo guard.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminRole, requirePermission } from "@/server/auth/guards";
import { createProcessNote } from "@/server/services/createProcessNote";
import { reviewProcessDocument, type ReviewDecision } from "@/server/services/reviewProcessDocument";
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
