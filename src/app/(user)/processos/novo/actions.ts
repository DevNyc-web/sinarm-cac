"use server";

/**
 * Server Action do formulario de novo processo Guia de Trafego — Fase 3.
 * Guard de usuario + delegacao ao service. Sem logica de negocio aqui.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { type GuiaTrafegoField } from "@/server/processes/guiaTrafegoSchema";
import { createGuiaTrafegoDraft } from "@/server/services/createGuiaTrafegoDraft";

export type NovoProcessoFormState = {
  fieldErrors?: Partial<Record<GuiaTrafegoField, string>>;
  formError?: string;
  /** Valores submetidos, para repopular o formulario em caso de erro. */
  values?: Partial<Record<GuiaTrafegoField, string>>;
};

export async function createDraftAction(
  _prev: NovoProcessoFormState,
  formData: FormData,
): Promise<NovoProcessoFormState> {
  const user = await requireUser();

  const values = {
    eventName: String(formData.get("eventName") ?? ""),
    uf: String(formData.get("uf") ?? ""),
    city: String(formData.get("city") ?? ""),
    street: String(formData.get("street") ?? ""),
    number: String(formData.get("number") ?? ""),
    firearmId: String(formData.get("firearmId") ?? ""),
    justification: String(formData.get("justification") ?? ""),
  };

  const result = await createGuiaTrafegoDraft(user.id, values);

  if (result.ok) {
    redirect(`/processos/novo/sucesso?code=${encodeURIComponent(result.code)}`);
  }

  if ("fieldErrors" in result) {
    return { fieldErrors: result.fieldErrors, values };
  }
  return { formError: result.error, values };
}
