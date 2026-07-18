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
    },
    include: { destination: true, firearm: true },
  });
}

/** Lista os processos do usuario (mock) para o dashboard, mais recentes primeiro. */
export function listProcessesByUser(userId: string) {
  return getPrisma().process.findMany({
    where: { userId },
    include: { destination: true, processType: true },
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
