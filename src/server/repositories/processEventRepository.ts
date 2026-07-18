import { type InternalStatus, type ProcessEventKind } from "@prisma/client";
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

export type RecordOperationalEventData = {
  processId: string;
  kind: Exclude<ProcessEventKind, "STATUS_INTERNO">;
  /** Rotulos curtos, SEM PII (ex.: "Normal" -> "Urgente"). */
  fromValue?: string | null;
  toValue?: string | null;
  actorMockUserId: string;
  actorRole: string;
  note?: string;
};

/**
 * Registra evento operacional (status operacional, prioridade, responsavel,
 * nota) na mesma trilha append-only dos eventos de status (docs/11 §18).
 */
export function recordOperationalEvent(data: RecordOperationalEventData) {
  return getPrisma().processStatusEvent.create({
    data: {
      processId: data.processId,
      kind: data.kind,
      fromValue: data.fromValue ?? null,
      toValue: data.toValue ?? null,
      actorMockUserId: data.actorMockUserId,
      actorRole: data.actorRole,
      note: data.note,
    },
  });
}
