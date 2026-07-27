-- Auth real do PRODUTO: senha propria (scrypt) e sessao opaca.
--
-- NADA aqui guarda credencial de Gov.br/SINARM — isso continua proibido
-- (docs/00 §8). `password_hash` e a senha do NOSSO app.

-- Normaliza e-mails existentes (passo ADICIONADO A MAO ao SQL gerado).
--
-- A partir daqui o codigo grava e busca sempre em minusculo. O indice unico e
-- case-sensitive, entao uma linha legada com maiuscula ficaria inacessivel ao
-- login e ainda permitiria cadastrar a "mesma" conta de novo.
--
-- Hoje e no-op (os 5 usuarios de seed ja sao minusculos); existe para o caso de
-- qualquer dado ter entrado fora do padrao.
UPDATE "users" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" TEXT;

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

