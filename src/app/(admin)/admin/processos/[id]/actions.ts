"use server";

/**
 * Server Actions do detalhe admin do processo — Fase 3.6.
 * Marcar checklist exige a permissao "review.checklist" (so ADMIN/OPERADOR —
 * docs/11 §3). FINANCEIRO/SUPORTE nao passam pelo guard.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/guards";
import { toggleChecklistItem } from "@/server/services/toggleChecklistItem";

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
