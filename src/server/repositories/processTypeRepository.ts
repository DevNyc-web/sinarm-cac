import { getPrisma } from "@/server/db/prisma";

/**
 * Repositorio de tipos de processo (docs/16 §4). Acesso a dados via Prisma.
 * Nao e chamado durante o build; roda apenas em runtime com DATABASE_URL valida.
 */
export function listActiveProcessTypes() {
  return getPrisma().processType.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}
