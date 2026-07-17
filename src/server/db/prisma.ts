import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma com instanciacao LAZY (docs/16 §11).
 * O cliente so e construido na primeira chamada de getPrisma() em runtime — nunca
 * no import/build — evitando conexao ao banco durante `next build`.
 * Em dev, reaproveita a instancia no globalThis (evita "too many clients" no HMR).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
