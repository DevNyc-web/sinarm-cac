import {
  type DocumentStatus,
  type ManualExecutionStatus,
  type OperationalStatus,
  type PaymentStatus,
  type ProcessPriority,
  type UserFacingStatus,
} from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { type MockFirearm } from "@/server/processes/mockFirearms";

/**
 * Repositorio de processos (docs/16 §4). Acesso a dados via Prisma.
 * Nao e chamado durante o build; roda apenas em runtime com DATABASE_URL valida.
 */

export type CreateDraftData = {
  code: string;
  userId: string;
  processTypeCode: string;
  justification: string;
  destination: {
    eventName: string;
    uf: string;
    city: string;
    street: string;
    number: string;
  };
  firearm: MockFirearm;
};

/** Cria o rascunho (processo + destino + arma) numa unica transacao. */
export async function createDraftProcess(data: CreateDraftData) {
  const prisma = getPrisma();

  const processType = await prisma.processType.findUnique({
    where: { code: data.processTypeCode },
  });
  if (!processType) {
    throw new Error(
      `ProcessType "${data.processTypeCode}" nao encontrado. Rode: npm run db:push && npm run seed`,
    );
  }

  return prisma.process.create({
    data: {
      code: data.code,
      userId: data.userId,
      processTypeId: processType.id,
      justification: data.justification,
      // internalStatus/userFacingStatus usam os defaults RASCUNHO/RECEBIDO.
      destination: {
        create: data.destination,
      },
      firearm: {
        create: {
          mockCatalogId: data.firearm.id,
          species: data.firearm.species,
          brand: data.firearm.brand,
          model: data.firearm.model,
          caliber: data.firearm.caliber,
          quantity: data.firearm.quantity,
        },
      },
      // Primeiro evento da linha do tempo (docs/12 §3.5): criacao do rascunho.
      statusEvents: {
        create: {
          fromStatus: null,
          toStatus: "RASCUNHO",
          actorMockUserId: data.userId,
          actorRole: "USER",
          note: "Rascunho criado pelo usuario (mock/dev)",
        },
      },
    },
    include: { destination: true, firearm: true },
  });
}

/** Lista os processos do usuario (mock) para o dashboard, mais recentes primeiro. */
export function listProcessesByUser(userId: string) {
  return getPrisma().process.findMany({
    where: { userId },
    include: {
      destination: true,
      processType: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Busca um processo pelo code, restrito ao dono (para a tela de sucesso). */
export function findProcessByCodeForUser(code: string, userId: string) {
  return getPrisma().process.findFirst({
    where: { code, userId },
    include: { destination: true, firearm: true, processType: true },
  });
}

/** Busca um processo pelo id, restrito ao dono (tela de revisao do usuario). */
export function findProcessByIdForUser(id: string, userId: string) {
  return getPrisma().process.findFirst({
    where: { id, userId },
    include: { destination: true, firearm: true, processType: true },
  });
}

/** Fila admin: todos os processos, mais recentes primeiro (docs/11 §4). */
export function listProcessesForAdmin() {
  return getPrisma().process.findMany({
    include: { destination: true, processType: true },
    orderBy: { createdAt: "desc" },
  });
}

export type AdminQueueFilters = {
  operationalStatus?: OperationalStatus;
  paymentStatus?: PaymentStatus;
  documentStatus?: DocumentStatus;
  /** Busca por codigo interno (ex.: GT-DEV-ABC). */
  code?: string;
  assignedToMockUserId?: string;
  sort?: "recent" | "oldest";
};

/**
 * Fila admin com filtros (docs/11 §4). `select` explicito: a fila mostra apenas
 * status/prioridade/responsavel — nenhum metadado de documento ou arma/PCE sai
 * daqui, para qualquer perfil (need-to-know, docs/11 §3/§19).
 */
export function listAdminQueue(filters: AdminQueueFilters) {
  return getPrisma().process.findMany({
    where: {
      operationalStatus: filters.operationalStatus,
      assignedToMockUserId: filters.assignedToMockUserId,
      code: filters.code ? { contains: filters.code, mode: "insensitive" } : undefined,
      payments: filters.paymentStatus ? { some: { status: filters.paymentStatus } } : undefined,
      documents: filters.documentStatus ? { some: { status: filters.documentStatus } } : undefined,
    },
    select: {
      id: true,
      code: true,
      userId: true,
      createdAt: true,
      operationalStatus: true,
      priority: true,
      assignedToMockUserId: true,
      processType: { select: { name: true } },
      destination: { select: { eventName: true, city: true, uf: true } },
      payments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      documents: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      // Base dos indicadores derivados (Fase 6.5): ultimo evento para o SLA e
      // itens marcados para prontidao. So chaves/grupo — nada sensivel.
      statusEvents: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      checklistItems: { where: { checked: true }, select: { group: true } },
    },
    orderBy: { createdAt: filters.sort === "oldest" ? "asc" : "desc" },
  });
}

export type UpdateProcessOperationsData = {
  operationalStatus?: OperationalStatus;
  priority?: ProcessPriority;
  assignedToMockUserId?: string | null;
  userFacingStatus?: UserFacingStatus;
};

/** Atualiza campos operacionais do processo (Fase 6). */
export function updateProcessOperations(id: string, data: UpdateProcessOperationsData) {
  return getPrisma().process.update({ where: { id }, data });
}

/** Colunas do destino que a aplicacao manual de sugestao pode tocar. */
export type UpdateDestinationData = Partial<
  Record<"eventName" | "uf" | "city" | "street" | "number", string>
>;

/**
 * Atualiza campos do destino do processo. Recebe um patch JA VALIDADO pelo
 * dominio (`checkSuggestionApplication`) — o repositorio nao decide o que pode
 * ser aplicado, so grava. Nunca cria destino.
 *
 * Retorna `{ count }`: 0 significa que o processo NAO tem destino e nada foi
 * gravado. Quem chama DEVE checar antes de registrar historico ou dizer que
 * aplicou (`Destination` e opcional no schema).
 */
export function updateProcessDestination(processId: string, data: UpdateDestinationData) {
  return getPrisma().destination.updateMany({ where: { processId }, data });
}

/** Atualiza a etapa da execucao assistida MANUAL (Fase 7, docs/21 §8). */
export function updateManualExecutionStatus(id: string, status: ManualExecutionStatus) {
  return getPrisma().process.update({ where: { id }, data: { manualExecutionStatus: status } });
}

/**
 * Detalhe admin: processo por id, sem restricao de dono (docs/11 §5).
 * `includeFirearm` false => os dados da arma/PCE nem sao lidos do banco
 * (need-to-know por perfil — docs/11 §3).
 */
export function findProcessByIdForAdmin(id: string, includeFirearm = true) {
  return getPrisma().process.findUnique({
    where: { id },
    include: { destination: true, firearm: includeFirearm, processType: true },
  });
}
