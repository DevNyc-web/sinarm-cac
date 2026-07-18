import { type NoteVisibility } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";

/**
 * Repositorio de notas/mensagens do processo (docs/11 §5.11/§17).
 * O corpo e texto livre: a UI avisa para NAO escrever PII (docs/11 §19).
 */

export type CreateNoteData = {
  processId: string;
  visibility: NoteVisibility;
  body: string;
  authorMockUserId: string;
  authorRole: string;
};

export function createNote(data: CreateNoteData) {
  return getPrisma().processNote.create({ data });
}

/** Notas do processo. `onlyUserVisible` limita ao que o usuario final pode ler. */
export function listNotesForProcess(processId: string, onlyUserVisible: boolean) {
  return getPrisma().processNote.findMany({
    where: {
      processId,
      visibility: onlyUserVisible ? "VISIVEL_USUARIO" : undefined,
    },
    orderBy: { createdAt: "desc" },
  });
}
