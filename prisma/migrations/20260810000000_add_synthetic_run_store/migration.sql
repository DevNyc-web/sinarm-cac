-- Persistencia real do STORE do motor sintetico (docs da Fase 2 do motor
-- sintetico, contratos definidos no PR anterior).
--
-- ADITIVA: cria dois tipos e duas tabelas novos. Nenhuma tabela existente e
-- alterada.
--
-- Este e o MOTOR SINTETICO — laboratorio local, loopback, ficticio. Nao tem
-- nenhuma relacao com "processes"/"process_documents" nem com a Fase 9.
--
-- NADA aqui guarda credencial (regra permanente de docs/00 §8): nenhuma
-- coluna de sessionHandle, senha, token, cookie ou storage state. Somente o
-- ESTADO da sessao (session_state) e a correlacao (audit_correlation_id) sao
-- persistidos — nunca o handle.

-- CreateEnum
CREATE TYPE "synthetic_run_state" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_HUMAN', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "synthetic_handoff_state" AS ENUM ('CREATED', 'CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'BLOCKED', 'FAILED');

-- CreateTable
CREATE TABLE "synthetic_runs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_fingerprint" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "run_state" "synthetic_run_state" NOT NULL,
    "session_state" "synthetic_handoff_state" NOT NULL,
    "audit_correlation_id" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "pending_steps" JSONB NOT NULL,
    "completed_steps" JSONB NOT NULL,
    "events" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "human_fallback_required" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_step_idempotency_key" TEXT,
    "last_interruption_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "synthetic_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- `run_id` unico: e o identificador de dominio que o contrato usa em toda
-- operacao (create/getById/save/claimNext/...).
CREATE UNIQUE INDEX "synthetic_runs_run_id_key" ON "synthetic_runs"("run_id");

-- CreateIndex
-- Idempotencia de CRIACAO: mesma chave nunca cria um segundo registro — e o
-- proprio Postgres que arbitra, nao so a checagem em aplicacao.
CREATE UNIQUE INDEX "synthetic_runs_idempotency_key_key" ON "synthetic_runs"("idempotency_key");

-- CreateIndex
-- Varredura de `listRecoverable`: filtra por estado antes de olhar o claim.
CREATE INDEX "synthetic_runs_run_state_updated_at_idx" ON "synthetic_runs"("run_state", "updated_at");

-- CreateTable
CREATE TABLE "synthetic_run_claims" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "run_version_at_claim" INTEGER NOT NULL,

    CONSTRAINT "synthetic_run_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- 1:1 com o run: no maximo UMA linha de claim por run — e a garantia real de
-- "so um claim ativo por run", arbitrada pelo Postgres.
CREATE UNIQUE INDEX "synthetic_run_claims_run_id_key" ON "synthetic_run_claims"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "synthetic_run_claims_claim_id_key" ON "synthetic_run_claims"("claim_id");

-- CreateIndex
-- Varredura de reserva expirada (`listRecoverable` e o `claimNext` tentando
-- substituir um claim vencido).
CREATE INDEX "synthetic_run_claims_expires_at_idx" ON "synthetic_run_claims"("expires_at");

-- AddForeignKey
-- CASCADE: claim sem run nao tem sentido; apagar o run libera a reserva.
ALTER TABLE "synthetic_run_claims" ADD CONSTRAINT "synthetic_run_claims_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "synthetic_runs"("run_id") ON DELETE CASCADE ON UPDATE CASCADE;
