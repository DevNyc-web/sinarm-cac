/**
 * Caso de uso: nota interna / mensagem ao usuario — Fase 6 (docs/11 §5.11/§17).
 *
 * RBAC (docs/11 §3):
 * - Nota INTERNA exige `note.internal` (ADMIN, OPERADOR, FINANCEIRO).
 *   FINANCEIRO usa para registrar conferencia de Pix/GRU; SUPORTE nao escreve
 *   nota interna.
 * - Mensagem VISIVEL AO USUARIO exige `message.send` (todos os perfis internos).
 *
 * Minimizacao: a UI avisa para nao escrever PII; aqui limitamos o tamanho.
 */
import { type NoteVisibility } from "@prisma/client";
import { hasPermission } from "@/server/auth/guards";
import { type AuthUser } from "@/server/auth/mockUsers";
import { createNote } from "@/server/repositories/processNoteRepository";
import { findProcessByIdForAdmin } from "@/server/repositories/processRepository";
import { recordOperationalEvent } from "@/server/repositories/processEventRepository";

export const MAX_NOTE_LENGTH = 500;

export type CreateNoteResult = { ok: true } | { ok: false; error: string };

export function isNoteVisibility(value: string): value is NoteVisibility {
  return value === "INTERNA" || value === "VISIVEL_USUARIO";
}

export async function createProcessNote(
  actor: AuthUser,
  processId: string,
  visibility: string,
  body: string,
): Promise<CreateNoteResult> {
  if (!isNoteVisibility(visibility)) return { ok: false, error: "Visibilidade invalida." };

  const text = body.trim();
  if (!text) return { ok: false, error: "Escreva o conteudo da nota." };
  if (text.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `Nota muito longa (maximo ${MAX_NOTE_LENGTH} caracteres).` };
  }

  const permission = visibility === "INTERNA" ? "note.internal" : "message.send";
  if (!hasPermission(actor, permission)) {
    return {
      ok: false,
      error:
        visibility === "INTERNA"
          ? "Seu perfil nao pode escrever nota interna (docs/11 §3)."
          : "Seu perfil nao pode enviar mensagem ao usuario.",
    };
  }

  try {
    const process = await findProcessByIdForAdmin(processId, false);
    if (!process) return { ok: false, error: "Processo nao encontrado." };

    await createNote({
      processId,
      visibility,
      body: text,
      authorMockUserId: actor.id,
      authorRole: actor.role,
    });
    await recordOperationalEvent({
      processId,
      kind: "NOTA",
      toValue: visibility === "INTERNA" ? "Nota interna" : "Mensagem ao usuario",
      actorMockUserId: actor.id,
      actorRole: actor.role,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Nao foi possivel salvar a nota." };
  }
}
