-- Indices de operacao: varredura do reaper global e fila PENDENTE (#47D-2).
--
-- ESTA MIGRATION NAO PODE DROPAR "document_extractions_one_active_per_document".
--
-- Aquele indice e PARCIAL (WHERE "state" IN ('PENDENTE', 'PROCESSANDO')) e o
-- Prisma nao expressa `WHERE` em @@index/@@unique — ele existe SOMENTE no SQL de
-- 20260729000000. Sem ele, o banco volta a aceitar DUAS tentativas ativas no
-- mesmo documento, em silencio, e o claim atomico de `claimPendingExtraction`,
-- que sustenta o lote manual e o request, perde a garantia sem nenhum sinal. Uma
-- protecao que some sozinha e pior que protecao ausente: cria confianca falsa.
--
-- Registro do que foi VERIFICADO ao gerar esta migration: `prisma migrate dev
-- --create-only` (Prisma 6.19.3) produziu apenas os dois CREATE INDEX abaixo —
-- NAO propos dropar o indice parcial. O aviso de 20260729000000 continua valendo
-- como precaucao para versoes futuras, e agora ha teste que varre TODAS as
-- migrations e falha em qualquer DROP INDEX desse nome. Se um diff futuro trouxer
-- esse DROP, e para recusar.
--
-- Use `npm run db:migrate` (dev) ou `npm run db:deploy` (aplicar). `npm run
-- db:push` sincroniza o banco COM O SCHEMA, que nao declara o indice parcial:
-- rodar aquilo aqui remove a protecao.
--
-- Sem CREATE INDEX CONCURRENTLY: o Prisma aplica cada migration dentro de uma
-- transacao, e CONCURRENTLY nao roda em bloco transacional. A tabela e pequena
-- (nada cria extracao em producao ainda), entao o lock e irrelevante.

-- CreateIndex
-- Serve `WHERE state = 'PROCESSANDO' AND updated_at < cutoff` — o reaper global.
CREATE INDEX "document_extractions_state_updated_at_idx" ON "document_extractions"("state", "updated_at");

-- CreateIndex
-- Serve `WHERE state = 'PENDENTE' ORDER BY created_at, id LIMIT n` — a fila do
-- lote manual. O indice de "latest" comeca em document_id e nao atende esta
-- consulta, que nao filtra por documento.
CREATE INDEX "document_extractions_state_created_at_id_idx" ON "document_extractions"("state", "created_at", "id");
