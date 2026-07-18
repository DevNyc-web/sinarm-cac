/**
 * Detalhe admin do processo — VIEW MODEL com need-to-know (docs/11 §3/§19).
 *
 * Por que existe: a pagina NAO deve receber a entidade crua do Prisma e apenas
 * "esconder" campos na renderizacao. Aqui a redacao acontece na camada de
 * servico, entao dados que o perfil nao pode ver simplesmente NAO SAEM do
 * servidor (nem no payload RSC, nem em log de erro, nem em futura API).
 *
 * Regras (docs/11 §3):
 * - `process.pii.viewFull` (ADMIN/OPERADOR/FINANCEIRO): metadados de documento
 *   e arma/PCE.
 * - Sem essa permissao (SUPORTE): so tipo + status do documento; sem arma/PCE.
 * - `storageKey` nunca e lido nas telas (so download/expurgo precisariam dele).
 * - `sha256`: o DTO carrega apenas o prefixo curto que a UI exibe; a coluna
 *   completa so e lida para quem ja tem direito aos metadados do documento.
 */
import {
  type ChecklistGroup,
  type DocumentStatus,
  type DocumentType,
  type InternalStatus,
  type ManualExecutionStatus,
  type NoteVisibility,
  type OperationalStatus,
  type PaymentStatus,
  type ProcessPriority,
  type UserFacingStatus,
} from "@prisma/client";
import { hasPermission } from "@/server/auth/guards";
import { findMockUser, type AuthUser } from "@/server/auth/mockUsers";
import { ROLE_LABELS, type Role } from "@/server/auth/roles";
import { CHECKLIST_ITEMS } from "@/server/processes/checklistDefinition";
import {
  deriveOperationalIndicators,
  type OperationalIndicators,
} from "@/server/processes/operationalSignals";
import {
  DOCUMENT_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/server/processes/statusLabels";
import { listChecklistItems } from "@/server/repositories/checklistRepository";
import { findManualExecution } from "@/server/repositories/manualExecutionRepository";
import { listNotesForProcess } from "@/server/repositories/processNoteRepository";
import { listPaymentsForProcess } from "@/server/repositories/paymentRepository";
import { listDocumentsForAdmin } from "@/server/repositories/processDocumentRepository";
import { listStatusEvents } from "@/server/repositories/processEventRepository";
import { findProcessByIdForAdmin } from "@/server/repositories/processRepository";

const SHA256_PREFIX_LENGTH = 12;

export type AdminDocumentView = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  /** Acoes de revisao liberadas para ESTE ator (docs/11 §3). */
  canBeReviewed: boolean;
  /** Campos abaixo so existem para perfis com `process.pii.viewFull`. */
  originalFileName?: string;
  mimeType?: string;
  sizeKb?: number;
  /** Prefixo do sha256 — o DTO nunca carrega o hash completo. */
  sha256Short?: string;
  rejectionReason?: string;
};

export type AdminFirearmView = {
  species: string;
  brand: string;
  model: string;
  caliber: string;
  quantity: number;
};

export type AdminPaymentView = {
  id: string;
  status: PaymentStatus;
  amountCents: number;
  provider: string;
  createdAt: Date;
  paidAt: Date | null;
  /** Referencia do PSP — so para quem tem visao completa/financeira. */
  providerRefShort?: string;
};

export type AdminChecklistView = {
  key: string;
  group: ChecklistGroup;
  label: string;
  checked: boolean;
  checkedByLabel?: string;
  checkedAt?: Date;
};

export type AdminNoteView = {
  id: string;
  visibility: NoteVisibility;
  body: string;
  authorLabel: string;
  createdAt: Date;
};

export type AdminTimelineEntry = {
  id: string;
  at: Date;
  title: string;
  detail: string;
};

export type AdminProcessDetail = {
  id: string;
  code: string;
  processTypeName: string;
  internalStatus: InternalStatus;
  userFacingStatus: UserFacingStatus;
  operationalStatus: OperationalStatus;
  priority: ProcessPriority;
  assignedToMockUserId: string | null;
  assignedToLabel: string | null;
  createdAt: Date;
  justification: string;
  owner: { name: string; email: string } | null;
  ownerFallbackId: string;
  destination: {
    eventName: string;
    uf: string;
    city: string;
    street: string;
    number: string;
  } | null;
  /** null quando o perfil nao tem `process.pii.viewFull`. */
  firearm: AdminFirearmView | null;
  firearmRestricted: boolean;
  documents: AdminDocumentView[];
  /** true quando os metadados foram omitidos por falta de permissao. */
  documentsRestricted: boolean;
  payments: AdminPaymentView[];
  checklist: AdminChecklistView[];
  notes: AdminNoteView[];
  timeline: AdminTimelineEntry[];
  /** Indicadores DERIVADOS (Fase 6.5) — nada persistido. */
  indicators: OperationalIndicators;
  audit: AdminAuditSummary;
  /** Execucao assistida MANUAL (Fase 7) — o que o humano registrou. */
  manualExecutionStatus: ManualExecutionStatus;
  manualExecution: AdminManualExecutionView | null;
};

