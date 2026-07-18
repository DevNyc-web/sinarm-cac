import { type Prisma } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";

/**
 * Repositorio do registro de execucao MANUAL (docs/21 §6) — Fase 7 dev/ficticio.
 * Guarda o que o OPERADOR HUMANO declarou ter feito fora do app: protocolo,
 * dados da GRU e pagamento da GRU pela empresa. O app nao gera nada disso.
 */

export function findManualExecution(processId: string) {
  return getPrisma().manualExecution.findUnique({ where: { processId } });
}

/** Campos que o operador pode registrar (docs/21 §6) — sem chaves nem timestamps. */
export type ManualExecutionFields = Partial<
  Omit<Prisma.ManualExecutionUncheckedCreateInput, "id" | "processId" | "createdAt" | "updatedAt">
>;

/** Cria/atualiza o registro do processo (um por processo). */
export function upsertManualExecution(processId: string, data: ManualExecutionFields) {
  return getPrisma().manualExecution.upsert({
    where: { processId },
    update: data,
    create: { processId, ...data },
  });
}
