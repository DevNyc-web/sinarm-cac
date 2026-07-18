"use server";

/**
 * Server Actions da tela de revisao do processo do usuario — Fase 4.
 * Upload FICTICIO/DEV: guard de usuario + delegacao ao service.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { uploadProcessDocument } from "@/server/services/uploadProcessDocument";

export async function uploadDocumentAction(formData: FormData) {
  const user = await requireUser();

  const processId = String(formData.get("processId") ?? "");
  const file = formData.get("file");

  const base = `/processos/${encodeURIComponent(processId)}`;
  if (!(file instanceof File)) {
    redirect(`${base}?erro=${encodeURIComponent("Selecione um arquivo ficticio.")}`);
  }

  const result = await uploadProcessDocument(user, processId, file);
  if (!result.ok) {
    redirect(`${base}?erro=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(base);
  redirect(`${base}?ok=1`);
}