/** Registro manual (docs/21 §6) — tudo digitado por humano, nada gerado pelo app. */
export type AdminManualExecutionView = {
  protocolNumber: string | null;
  protocolObservation: string | null;
  protocolRegisteredByLabel: string | null;
  protocolRegisteredAt: Date | null;
  gruReference: string | null;
  gruDueDate: Date | null;
  gruAmountCents: number | null;
  gruObservation: string | null;
  gruRegisteredByLabel: string | null;
  gruRegisteredAt: Date | null;
  gruPaidAt: Date | null;
  gruPaymentObservation: string | null;
  gruPaymentRegisteredByLabel: string | null;
};

/** Auditoria consolidada do processo (docs/11 §18) — contagens + ultima acao. */
export type AdminAuditSummary = {
  lastActionTitle: string | null;
  lastActionAt: Date | null;
  lastActorLabel: string | null;
  /**
   * Entradas da trilha consolidada — o mesmo que o operador ve no historico
   * (docs/11 §5.10). Inclui eventos de status/operacao E as entradas derivadas
   * de documento, checklist e pagamento; contar so `process_status_events`
   * mostraria um numero menor do que a tela exibe.
   */
  eventCount: number;
  noteCount: number;
  checklistCheckedCount: number;
  checklistTotal: number;
  currentPaymentStatus: PaymentStatus | null;
  currentDocumentStatus: DocumentStatus | null;
};

function actorLabel(mockUserId: string, role: string): string {
  const mockUser = findMockUser(mockUserId);
  const roleLabel = ROLE_LABELS[role as Role] ?? role;
  return `${mockUser ? mockUser.name : mockUserId} (${roleLabel})`;
}

/**
 * Carrega o detalhe do processo JA REDIGIDO para o perfil do ator.
 * Retorna null quando o processo nao existe (ou o banco esta indisponivel —
 * quem chama trata como nao encontrado).
 */
