/**
 * Sinalizadores, SLA e prontidao operacional — Fase 6.5 (docs/11 §4/§5).
 *
 * DECISAO DE MODELAGEM: tudo aqui e **DERIVADO** do estado que ja existe
 * (documento, pagamento, checklists, destino, responsavel, status operacional).
 * Nada e persistido. Motivos:
 *  - sinalizador guardado em coluna/JSON **envelhece**: se o documento e
 *    aprovado e ninguem recalcula, a flag mente. Derivado nunca diverge.
 *  - zero mudanca de schema, zero migration, zero backfill.
 *  - `BLOQUEIO_MANUAL` reaproveita o `operationalStatus = BLOQUEADO` que a
 *    equipe ja controla (Fase 6) — nao ha estado novo para manter em dia.
 * Se algum dia for preciso *filtrar no banco* por sinalizador, ai sim vale
 * materializar em coluna — com recalculo nas transicoes.
 *
 * Modulo PURO: sem Prisma, sem I/O. Recebe um retrato e devolve leitura.
 */
import {
  type DocumentStatus,
  type OperationalStatus,
  type PaymentStatus,
} from "@prisma/client";
import { type Role } from "@/server/auth/roles";
import { checklistItemsByGroup } from "./checklistDefinition";

export const REVISAO_TOTAL = checklistItemsByGroup("REVISAO").length;
export const GRU_TOTAL = checklistItemsByGroup("GRU").length;

/** Prazo operacional FICTICIO do ambiente dev (nao e promessa ao usuario). */
export const SLA_HOURS = 72;
/** Faixa de "atencao" antes do vencimento. */
export const SLA_WARNING_HOURS = 24;

export type OperationalSignal =
  | "DOCUMENTO_PENDENTE"
  | "DESTINO_INCOMPLETO"
  | "PAGAMENTO_PENDENTE"
  | "REVISAO_OPERACIONAL_PENDENTE"
  | "PRONTO_PARA_CHECKPOINT_GRU"
  | "BLOQUEIO_MANUAL";

export const SIGNAL_LABELS: Record<OperationalSignal, string> = {
  DOCUMENTO_PENDENTE: "Documento pendente",
  DESTINO_INCOMPLETO: "Destino incompleto",
  PAGAMENTO_PENDENTE: "Pagamento pendente",
  REVISAO_OPERACIONAL_PENDENTE: "Revisao operacional pendente",
  PRONTO_PARA_CHECKPOINT_GRU: "Pronto para checkpoint GRU",
  BLOQUEIO_MANUAL: "Bloqueio manual",
};

export type ReadinessLevel = "NAO_PRONTO" | "QUASE_PRONTO" | "PRONTO_PARA_PROTOCOLO_MANUAL";

export const READINESS_LABELS: Record<ReadinessLevel, string> = {
  NAO_PRONTO: "Nao pronto",
  QUASE_PRONTO: "Quase pronto",
  PRONTO_PARA_PROTOCOLO_MANUAL: "Pronto para protocolo manual",
};

export type SlaStatus = "DENTRO_DO_PRAZO" | "ATENCAO" | "ATRASADO";

export const SLA_LABELS: Record<SlaStatus, string> = {
  DENTRO_DO_PRAZO: "Dentro do prazo",
  ATENCAO: "Atencao",
  ATRASADO: "Atrasado",
};

/** Retrato minimo do processo — so o necessario para derivar os indicadores. */
export type ProcessSnapshot = {
  operationalStatus: OperationalStatus;
  createdAt: Date;
  lastEventAt: Date | null;
  hasDestination: boolean;
  documentStatus: DocumentStatus | null;
  paymentStatus: PaymentStatus | null;
  checkedRevisionCount: number;
  checkedGruCount: number;
  hasAssignee: boolean;
};

export type ReadinessCriterion = {
  label: string;
  met: boolean;
};

export type PendingAction = {
  what: string;
  /** Perfil sugerido para atuar (docs/11 §2/§3). */
  suggestedRole: Role;
};

export type SlaView = {
  createdAt: Date;
  hoursSinceCreated: number;
  hoursSinceLastEvent: number | null;
  /** Vencimento operacional FICTICIO (dev). */
  dueAt: Date;
  status: SlaStatus;
};

export type OperationalIndicators = {
  signals: OperationalSignal[];
  readinessLevel: ReadinessLevel;
  readinessCriteria: ReadinessCriterion[];
  readinessMetCount: number;
  readinessTotal: number;
  sla: SlaView | null;
  pendings: PendingAction[];
};

function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 36e5));
}

function isClosed(status: OperationalStatus): boolean {
  return status === "CANCELADO_DEV";
}

/** Sinalizadores derivados (docs/11 §4: "sinalizadores" da fila). */
export function deriveSignals(snapshot: ProcessSnapshot): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  if (isClosed(snapshot.operationalStatus)) return signals;

  if (snapshot.operationalStatus === "BLOQUEADO") signals.push("BLOQUEIO_MANUAL");
  if (snapshot.documentStatus !== "APROVADO") signals.push("DOCUMENTO_PENDENTE");
  if (!snapshot.hasDestination) signals.push("DESTINO_INCOMPLETO");
  if (snapshot.paymentStatus !== "PAGO") signals.push("PAGAMENTO_PENDENTE");
  if (snapshot.checkedRevisionCount < REVISAO_TOTAL) signals.push("REVISAO_OPERACIONAL_PENDENTE");

  // So sinaliza o checkpoint quando o resto do caminho ja esta limpo.
  const readyForCheckpoint =
    snapshot.documentStatus === "APROVADO" &&
    snapshot.paymentStatus === "PAGO" &&
    snapshot.hasDestination &&
    snapshot.checkedRevisionCount >= REVISAO_TOTAL &&
    snapshot.checkedGruCount < GRU_TOTAL &&
    snapshot.operationalStatus !== "BLOQUEADO";
  if (readyForCheckpoint) signals.push("PRONTO_PARA_CHECKPOINT_GRU");

  return signals;
}

