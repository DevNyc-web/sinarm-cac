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
import {
  deriveOperationalIndicators,
  type OperationalSignal,
  type ReadinessLevel,
  type SlaStatus,
} from "@/server/processes/operationalSignals";
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
  // Indicadores derivados (Fase 6.5) — nada persistido.
  signals: OperationalSignal[];
  readinessLevel: ReadinessLevel;
  readinessMetCount: number;
  readinessTotal: number;
  slaStatus: SlaStatus | null;
  hoursSinceCreated: number | null;
};

export type { AdminQueueFilters };

export async function getAdminQueue(filters: AdminQueueFilters): Promise<AdminQueueRow[]> {
  const rows = await listAdminQueue(filters);
  const now = new Date();

  return rows.map((row) => {
    const owner = findMockUser(row.userId);
    const assigned = row.assignedToMockUserId ? findMockUser(row.assignedToMockUserId) : null;
    const paymentStatus = row.payments[0]?.status ?? null;

    const indicators = deriveOperationalIndicators(
      {
        operationalStatus: row.operationalStatus,
        createdAt: row.createdAt,
        lastEventAt: row.statusEvents[0]?.createdAt ?? null,
        hasDestination: row.destination !== null,
        documentStatus: row.documents[0]?.status ?? null,
        paymentStatus,
        checkedRevisionCount: row.checklistItems.filter((item) => item.group === "REVISAO").length,
        checkedGruCount: row.checklistItems.filter((item) => item.group === "GRU").length,
        hasAssignee: row.assignedToMockUserId !== null,
      },
      now,
    );

    return {
      signals: indicators.signals,
      readinessLevel: indicators.readinessLevel,
      readinessMetCount: indicators.readinessMetCount,
      readinessTotal: indicators.readinessTotal,
      slaStatus: indicators.sla?.status ?? null,
      hoursSinceCreated: indicators.sla?.hoursSinceCreated ?? null,
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
