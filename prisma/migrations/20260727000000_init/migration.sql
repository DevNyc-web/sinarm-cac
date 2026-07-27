-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "operational_status" AS ENUM ('RASCUNHO', 'DOCUMENTO_ENVIADO', 'DOCUMENTO_APROVADO', 'AGUARDANDO_PAGAMENTO', 'PAGO_EM_FILA', 'EM_REVISAO_OPERACIONAL', 'PRONTO_PARA_PROTOCOLO_MANUAL', 'BLOQUEADO', 'CANCELADO_DEV');

-- CreateEnum
CREATE TYPE "manual_execution_status" AS ENUM ('EXECUCAO_MANUAL_NAO_INICIADA', 'GOVBR_ABERTO_PELO_OPERADOR', 'SINARM_ABERTO_PELO_OPERADOR', 'FORMULARIO_PREENCHIDO_MANUALMENTE', 'CHECKPOINT_DADOS_GRU_CONFERIDO', 'PROTOCOLO_MANUAL_REGISTRADO', 'GRU_MANUAL_REGISTRADA', 'AGUARDANDO_PAGAMENTO_GRU_EMPRESA', 'GRU_PAGA_MANUALMENTE_DEV', 'BLOQUEADO_OPERACIONALMENTE');

-- CreateEnum
CREATE TYPE "process_priority" AS ENUM ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "note_visibility" AS ENUM ('INTERNA', 'VISIVEL_USUARIO');

-- CreateEnum
CREATE TYPE "process_event_kind" AS ENUM ('STATUS_INTERNO', 'STATUS_OPERACIONAL', 'PRIORIDADE', 'RESPONSAVEL', 'NOTA', 'EXECUCAO_MANUAL', 'PROTOCOLO_MANUAL', 'GRU_MANUAL', 'PAGAMENTO_GRU_MANUAL');