/** Criterios de prontidao (docs/11 §7 — conferencia humana antes do ato). */
export function deriveReadiness(snapshot: ProcessSnapshot): {
  level: ReadinessLevel;
  criteria: ReadinessCriterion[];
  metCount: number;
} {
  const blocked =
    snapshot.operationalStatus === "BLOQUEADO" || isClosed(snapshot.operationalStatus);

  const criteria: ReadinessCriterion[] = [
    { label: "Documento aprovado", met: snapshot.documentStatus === "APROVADO" },
    { label: "Pagamento confirmado (sandbox)", met: snapshot.paymentStatus === "PAGO" },
    {
      label: `Checklist de revisao concluido (${snapshot.checkedRevisionCount}/${REVISAO_TOTAL})`,
      met: snapshot.checkedRevisionCount >= REVISAO_TOTAL,
    },
    {
      label: `Checklist GRU concluido (${snapshot.checkedGruCount}/${GRU_TOTAL})`,
      met: snapshot.checkedGruCount >= GRU_TOTAL,
    },
    { label: "Sem bloqueios ativos", met: !blocked },
    { label: "Responsavel atribuido", met: snapshot.hasAssignee },
  ];

  const metCount = criteria.filter((criterion) => criterion.met).length;
  let level: ReadinessLevel;
  if (metCount === criteria.length) level = "PRONTO_PARA_PROTOCOLO_MANUAL";
  else if (blocked || metCount < criteria.length - 2) level = "NAO_PRONTO";
  else level = "QUASE_PRONTO";

  return { level, criteria, metCount };
}

/** SLA interno FICTICIO (dev) — nunca exibido ao usuario final. */
export function deriveSla(snapshot: ProcessSnapshot, now: Date): SlaView | null {
  if (isClosed(snapshot.operationalStatus)) return null;

  const dueAt = new Date(snapshot.createdAt.getTime() + SLA_HOURS * 36e5);
  const warningAt = new Date(dueAt.getTime() - SLA_WARNING_HOURS * 36e5);

  let status: SlaStatus = "DENTRO_DO_PRAZO";
  if (now > dueAt) status = "ATRASADO";
  else if (now > warningAt) status = "ATENCAO";

  return {
    createdAt: snapshot.createdAt,
    hoursSinceCreated: hoursBetween(snapshot.createdAt, now),
    hoursSinceLastEvent: snapshot.lastEventAt ? hoursBetween(snapshot.lastEventAt, now) : null,
    dueAt,
    status,
  };
}

/**
 * O que falta e quem deveria atuar (docs/11 §2/§3).
 * Segregacao respeitada: pagamento vai para FINANCEIRO; execucao/revisao para
 * OPERADOR; contato com o usuario para SUPORTE; excecao para ADMIN.
 */
export function derivePendings(snapshot: ProcessSnapshot): PendingAction[] {
  if (isClosed(snapshot.operationalStatus)) return [];

  const pendings: PendingAction[] = [];

  if (snapshot.operationalStatus === "BLOQUEADO") {
    pendings.push({ what: "Resolver o bloqueio manual do processo", suggestedRole: "ADMIN" });
  }
  if (!snapshot.hasAssignee) {
    pendings.push({ what: "Atribuir um responsavel pelo processo", suggestedRole: "ADMIN" });
  }
  if (!snapshot.hasDestination) {
    pendings.push({ what: "Pedir ao usuario o destino completo", suggestedRole: "SUPORTE" });
  }

  if (snapshot.documentStatus === null) {
    pendings.push({ what: "Cobrar o envio do documento (ficticio)", suggestedRole: "SUPORTE" });
  } else if (snapshot.documentStatus === "REJEITADO") {
    pendings.push({ what: "Orientar o reenvio do documento rejeitado", suggestedRole: "SUPORTE" });
  } else if (snapshot.documentStatus !== "APROVADO") {
    pendings.push({ what: "Revisar e aprovar/rejeitar o documento", suggestedRole: "OPERADOR" });
  }

  if (snapshot.paymentStatus !== "PAGO") {
    pendings.push({ what: "Conferir o pagamento (sandbox/dev)", suggestedRole: "FINANCEIRO" });
  }
  if (snapshot.checkedRevisionCount < REVISAO_TOTAL) {
    pendings.push({ what: "Concluir o checklist de revisao", suggestedRole: "OPERADOR" });
  }
  if (snapshot.checkedGruCount < GRU_TOTAL) {
    pendings.push({ what: "Concluir o checkpoint GRU (ficticio)", suggestedRole: "OPERADOR" });
  }

  return pendings;
}

/** Todos os indicadores de uma vez (usado pela fila e pelo detalhe). */
export function deriveOperationalIndicators(
  snapshot: ProcessSnapshot,
  now: Date = new Date(),
): OperationalIndicators {
  const readiness = deriveReadiness(snapshot);
  return {
    signals: deriveSignals(snapshot),
    readinessLevel: readiness.level,
    readinessCriteria: readiness.criteria,
    readinessMetCount: readiness.metCount,
    readinessTotal: readiness.criteria.length,
    sla: deriveSla(snapshot, now),
    pendings: derivePendings(snapshot),
  };
}
