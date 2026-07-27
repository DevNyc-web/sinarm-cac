-- Fundacao de auth: tabela `users`, enum `role` e FK `processes.user_id`.
--
-- SEM campo de senha/sessao: login real entra no PR seguinte. Nada aqui guarda
-- credencial de Gov.br/SINARM — isso continua proibido (docs/00 §8).

-- CreateEnum
CREATE TYPE "role" AS ENUM ('USER', 'ADMIN', 'OPERADOR', 'FINANCEIRO', 'SUPORTE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "role" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- Backfill de integridade referencial (passo ADICIONADO A MAO ao SQL gerado).
--
-- Sem isto, o ADD CONSTRAINT abaixo FALHA em qualquer banco que ja tenha linhas em
-- `processes` — caso do dev criado por `db push`, onde `user_id` guarda o id do
-- usuario mock e a tabela `users` nao existia.
--
-- Banco novo: `processes` esta vazia e este INSERT nao faz nada.
-- Banco existente: cria o minimo para a FK ser valida; o `seed` corrige
-- nome/e-mail/papel depois, por upsert idempotente.
--
-- `.invalid` e TLD reservado pela RFC 2606 — nunca colide com e-mail real, e o
-- registro fica obviamente marcado como placeholder.
INSERT INTO "users" ("id", "email", "name", "role", "active", "created_at", "updated_at")
SELECT DISTINCT
    p."user_id",
    p."user_id" || '@placeholder.invalid',
    p."user_id",
    'USER'::"role",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "processes" p
WHERE NOT EXISTS (
    SELECT 1 FROM "users" u WHERE u."id" = p."user_id"
);

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

