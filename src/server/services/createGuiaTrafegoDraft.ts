/**
 * Caso de uso: criar rascunho de processo Guia de Trafego — Fase 3.
 *
 * Camada de servico (docs/16 §4): valida a entrada (Zod), resolve a arma no
 * catalogo MOCK e delega a persistencia ao repositorio. Nao conhece HTTP/form.
 *
 * Restricoes da fase: SEM PII, SEM pagamento, SEM upload, SEM protocolo real.
 * O `code` gerado e claramente de desenvolvimento (prefixo GT-DEV-).
 */
import { randomUUID } from "node:crypto";
import { guiaTrafegoDraftSchema, type GuiaTrafegoDraftInput } from "@/server/processes/guiaTrafegoSchema";
import { findMockFirearm } from "@/server/processes/mockFirearms";
import { createDraftProcess } from "@/server/repositories/processRepository";

export const GUIA_TRAFEGO_TYPE_CODE = "GUIA_TRAFEGO_PF_CAC";

export type CreateDraftResult =
  | { ok: true; code: string }
  | { ok: false; fieldErrors: Partial<Record<keyof GuiaTrafegoDraftInput, string>> }
  | { ok: false; error: string };

/** Codigo de rascunho de desenvolvimento — NAO e protocolo (docs/10 §8). */
function generateDraftCode(): string {
  return `GT-DEV-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createGuiaTrafegoDraft(
  userId: string,
  input: unknown,
): Promise<CreateDraftResult> {
  const parsed = guiaTrafegoDraftSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof GuiaTrafegoDraftInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof GuiaTrafegoDraftInput | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const firearm = findMockFirearm(parsed.data.firearmId);
  if (!firearm) {
    return { ok: false, fieldErrors: { firearmId: "Arma/PCE invalida." } };
  }

  try {
    const process = await createDraftProcess({
      code: generateDraftCode(),
      userId,
      processTypeCode: GUIA_TRAFEGO_TYPE_CODE,
      justification: parsed.data.justification,
      destination: {
        eventName: parsed.data.eventName,
        uf: parsed.data.uf,
        city: parsed.data.city,
        street: parsed.data.street,
        number: parsed.data.number,
      },
      firearm,
    });
    return { ok: true, code: process.code };
  } catch (error) {
    // Banco local fora do ar / seed ausente: falha honesta, sem stack para a UI.
    const message =
      error instanceof Error && error.message.includes("nao encontrado")
        ? error.message
        : "Nao foi possivel salvar o rascunho. Verifique se o Postgres local esta ativo (npm run db:push && npm run seed).";
    return { ok: false, error: message };
  }
}
