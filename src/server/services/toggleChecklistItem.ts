/**
 * Caso de uso: marcar/desmarcar item do checklist de revisao — Fase 3.6.
 *
 * A PERMISSAO ("review.checklist" — so ADMIN/OPERADOR, docs/11 §3) e exigida
 * pelo guard na server action; aqui validamos entrada e registramos quem/quando.
 */
import { type AuthUser } from "@/server/auth/mockUsers";
import {
  checklistGroup,
  checklistLabel,
  isChecklistKey,
} from "@/server/processes/checklistDefinition";
import { setChecklistItem } from "@/server/repositories/checklistRepository";
import { findProcessByIdForAdmin } from "@/server/repositories/processRepository";

export type ToggleChecklistResult = { ok: true } | { ok: false; error: string };

export async function toggleChecklistItem(
  actor: AuthUser,
  processId: string,
  key: string,
  checked: boolean,
): Promise<ToggleChecklistResult> {
  if (!isChecklistKey(key)) {
    return { ok: false, error: "Item de checklist invalido." };
  }

  try {
    const process = await findProcessByIdForAdmin(processId);
    if (!process) return { ok: false, error: "Processo nao encontrado." };

    await setChecklistItem({
      processId,
      key,
      group: checklistGroup(key),
      label: checklistLabel(key),
      checked,
      actorMockUserId: actor.id,
      actorRole: actor.role,
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Nao foi possivel salvar. Verifique o Postgres local (npm run db:push).",
    };
  }
}
