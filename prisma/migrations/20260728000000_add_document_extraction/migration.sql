-- Persistencia da extracao documental (PR #47A).
--
-- ADITIVA: cria um tipo e uma tabela novos. Nenhuma tabela existente e alterada
-- alem da FK — `process_documents` nao ganha coluna.
--
-- 1:N por tentativa (uma linha por extracao, historico preservado): a decisao
-- automatica precisa saber em qual extracao se baseou, e reprocessar nao pode
-- apagar a evidencia anterior.
--
-- NADA aqui guarda credencial (regra permanente de docs/00 §8): nenhuma coluna
-- de segredo do orgao. `fields` e PII (dados lidos do documento do cliente) e
-- `failure_reason` guarda CODIGO curto, nunca texto bruto de OCR.
--
-- Esta fase NAO tem OCR: a tabela existe para receber o resultado quando o motor
-- entrar (PR #47B).

-- CreateEnum
CREATE TYPE "extraction_state" AS ENUM ('PENDENTE', 'PROCESSANDO', 'EXTRAIDA', 'PRECISA_REVISAO', 'CONFIRMADA', 'FALHOU');

-- CreateTable
CREATE TABLE "document_extractions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "state" "extraction_state" NOT NULL DEFAULT 'PENDENTE',
    "fields" JSONB,
    "confidence" TEXT,
    "engine" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "failure_reason" TEXT,
    "extracted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_mock_user_id" TEXT,
    "reviewed_by_role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Composto para a consulta quente "ultima extracao deste documento".
CREATE INDEX "document_extractions_document_id_created_at_idx" ON "document_extractions"("document_id", "created_at");

-- AddForeignKey
-- CASCADE: extracao sem documento nao tem sentido.
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "process_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
