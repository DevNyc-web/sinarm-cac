-- Persistencia real do REGISTRY de idempotencia do acionador administrativo
-- manual do dispatcher sintetico (docs da Fase 2, motor sintetico ja
-- fechado — este e o primeiro bloco POSTERIOR ao fechamento).
--
-- ADITIVA: cria um tipo e uma tabela novos. Nenhuma tabela existente e
-- alterada, nenhuma linha de "synthetic_runs"/"synthetic_run_claims" e
-- tocada.
--
-- Isto NAO e idempotencia de ETAPA/LOTE (aquilo continua em
-- "synthetic_runs"/"synthetic_run_claims") — e idempotencia de PEDIDO
-- administrativo: garante que repetir o mesmo "request_id" nunca chama o
-- dispatcher de novo, mesmo depois do processo reiniciar.
--
-- NADA aqui guarda sessao viva, sessionHandle, executor, store, logger,
-- AbortSignal, credencial, CPF, senha, cookie, token, stack trace, erro
-- bruto, objeto de run completo ou evidencia/evento completos (regra
-- permanente de docs/00 §8) — so o resultado administrativo SEGURO e
-- fechado (result JSONB, revalidado na leitura).

-- CreateEnum
CREATE TYPE "manual_dispatch_request_status" AS ENUM ('PENDING', 'COMPLETED', 'DENIED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "manual_dispatch_requests" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "manual_dispatch_request_status" NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "result" JSONB,
    "format_version" TEXT NOT NULL,
    "execution_token" TEXT,
    "claimed_by" TEXT,
    "claimed_at" TIMESTAMP(3),
    "lease_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_dispatch_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- `request_id` unico: e o proprio Postgres que arbitra a idempotencia do
-- PEDIDO, nao so a checagem em aplicacao.
CREATE UNIQUE INDEX "manual_dispatch_requests_request_id_key" ON "manual_dispatch_requests"("request_id");

-- CreateIndex
-- Filtro/contagem geral por status.
CREATE INDEX "manual_dispatch_requests_status_idx" ON "manual_dispatch_requests"("status");

-- CreateIndex
-- Varredura de `listRecoverable` (PENDING + lease vencida) e de reserva
-- ainda valida (PENDING + lease no futuro) — o mesmo indice cobre as duas
-- consultas.
CREATE INDEX "manual_dispatch_requests_status_lease_expires_at_idx" ON "manual_dispatch_requests"("status", "lease_expires_at");

-- CreateIndex
CREATE INDEX "manual_dispatch_requests_created_at_idx" ON "manual_dispatch_requests"("created_at");
