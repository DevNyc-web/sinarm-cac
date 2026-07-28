-- Uma unica extracao ATIVA por documento + ordem determinista para "a mais recente".
--
-- ATENCAO AO FLUXO DE BANCO: o indice do passo 2 e PARCIAL, e o Prisma nao
-- expressa `WHERE` em @@index/@@unique. Ele existe SOMENTE neste SQL. Por isso:
--
--   * use `npm run db:migrate` (dev) ou `npm run db:deploy` (aplicar) — sao os
--     caminhos que executam este arquivo;
--   * `npm run db:push` sincroniza o banco COM O SCHEMA e nao conhece este
--     indice. Rodar `db push` depois desta migration pode remove-lo em silencio,
--     e ai o banco volta a aceitar duas tentativas ativas no mesmo documento sem
--     nenhum sinal — uma protecao que some sozinha e pior que nao ter protecao,
--     porque cria confianca falsa.
--
-- Nota de manutencao: um `prisma migrate dev` futuro compara o schema com as
-- migrations e pode propor DROPAR este indice, justamente por ele nao estar no
-- schema. Se isso aparecer num diff, e para recusar.

-- 1) FAIL-FAST: duplicidade ativa e resolvida por gente, nao por migration.
--
-- Corrigir automaticamente (marcar as antigas como FALHOU) exigiria decidir, em
-- silencio e sem contexto, qual tentativa do cliente vale. Abortar deixa a
-- decisao com quem tem a informacao. Deve ser no-op: nada cria extracao em
-- producao ainda.
DO $$
DECLARE
  duplicados INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicados FROM (
    SELECT "document_id"
      FROM "document_extractions"
     WHERE "state" IN ('PENDENTE', 'PROCESSANDO')
     GROUP BY "document_id"
    HAVING COUNT(*) > 1
  ) AS duplicadas;

  IF duplicados > 0 THEN
    RAISE EXCEPTION
      'Migration abortada: % documento(s) com mais de uma extracao ATIVA (PENDENTE/PROCESSANDO). Resolva manualmente — mantenha a mais recente por (created_at DESC, id DESC) e encerre as demais — antes de aplicar.',
      duplicados;
  END IF;
END $$;

-- 2) No maximo UMA tentativa ativa por documento.
--
-- PARCIAL de proposito: o historico 1:N do #47A precisa continuar aceitando N
-- linhas TERMINais no mesmo documento (reprocessamento preserva a evidencia
-- anterior). Um unique total quebraria isso.
--
-- E a unica garantia real contra corrida: duas instancias da app nao compartilham
-- memoria, entao so o Postgres pode arbitrar quem cria a tentativa.
CREATE UNIQUE INDEX "document_extractions_one_active_per_document"
    ON "document_extractions" ("document_id")
 WHERE "state" IN ('PENDENTE', 'PROCESSANDO');

-- 3) "A extracao mais recente" deixa de depender de empate.
--
-- `created_at` e TIMESTAMP(3): duas linhas no mesmo milissegundo empatavam, e o
-- desempate era o que o Postgres devolvesse — podia alternar entre execucoes.
-- A ordem entra no indice e as consultas passam a pedir (created_at DESC, id DESC).
DROP INDEX "document_extractions_document_id_created_at_idx";

CREATE INDEX "document_extractions_document_id_created_at_id_idx"
    ON "document_extractions" ("document_id", "created_at" DESC, "id" DESC);
