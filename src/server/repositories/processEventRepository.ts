import { type InternalStatus } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";

/**
 * Repositorio de eventos de status do processo (docs/12 §3.5).
 * APPEND-ONLY: so cria e lista — nunca edita/apaga.
 */

export type RecordStatusEventData = {
  processId: string;
  fromStatus: InternalStatus | null;
  toStatus: InternalStatus;
  actorMockUserId: string;
  actorRole: string;
  /** Texto curto, SEM PII. */
  note?: string;
};

export function recordStatusEvent(data: RecordStatusEventData) {
  return getPrisma().processStatusEvent.create({
    data: {
      processId: data.processId,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      actorMockUserId: data.actorMockUserId,
      actorRole: data.actorRole,
      note: data.note,
    },
  });
}

/** Eventos do processo, mais antigos primeiro (ordem de linha do tempo). */
export function listStatusEvents(processId: string) {
  return getPrisma().processStatusEvent.findMany({
    where: { processId },
    orderBy: { createdAt: "asc" },
  });
}
