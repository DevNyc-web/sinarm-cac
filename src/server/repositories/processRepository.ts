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
      `ProcessType "${data.processTypeCode}" nao encontrado. Rode: npm run db:migrate && npm run seed`,
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
      // So para `isClosed` (docs/52) reconhecer cancelamento real na fila —
      // nenhum filtro/DTO novo le este campo alem do calculo de indicadores.
      internalStatus: true,
      priority: true,
      assignedToMockUserId: true,
      processType: { select: { name: true } },
      destination: { select: { eventName: true, city: true, uf: true } },
      // amountCents/paidAt: docs/59 — fonte segura ja existente, so para o
      // relatorio financeiro dedicado (needsFinanceReview) exibir valor/data
      // de pagamento sem query propria. Ambos ja sao exibidos ao admin no
      // detalhe do processo hoje.
      payments: {
        select: { status: true, amountCents: true, paidAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      documents: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      // Base dos indicadores derivados (Fase 6.5): ultimo evento para o SLA e
      // itens marcados para prontidao. So chaves/grupo — nada sensivel.
      statusEvents: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      checklistItems: { where: { checked: true }, select: { group: true } },
    },
    orderBy: { createdAt: filters.sort === "oldest" ? "asc" : "desc" },
  });
}

/**
 * Docs/59 §6 PR 2 — data de cancelamento REAL de um lote de processos, para o
 * relatorio financeiro dedicado (`/admin/financeiro`). Fonte: o evento de
 * transicao para `CANCELADO_OPERACIONAL` (gravado por `cancelProcess` via
 * `transitionInternalStatus`) — nao `Process.updatedAt`, nao `Payment.paidAt`.
 *
 * `cancelProcess` bloqueia recancelar um processo ja `CANCELADO_OPERACIONAL`
 * (docs/51 regras 5/7), entao so deveria existir UM evento assim por
 * processo — mesmo assim, com mais de um, fica o PRIMEIRO cronologicamente
 * (`orderBy: asc`, so a primeira ocorrencia por `processId` entra no mapa).
 *
 * Batch/`in`, mesmo padrao de `findLatestExtractionsWithFieldsForDocuments`
 * (`documentExtractionRepository.ts`): uma unica ida ao banco para o lote
 * inteiro de processIds, nunca uma consulta por linha (evita N+1). Lista
 * vazia nao consulta o banco.
 */
export async function findEarliestCancellationEventsForProcesses(
  processIds: readonly string[],
): Promise<Map<string, Date>> {
  if (processIds.length === 0) return new Map();

  const rows = await getPrisma().processStatusEvent.findMany({
    where: { processId: { in: [...processIds] }, toStatus: "CANCELADO_OPERACIONAL" },
    orderBy: { createdAt: "asc" },
    select: { processId: true, createdAt: true },
  });

  const earliestByProcess = new Map<string, Date>();
  for (const row of rows) {
    if (!earliestByProcess.has(row.processId)) earliestByProcess.set(row.processId, row.createdAt);
  }
  return earliestByProcess;
}

/**
 * Fila de AUTOMACAO (checklist pre-execucao): so o necessario para derivar a
 * prontidao. `select` restrito por need-to-know (docs/11 §3/§19):
 *  - destino: os 5 campos que o checklist avalia (sem ids/timestamps);
 *  - arma/PCE: apenas a EXISTENCIA (id), nunca especie/marca/serial;
 *  - documentos: tipo + status + data (sem nome de arquivo, sha256, storageKey);
 *  - pagamentos: apenas o status.
 * Nada sensivel sai daqui — o service ainda reduz para um DTO de exibicao.
 */
export function listAutomationQueue() {
  return getPrisma().process.findMany({
    select: {
      id: true,
      code: true,
      userId: true,
      createdAt: true,
      processType: { select: { code: true } },
      destination: {
        select: { eventName: true, uf: true, city: true, street: true, number: true },
      },
      firearm: { select: { id: true } },
      // `id` NAO e PII: e a chave que permite a prontidao casar cada documento
      // com a extracao persistida (#47C-2). `fields` continua FORA deste select —
      // a leitura de PII vive em `documentExtractionRepository`, e o que ela
      // produz nunca entra no DTO da fila.
      documents: { select: { id: true, type: true, status: true, createdAt: true } },
      payments: { select: { status: true }, orderBy: { createdAt: "desc" } },
      // Marcador de "enviado para a fila de automacao" (docs/25) — so `toValue`,
      // rotulo curto sem PII, para derivar se o processo ja foi liberado.
      statusEvents: { select: { toValue: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Retrato de UM processo para o checklist/gate de automacao — mesmo `select`
 * restrito da fila. `findUnique` por id (sem restricao de dono: uso admin, o
 * guard de permissao decide quem chama). Read-only.
 */
export function findProcessForAutomationReadiness(processId: string) {
  return getPrisma().process.findUnique({
    where: { id: processId },
    select: {
      id: true,
      code: true,
      processType: { select: { code: true } },
      destination: {
        select: { eventName: true, uf: true, city: true, street: true, number: true },
      },
      firearm: { select: { id: true } },
      // `id` NAO e PII: e a chave que permite a prontidao casar cada documento
      // com a extracao persistida (#47C-2). `fields` continua FORA deste select —
      // a leitura de PII vive em `documentExtractionRepository`, e o que ela
      // produz nunca entra no DTO da fila.
      documents: { select: { id: true, type: true, status: true, createdAt: true } },
      payments: { select: { status: true }, orderBy: { createdAt: "desc" } },
      statusEvents: { select: { toValue: true } },
    },
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
