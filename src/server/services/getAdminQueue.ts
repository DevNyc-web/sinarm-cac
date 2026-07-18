/**
 * Fila admin com filtros — VIEW MODEL (Fase 6, docs/11 §4).
 *
 * Need-to-know: a fila expoe apenas status/prioridade/responsavel/destino.
 * Nenhum metadado de documento ou arma/PCE passa por aqui, para nenhum perfil —
 * o repositorio ja usa `select` restrito (docs/11 §3/§19).
 */
import {
  type DocumentStatus,
  type OperationalStatus,
  type PaymentStatus,
  type ProcessPriority,
} from "@prisma/client";
import { findMockUser } from "@/server/auth/mockUsers";
import { listAdminQueue, type AdminQueueFilters } from "@/server/repositories/processRepository";

export type AdminQueueRow = {
  id: string;
  code: string;
  processTypeName: string;
  ownerLabel: string;
  createdAt: Date;
  operationalStatus: OperationalStatus;
  priority: ProcessPriority;
  assignedToLabel: string | null;
  paymentStatus: PaymentStatus | null;
  documentStatus: DocumentStatus | null;
  destinationLabel: string | null;
  /** Destaque na fila: pago e aguardando operacao (docs/11 §4). */
  highlighted: boolean;
};

export type { AdminQueueFilters };

export async function getAdminQueue(filters: AdminQueueFilters): Promise<AdminQueueRow[]> {
  const rows = await listAdminQueue(filters);

  return rows.map((row) => {
    const owner = findMockUser(row.userId);
    const assigned = row.assignedToMockUserId ? findMockUser(row.assignedToMockUserId) : null;
    const paymentStatus = row.payments[0]?.status ?? null;

    return {
      id: row.id,
      code: row.code,
      processTypeName: row.processType.name,
      ownerLabel: owner ? owner.name : row.userId,
      createdAt: row.createdAt,
      operationalStatus: row.operationalStatus,
      priority: row.priority,
      assignedToLabel: assigned ? assigned.name : (row.assignedToMockUserId ?? null),
      paymentStatus,
      documentStatus: row.documents[0]?.status ?? null,
      destinationLabel: row.destination
        ? `${row.destination.eventName} — ${row.destination.city}/${row.destination.uf}`
        : null,
      highlighted:
        paymentStatus === "PAGO" &&
        (row.operationalStatus === "PAGO_EM_FILA" ||
          row.operationalStatus === "EM_REVISAO_OPERACIONAL"),
    };
  });
}