export async function getAdminProcessDetail(
  actor: AuthUser,
  processId: string,
): Promise<AdminProcessDetail | null> {
  const canViewFull = hasPermission(actor, "process.pii.viewFull");
  const canReviewDocument = hasPermission(actor, "document.review");

  // As permissoes entram na QUERY: sem `process.pii.viewFull`, arma/PCE e
  // metadados de documento nem sao lidos do banco (docs/11 §3/§19).
  const process = await findProcessByIdForAdmin(processId, canViewFull);
  if (!process) return null;

  const [statusEvents, checklistRows, documentRows, paymentRows, noteRows, manualRow] =
    await Promise.all([
      listStatusEvents(process.id),
      listChecklistItems(process.id),
      listDocumentsForAdmin(process.id, canViewFull),
      listPaymentsForProcess(process.id),
      // Perfis internos leem notas internas e mensagens; o dono le so as visiveis.
      listNotesForProcess(process.id, false),
      findManualExecution(process.id),
    ]);

  // Documentos: sem visao completa, so tipo e status saem do servidor.
  const documents: AdminDocumentView[] = documentRows.map((doc) => {
    const base: AdminDocumentView = {
      id: doc.id,
      type: doc.type,
      status: doc.status,
      canBeReviewed:
        canReviewDocument &&
        (doc.status === "ENVIADO" || doc.status === "EM_ANALISE" || doc.status === "PENDENTE"),
    };
    if (!canViewFull) return base;
    return {
      ...base,
      originalFileName: doc.originalFileName,
      mimeType: doc.mimeType,
      sizeKb: doc.sizeBytes === undefined ? undefined : Math.max(1, Math.round(doc.sizeBytes / 1024)),
      sha256Short: doc.sha256?.slice(0, SHA256_PREFIX_LENGTH),
      rejectionReason: doc.rejectionReason ?? undefined,
    };
  });

  const payments: AdminPaymentView[] = paymentRows.map((payment) => ({
    id: payment.id,
    status: payment.status,
    amountCents: payment.amountCents,
    provider: payment.provider,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
    providerRefShort:
      canViewFull && payment.providerPaymentId
        ? payment.providerPaymentId.slice(0, 20)
        : undefined,
  }));

  const checklist: AdminChecklistView[] = CHECKLIST_ITEMS.map((definition) => {
    const row = checklistRows.find((candidate) => candidate.key === definition.key);
    return {
      key: definition.key,
      group: definition.group as ChecklistGroup,
      label: definition.label,
      checked: row?.checked ?? false,
      checkedByLabel:
        row?.checked && row.checkedByMockUserId
          ? actorLabel(row.checkedByMockUserId, row.checkedByRole ?? "?")
          : undefined,
      checkedAt: row?.checkedAt ?? undefined,
    };
  });

  const owner = findMockUser(process.userId);
  const assigned = process.assignedToMockUserId
    ? findMockUser(process.assignedToMockUserId)
    : null;

  const notes: AdminNoteView[] = noteRows.map((note) => ({
    id: note.id,
    visibility: note.visibility,
    body: note.body,
    authorLabel: actorLabel(note.authorMockUserId, note.authorRole),
    createdAt: note.createdAt,
  }));

  // Linha do tempo — nomes de arquivo tambem respeitam o need-to-know.
  const timeline: AdminTimelineEntry[] = [];
  const hasCreationEvent = statusEvents.some((event) => event.fromStatus === null);
  if (!hasCreationEvent) {
    // Rascunhos criados antes da Fase 3.6 nao tem evento de criacao persistido.
    timeline.push({
      id: `creation-${process.id}`,
      at: process.createdAt,
      title: "Rascunho criado",
      detail: owner ? `por ${owner.name} (Usuario)` : `por ${process.userId}`,
    });
  }
  for (const event of statusEvents) {
    let title: string;
    if (event.kind === "STATUS_INTERNO" && event.toStatus) {
      title =
        event.fromStatus === null
          ? `Rascunho criado — status ${INTERNAL_STATUS_LABELS[event.toStatus]}`
          : `Status: ${INTERNAL_STATUS_LABELS[event.fromStatus]} → ${INTERNAL_STATUS_LABELS[event.toStatus]}`;
    } else {
      const transition =
        event.fromValue && event.toValue
          ? `${event.fromValue} → ${event.toValue}`
          : (event.toValue ?? "-");
      const prefix: Record<string, string> = {
        STATUS_OPERACIONAL: "Status operacional",
        PRIORIDADE: "Prioridade",
        RESPONSAVEL: "Responsavel",
        NOTA: "Registro",
        // Fase 7 — deixa explicito que foi registro de acao MANUAL, feita fora
        // do app; nunca sugerir que o sistema executou algo no orgao.
        EXECUCAO_MANUAL: "Etapa manual (registrada)",
        PROTOCOLO_MANUAL: "Protocolo registrado manualmente",
        GRU_MANUAL: "GRU registrada manualmente",
        PAGAMENTO_GRU_MANUAL: "Pagamento da GRU registrado",
      };
      title = `${prefix[event.kind] ?? "Evento"}: ${transition}`;
    }
    timeline.push({
      id: event.id,
      at: event.createdAt,
      title,
      detail: `por ${actorLabel(event.actorMockUserId, event.actorRole)}${event.note ? ` · ${event.note}` : ""}`,
    });
  }
  for (const item of checklist) {
    if (item.checked && item.checkedAt && item.checkedByLabel) {
      timeline.push({
        id: `check-${item.key}`,
        at: item.checkedAt,
        title: `Checklist: ${item.label}`,
        detail: `marcado por ${item.checkedByLabel}`,
      });
    }
  }
  for (const payment of paymentRows) {
    timeline.push({
      id: `pay-${payment.id}`,
      at: payment.createdAt,
      title: `Cobranca Pix criada (sandbox/dev) — R$ ${(payment.amountCents / 100).toFixed(2).replace(".", ",")}`,
      detail: `provider ${payment.provider} · status atual: ${PAYMENT_STATUS_LABELS[payment.status]}`,
    });
  }
  for (const doc of documentRows) {
    const docName = canViewFull ? doc.originalFileName : "documento (acesso restrito)";
    timeline.push({
      id: `doc-up-${doc.id}`,
      at: doc.createdAt,
      title: `Documento enviado: ${docName}`,
      detail: `por ${actorLabel(doc.uploadedByMockUserId, "USER")}`,
    });
    if (doc.reviewedAt && doc.reviewedByMockUserId) {
      timeline.push({
        id: `doc-rev-${doc.id}`,
        at: doc.reviewedAt,
        title: `Documento ${DOCUMENT_STATUS_LABELS[doc.status].toLowerCase()}: ${docName}`,
        detail: `por ${actorLabel(doc.reviewedByMockUserId, doc.reviewedByRole ?? "?")}${
          canViewFull && doc.rejectionReason ? ` · motivo: ${doc.rejectionReason}` : ""
        }`,
      });
    }
  }
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  // Indicadores derivados (Fase 6.5) a partir do estado ja carregado.
  const currentPaymentStatus = paymentRows[0]?.status ?? null;
  const currentDocumentStatus = documentRows[0]?.status ?? null;
  const checkedItems = checklistRows.filter((row) => row.checked);
  const indicators = deriveOperationalIndicators({
    operationalStatus: process.operationalStatus,
    createdAt: process.createdAt,
    lastEventAt: statusEvents.at(-1)?.createdAt ?? null,
    hasDestination: process.destination !== null,
    documentStatus: currentDocumentStatus,
    paymentStatus: currentPaymentStatus,
    checkedRevisionCount: checkedItems.filter((row) => row.group === "REVISAO").length,
    checkedGruCount: checkedItems.filter((row) => row.group === "GRU").length,
    hasAssignee: process.assignedToMockUserId !== null,
  });

  const lastEntry = timeline.at(-1) ?? null;
  const audit: AdminAuditSummary = {
    lastActionTitle: lastEntry?.title ?? null,
    lastActionAt: lastEntry?.at ?? null,
    lastActorLabel: lastEntry?.detail ?? null,
    eventCount: timeline.length,
    noteCount: noteRows.length,
    checklistCheckedCount: checkedItems.length,
    checklistTotal: CHECKLIST_ITEMS.length,
    currentPaymentStatus,
    currentDocumentStatus,
  };

  const manualExecution: AdminManualExecutionView | null = manualRow
    ? {
        protocolNumber: manualRow.protocolNumber,
        protocolObservation: manualRow.protocolObservation,
        protocolRegisteredByLabel: manualRow.protocolRegisteredByMockUserId
          ? actorLabel(
              manualRow.protocolRegisteredByMockUserId,
              manualRow.protocolRegisteredByRole ?? "?",
            )
          : null,
        protocolRegisteredAt: manualRow.protocolRegisteredAt,
        gruReference: manualRow.gruReference,
        gruDueDate: manualRow.gruDueDate,
        gruAmountCents: manualRow.gruAmountCents,
        gruObservation: manualRow.gruObservation,
        gruRegisteredByLabel: manualRow.gruRegisteredByMockUserId
          ? actorLabel(manualRow.gruRegisteredByMockUserId, manualRow.gruRegisteredByRole ?? "?")
          : null,
        gruRegisteredAt: manualRow.gruRegisteredAt,
        gruPaidAt: manualRow.gruPaidAt,
        gruPaymentObservation: manualRow.gruPaymentObservation,
        gruPaymentRegisteredByLabel: manualRow.gruPaymentRegisteredByMockUserId
          ? actorLabel(
              manualRow.gruPaymentRegisteredByMockUserId,
              manualRow.gruPaymentRegisteredByRole ?? "?",
            )
          : null,
      }
    : null;

  return {
    indicators,
    audit,
    manualExecutionStatus: process.manualExecutionStatus,
    manualExecution,
    id: process.id,
    code: process.code,
    processTypeName: process.processType.name,
    internalStatus: process.internalStatus,
    userFacingStatus: process.userFacingStatus,
    operationalStatus: process.operationalStatus,
    priority: process.priority,
    assignedToMockUserId: process.assignedToMockUserId,
    assignedToLabel: assigned ? assigned.name : process.assignedToMockUserId,
    createdAt: process.createdAt,
    justification: process.justification,
    owner: owner ? { name: owner.name, email: owner.email } : null,
    ownerFallbackId: process.userId,
    destination: process.destination
      ? {
          eventName: process.destination.eventName,
          uf: process.destination.uf,
          city: process.destination.city,
          street: process.destination.street,
          number: process.destination.number,
        }
      : null,
    firearm:
      canViewFull && process.firearm
        ? {
            species: process.firearm.species,
            brand: process.firearm.brand,
            model: process.firearm.model,
            caliber: process.firearm.caliber,
            quantity: process.firearm.quantity,
          }
        : null,
    firearmRestricted: !canViewFull,
    documents,
    documentsRestricted: !canViewFull,
    payments,
    checklist,
    notes,
    timeline,
  };
}
