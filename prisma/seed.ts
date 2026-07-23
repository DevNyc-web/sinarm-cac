// Seed opcional — Fase 1 (docs/16 §12). APENAS dados ficticios. SEM PII real.
// Requer um Postgres local acessivel via DATABASE_URL. Rodar com: npm run seed

import { PrismaClient } from "@prisma/client";
import { FUTURE_PROCESS_TYPE_SEED } from "../src/server/processes/processTypeSeed";

const prisma = new PrismaClient();

async function main() {
  // Catalogo: Guia de Trafego (taxa da GRU = R$ 20,00 = 2000 centavos).
  const guiaTrafego = await prisma.processType.upsert({
    where: { code: "GUIA_TRAFEGO_PF_CAC" },
    update: {},
    create: {
      code: "GUIA_TRAFEGO_PF_CAC",
      name: "Guia de Trafego (Pessoa Fisica - CAC)",
      baseFeeCents: 2000,
      active: true,
    },
  });

  // Tipos FUTUROS do catalogo (CR, Autorizacao de Compra, CRAF) — registrados
  // como dados com `active: false`: aparecem em process_types SEM liberar
  // criacao real (a selecao continua so-Guia). Upsert por `code` unico =
  // idempotente: rodar o seed varias vezes nao duplica registros. Nao altera a
  // Guia acima. Valores derivam do catalogo/mapeamento (ver processTypeSeed).
  for (const type of FUTURE_PROCESS_TYPE_SEED) {
    await prisma.processType.upsert({
      where: { code: type.code },
      update: { name: type.name, baseFeeCents: type.baseFeeCents, active: type.active },
      create: {
        code: type.code,
        name: type.name,
        baseFeeCents: type.baseFeeCents,
        active: type.active,
      },
    });
  }

  // Processo de demonstracao — dados 100% ficticios, sem PII.
  // userId = id do usuario MOCK da Fase 2 (src/server/auth/mockUsers.ts).
  await prisma.process.upsert({
    where: { code: "GT-DEMO-001" },
    update: {},
    create: {
      code: "GT-DEMO-001",
      userId: "mock-user",
      processTypeId: guiaTrafego.id,
      justification: "Guia para treino",
      destination: {
        create: {
          eventName: "Clube de Tiro Exemplo",
          uf: "SP",
          city: "Cidade Exemplo",
          street: "Rua Exemplo",
          number: "100",
        },
      },
      firearm: {
        create: {
          mockCatalogId: "mock-pce-001",
          species: "Pistola",
          brand: "Marca Exemplo",
          model: "Modelo Alfa",
          caliber: "9mm (ficticio)",
          quantity: 1,
        },
      },
    },
  });

  console.log("Seed concluido (dados ficticios). ProcessType e processo de demo criados.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