-- CreateEnum
CREATE TYPE "checklist_group" AS ENUM ('REVISAO', 'GRU', 'POS_PROTOCOLO');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDENTE', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'EXPIRADO', 'CANCELADO', 'FALHOU');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('IDENTIFICACAO_PESSOAL', 'CR_REGISTRO_CAC', 'COMPROVANTE_ORIGEM_ENDERECO', 'DECLARACAO_DESTINO_EVENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('PENDENTE', 'ENVIADO', 'EM_ANALISE', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "internal_status" AS ENUM ('RASCUNHO', 'AGUARDANDO_PAGAMENTO', 'PAGO_EM_FILA', 'AGUARDANDO_LOGIN_GOVBR', 'SESSAO_GOVBR_EXPIRADA', 'EM_PREENCHIMENTO_SINARM', 'EM_REVISAO_HUMANA', 'BLOQUEADO_INSTABILIDADE', 'EXCECAO_DOC_INVALIDO', 'EXCECAO_ARMA_DIVERGENTE', 'EXCECAO_DESTINO_INCOMPLETO', 'PROTOCOLADO_GRU_GERADA', 'GRU_PAGA_EMPRESA', 'CONCLUIDO', 'CANCELADO_REEMBOLSADO');

-- CreateEnum
CREATE TYPE "user_facing_status" AS ENUM ('RECEBIDO', 'PAGAMENTO_CONFIRMADO', 'AGUARDANDO_SEU_LOGIN_GOVBR', 'EM_ANDAMENTO', 'AGUARDANDO_SISTEMA_PF', 'PRECISAMOS_DE_UM_AJUSTE', 'PROTOCOLADO', 'CONCLUIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "process_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_fee_cents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "process_type_id" TEXT NOT NULL,
    "internal_status" "internal_status" NOT NULL DEFAULT 'RASCUNHO',
    "user_facing_status" "user_facing_status" NOT NULL DEFAULT 'RECEBIDO',
    "operational_status" "operational_status" NOT NULL DEFAULT 'RASCUNHO',
    "priority" "process_priority" NOT NULL DEFAULT 'NORMAL',
    "assigned_to_mock_user_id" TEXT,
    "manual_execution_status" "manual_execution_status" NOT NULL DEFAULT 'EXECUCAO_MANUAL_NAO_INICIADA',
    "justification" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_executions" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "protocol_number" TEXT,
    "protocol_observation" TEXT,
    "protocol_registered_by_mock_user_id" TEXT,
    "protocol_registered_by_role" TEXT,
    "protocol_registered_at" TIMESTAMP(3),
    "gru_reference" TEXT,
    "gru_due_date" TIMESTAMP(3),
    "gru_amount_cents" INTEGER,
    "gru_observation" TEXT,
    "gru_registered_by_mock_user_id" TEXT,
    "gru_registered_by_role" TEXT,
    "gru_registered_at" TIMESTAMP(3),
    "gru_paid_at" TIMESTAMP(3),
    "gru_payment_observation" TEXT,
    "gru_payment_registered_by_mock_user_id" TEXT,
    "gru_payment_registered_by_role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_notes" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "visibility" "note_visibility" NOT NULL DEFAULT 'INTERNA',
    "body" TEXT NOT NULL,
    "author_mock_user_id" TEXT NOT NULL,
    "author_role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_status_events" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "kind" "process_event_kind" NOT NULL DEFAULT 'STATUS_INTERNO',
    "from_status" "internal_status",
    "to_status" "internal_status",
    "from_value" TEXT,
    "to_value" TEXT,
    "actor_mock_user_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_checklist_items" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "group" "checklist_group" NOT NULL DEFAULT 'REVISAO',
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checked_by_mock_user_id" TEXT,
    "checked_by_role" TEXT,
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firearms_pce" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "mock_catalog_id" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "caliber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firearms_pce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_documents" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "type" "document_type" NOT NULL DEFAULT 'IDENTIFICACAO_PESSOAL',
    "status" "document_status" NOT NULL DEFAULT 'ENVIADO',
    "original_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_mock_user_id" TEXT NOT NULL,
    "reviewed_by_mock_user_id" TEXT,
    "reviewed_by_role" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_payment_id" TEXT,
    "status" "payment_status" NOT NULL DEFAULT 'PENDENTE',
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "pix_qr_code" TEXT,
    "pix_copy_paste" TEXT,
    "expires_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "webhook_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "process_types_code_key" ON "process_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "processes_code_key" ON "processes"("code");

-- CreateIndex
CREATE INDEX "processes_user_id_idx" ON "processes"("user_id");

-- CreateIndex
CREATE INDEX "processes_operational_status_idx" ON "processes"("operational_status");

-- CreateIndex
CREATE INDEX "processes_assigned_to_mock_user_id_idx" ON "processes"("assigned_to_mock_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "manual_executions_process_id_key" ON "manual_executions"("process_id");

-- CreateIndex
CREATE INDEX "process_notes_process_id_idx" ON "process_notes"("process_id");

-- CreateIndex
CREATE INDEX "process_status_events_process_id_idx" ON "process_status_events"("process_id");

-- CreateIndex
CREATE UNIQUE INDEX "process_checklist_items_process_id_key_key" ON "process_checklist_items"("process_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_process_id_key" ON "destinations"("process_id");

-- CreateIndex
CREATE UNIQUE INDEX "firearms_pce_process_id_key" ON "firearms_pce"("process_id");

-- CreateIndex
CREATE INDEX "process_documents_process_id_idx" ON "process_documents"("process_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_webhook_event_id_key" ON "payments"("webhook_event_id");

-- CreateIndex
CREATE INDEX "payments_process_id_idx" ON "payments"("process_id");

-- CreateIndex
CREATE INDEX "payments_provider_payment_id_idx" ON "payments"("provider_payment_id");

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_process_type_id_fkey" FOREIGN KEY ("process_type_id") REFERENCES "process_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_executions" ADD CONSTRAINT "manual_executions_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_notes" ADD CONSTRAINT "process_notes_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_status_events" ADD CONSTRAINT "process_status_events_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_checklist_items" ADD CONSTRAINT "process_checklist_items_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firearms_pce" ADD CONSTRAINT "firearms_pce_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_documents" ADD CONSTRAINT "process_documents_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

