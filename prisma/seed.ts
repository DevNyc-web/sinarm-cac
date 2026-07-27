// Seed opcional — Fase 1 (docs/16 §12). APENAS dados ficticios. SEM PII real.
// Requer um Postgres local acessivel via DATABASE_URL. Rodar com: npm run seed

import { PrismaClient, type Role } from "@prisma/client";
import { MOCK_USERS } from "../src/server/auth/mockUsers";
import { FUTURE_PROCESS_TYPE_SEED } from "../src/server/processes/processTypeSeed";

const prisma = new PrismaClient();

async function main() {
  // Usuarios PRIMEIRO: `processes.user_id` tem FK para `users`, entao semear o
  // processo de demo antes dos usuarios violaria a restricao.
  //
  // Os ids sao os LITERAIS dos mocks (mock-user, mock-admin, ...) de proposito:
  // o cookie de sessao existente continua resolvendo e o processo GT-DEMO-001
  // continua valido. Upsert por id = idempotente.
  //
  // Dados 100% ficticios, dominio example.com (RFC 2606). SEM senha: a fundacao
  // de auth nao tem credencial; login real entra no PR seguinte.
  for (const user of MOCK_USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: user.email, name: user.name, role: user.role as Role, active: true },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
        active: true,
      },
    });
  }
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

  console.log(
    `Seed concluido (dados ficticios). ${MOCK_USERS.length} usuarios, ProcessType e processo de demo criados.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
