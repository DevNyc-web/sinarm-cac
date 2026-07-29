/**
 * Varredura MANUAL de tentativas PROCESSANDO abandonadas (PR #47D-2).
 *
 * POR QUE EXISTE, se o reap por documento ja existe: aquele so roda quando
 * alguem pede AQUELE documento de novo, dentro de `requestDocumentExtraction`.
 * E ele que garante que o cliente nunca fica preso — e continua sendo o caminho
 * principal. Mas a orfa de um documento que ninguem foi pedir ficaria
 * PROCESSANDO indefinidamente: presente no banco e em relatorio como trabalho em
 * andamento que nao existe, e ocupando a unica vaga ativa daquele documento.
 * Esta varredura e a rede de seguranca para esse caso.
 *
 * O QUE NAO E: nao ha agendamento, intervalo nem gatilho automatico — quem
 * aciona e uma pessoa (ou o schedule de um PR futuro). Nao le arquivo, nao chama
 * engine, nao consulta storage, nao usa rede, nao alcanca sistema publico algum.
 *
 * PII: nenhuma. O repositorio devolve CONTAGEM, nunca linhas, e nenhum evento de
 * log carrega documento, tentativa ou conteudo.
 */
import { logger } from "@/lib/logger";
import { type ExtractionFailureReason } from "@/server/documents/documentExtractionTypes";
import { failStaleProcessingExtractionsEverywhere } from "@/server/repositories/documentExtractionRepository";
import { PROCESSING_TIMEOUT_MS } from "@/server/services/requestDocumentExtraction";

/** Nomes de evento que esta varredura emite. Fechado. */
type ReaperLogEvent = "extraction_processing_reaped" | "extraction_processing_reap_failed";

/**
 * Payload de log — o TIPO E a allowlist.
 *
 * Mesmo mecanismo do lote manual: move a garantia do teste para o COMPILADOR.
 * Chave fora desta lista nao compila (excess property check), e `reasonCode` fora
 * do conjunto fechado do dominio nao compila. Ampliar este tipo e decisao de
 * PRIVACIDADE, nao de conveniencia — `documentId` e `extractionId` estao fora de
 * proposito: um reap de dezenas de linhas emitindo os ids viraria um inventario
 * de documentos travados no log, e o ganho diagnostico nao paga isso.
 */
type ReaperLogPayload = {
  event: ReaperLogEvent;
  count?: number;
  /** Conjunto FECHADO do dominio — aqui o motivo e o mesmo que vai para o banco. */
  reasonCode: ExtractionFailureReason;
  cutoffIso?: string;
  durationMs: number;
};

/** Resumo do acionamento: contagem e tempo. Nunca linhas, nunca PII. */
export type ReaperRunSummary = {
  /** Tentativas que sairam de PROCESSANDO nesta passada. */
  reaped: number;
  durationMs: number;
};

/**
 * Executa UMA varredura global.
 *
 * NUNCA lanca: e um caminho de manutencao, e derrubar o chamador porque o banco
 * piscou seria pior que relatar zero e registrar a falha.
 */
export async function runExtractionReaperOnce(): Promise<ReaperRunSummary> {
  const startedAt = Date.now();

  // MESMA constante do reap por documento. Um segundo timeout para o mesmo
  // fenomeno divergiria no primeiro ajuste e ninguem perceberia: os dois
  // caminhos continuariam "funcionando", com criterios diferentes.
  const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MS);

  try {
    const reaped = await failStaleProcessingExtractionsEverywhere(cutoff);
    const durationMs = Date.now() - startedAt;

    // SILENCIOSO em zero: sob acionamento repetido, registrar "nada a fazer"
    // viraria ruido constante — e ruido constante deixa de ser lido. Mesmo
    // criterio do `extraction_processing_timeout`.
    if (reaped > 0) {
      logger.warn(
        {
          event: "extraction_processing_reaped",
          count: reaped,
          reasonCode: "TIMEOUT",
          // O LIMIAR usado, nao so o resultado: sem ele, um reap em massa e
          // indistinguivel entre "muitas orfas reais" e "constante ou relogio
          // errados" — e essas duas causas pedem respostas opostas.
          cutoffIso: cutoff.toISOString(),
          durationMs,
        } satisfies ReaperLogPayload,
        "extracoes PROCESSANDO abandonadas foram encerradas",
      );
    }

    return { reaped, durationMs };
  } catch {
    // `catch` SEM binding: o erro do banco nao existe como variavel, entao nao ha
    // como registra-lo por descuido. A garantia e estrutural.
    const durationMs = Date.now() - startedAt;

    // EVENTO PROPRIO, nao `extraction_processing_reaped` com contagem zero: aquele
    // nome afirma que algo foi encerrado, e usa-lo aqui faria o log mentir sobre
    // o que aconteceu. Silenciar tambem nao serve — falha de infraestrutura que
    // nao aparece em lugar nenhum e indistinguivel de tabela limpa.
    logger.warn(
      {
        event: "extraction_processing_reap_failed",
        reasonCode: "ERRO_INTERNO",
        durationMs,
      } satisfies ReaperLogPayload,
      "nao foi possivel varrer extracoes PROCESSANDO abandonadas",
    );

    // `reaped: 0` e verdade: nada foi encerrado. O resumo nao distingue "nada a
    // fazer" de "nao deu para tentar" — essa distincao vive no log, e acrescentar
    // campo de erro ao resumo ficou fora deste PR de proposito.
    return { reaped: 0, durationMs };
  }
}
