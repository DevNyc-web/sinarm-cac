/**
 * Lote MANUAL de extracao documental (PR #47D-1).
 *
 * O QUE E: uma funcao acionavel por quem opera. NAO ha agendamento, NAO ha
 * intervalo, NAO ha gatilho automatico — o chamador de hoje e o teste, e o de
 * amanha sera um comando de operacao. Agendar antes disso colocaria um processo
 * rodando sozinho sobre documento de cliente antes de existir alguem de plantao
 * para ler o que ele faz.
 *
 * O QUE NAO E: nao le arquivo, nao consulta storage, nao usa rede, nao faz
 * leitura otica real e nao alcanca sistema publico algum. A engine continua
 * sendo a mock do PR #47B, deterministica e sem I/O.
 *
 * DONO DA RESERVA: `runDocumentExtraction`, e so ele. Este modulo NAO chama
 * `claimPendingExtraction`. A fila lida aqui e uma FOTOGRAFIA — entre ela e a
 * reserva a linha pode mudar, e e a reserva atomica que arbitra. Reproduzir essa
 * decisao aqui criaria duas versoes da mesma regra, que divergem no primeiro
 * ajuste de uma delas.
 *
 * PII: nenhuma passa por aqui. A fila traz `id`/`documentId`; o retorno da
 * execucao vem sem `fields` por construcao do repositorio; e nenhum evento de
 * log carrega conteudo de documento.
 */
import { logger } from "@/lib/logger";
import {
  listPendingExtractions,
  type ExtractionRow,
  type PendingExtractionRef,
} from "@/server/repositories/documentExtractionRepository";
import { runDocumentExtraction } from "@/server/services/runDocumentExtraction";

/**
 * Quantas tentativas um acionamento consome.
 *
 * 5 e pequeno de proposito. O acionamento e manual: errar para baixo custa
 * acionar de novo; errar para cima significa descobrir um defeito depois de ele
 * ter atingido dezenas de documentos de cliente.
 *
 * Constante, nao variavel de ambiente — mesmo criterio de `PROCESSING_TIMEOUT_MS`
 * e de `getExtractionEngine()`: nao ha operacao real com volume medido para
 * justificar o botao. REVISAR quando houver.
 */
export const EXTRACTION_WORKER_BATCH_SIZE = 5;

/**
 * Motivos de desfecho de um item, para LOG.
 *
 * Fechado e SEPARADO de `EXTRACTION_FAILURE_REASONS` de proposito: aquele
 * conjunto e PERSISTIDO em `failure_reason` e descreve por que a EXTRACAO
 * falhou; este descreve o que aconteceu com o ITEM dentro do lote. Uni-los faria
 * `CLAIM_PERDIDO` — que nao e falha de coisa alguma — virar candidato a ser
 * gravado no banco como se fosse defeito do documento do cliente.
 */
export const EXTRACTION_WORKER_REASON_CODES = [
  "CLAIM_PERDIDO",
  "EXECUCAO_FALHOU",
  "ERRO_INTERNO",
] as const;

export type ExtractionWorkerReasonCode = (typeof EXTRACTION_WORKER_REASON_CODES)[number];

/** Nomes de evento que este lote emite. Fechado, pelo mesmo motivo dos motivos. */
type WorkerLogEvent =
  | "worker_started"
  | "worker_completed"
  | "worker_skipped_claim_lost"
  | "worker_failed"
  | "worker_batch_completed";

/**
 * Payload de log do lote — o TIPO E a allowlist.
 *
 * Existe para mover a garantia do teste para o COMPILADOR. Os testes cobrem os
 * pontos de log que existem hoje; um ponto NOVO, escrito daqui a seis meses,
 * poderia emitir `reasonCode: "FALHOU_ALGO"` — string livre, fora do conjunto
 * fechado — ou acrescentar uma chave com conteudo de documento, e a suite nao
 * teria como saber que aquele sitio existe. Com `satisfies` em cada chamada,
 * ambos os casos param na compilacao:
 *
 *   * valor fora de `ExtractionWorkerReasonCode` nao compila;
 *   * chave fora desta lista nao compila (excess property check).
 *
 * A lista e exatamente a allowlist aprovada para o #47D-1. Ampliar este tipo e
 * uma decisao de PRIVACIDADE, nao de conveniencia: `fields`, `value`, `label`,
 * `storageKey` e afins nao entram — a razao de eles nao estarem aqui e a mesma
 * de o `select` da fila nao os trazer.
 */
type WorkerLogPayload = {
  event: WorkerLogEvent;
  extractionId?: string;
  documentId?: string;
  state?: ExtractionRow["state"];
  reasonCode?: ExtractionWorkerReasonCode;
  count?: number;
  batchSize?: number;
  durationMs?: number;
};

/**
 * Resumo do acionamento: contagens e tempo. Nunca linhas, nunca PII.
 *
 * `processed` conta tentativas RESERVADAS E EXECUTADAS, INCLUSIVE as que
 * terminaram em FALHOU: a engine rodou e deu veredito, o lote fez seu trabalho.
 * `failed` conta itens em que NAO SE CHEGOU a veredito nenhum. A distincao e o
 * ponto: sem ela, um documento ilegivel — resultado legitimo e esperado —
 * apareceria como defeito de infraestrutura, e o alarme apontaria para o lado
 * errado.
 */
export type WorkerRunSummary = {
  /** Tentativas PENDENTE trazidas pela fila neste acionamento. */
  scanned: number;
  /** Reserva vencida + engine executada (terminou EXTRAIDA ou FALHOU). */
  processed: number;
  /** `claimed: false` — outro chamador venceu a corrida. Caso NORMAL. */
  skipped: number;
  /** Sem veredito: a execucao devolveu erro, ou algo inesperado ocorreu. */
  failed: number;
  /** Duracao do lote inteiro. */
  durationMs: number;
};

/**
 * Consome UM lote de tentativas PENDENTE.
 *
 * NUNCA lanca por causa de um item: uma linha problematica nao pode impedir as
 * outras quatro de serem processadas. Erro vira contagem e evento de log.
 */
export async function runExtractionWorkerOnce(
  batchSize: number = EXTRACTION_WORKER_BATCH_SIZE,
): Promise<WorkerRunSummary> {
  const batchStartedAt = Date.now();
  logger.info(
    { event: "worker_started", batchSize } satisfies WorkerLogPayload,
    "lote de extracao iniciado",
  );

  let pendentes: PendingExtractionRef[];
  try {
    pendentes = await listPendingExtractions(batchSize);
  } catch {
    // `catch` SEM binding, aqui e em todo este arquivo: o erro do banco nao
    // existe como variavel, entao nao ha como registra-lo por descuido. A
    // garantia de que detalhe interno nao vaza para o log e ESTRUTURAL, nao
    // depende de quem escrever a proxima linha lembrar da regra.
    const durationMs = Date.now() - batchStartedAt;
    logger.warn(
      { event: "worker_failed", reasonCode: "ERRO_INTERNO", durationMs } satisfies WorkerLogPayload,
      "nao foi possivel ler a fila de extracoes pendentes",
    );
    // Resumo zerado: sem fila lida, nao ha item a que atribuir contagem. A
    // diferenca entre "fila vazia" e "fila ilegivel" fica no LOG — o resumo, com
    // as chaves que tem, nao consegue expressa-la.
    return { scanned: 0, processed: 0, skipped: 0, failed: 0, durationMs };
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  // SEQUENCIAL. `Promise.all` nao ganharia nada — a engine mock e sincrona e
  // retorna em milissegundos — e multiplicaria reservas concorrentes no mesmo
  // instante, deixando o log ilegivel justamente quando algo desse errado.
  for (const pendente of pendentes) {
    const itemStartedAt = Date.now();

    try {
      const result = await runDocumentExtraction(pendente.documentId);

      if (!result.ok) {
        failed += 1;
        logger.warn(
          {
            event: "worker_failed",
            documentId: pendente.documentId,
            reasonCode: "EXECUCAO_FALHOU",
            durationMs: Date.now() - itemStartedAt,
          } satisfies WorkerLogPayload,
          "tentativa nao pode ser executada",
        );
        continue;
      }

      if (!result.claimed) {
        // Outro chamador venceu entre a leitura da fila e a reserva. ESPERADO:
        // com dois acionamentos simultaneos, o perdedor perde o tempo todo, por
        // desenho. Contar como falha faria o lote alarmar por funcionar.
        skipped += 1;
        logger.info(
          {
            event: "worker_skipped_claim_lost",
            documentId: pendente.documentId,
            reasonCode: "CLAIM_PERDIDO",
          } satisfies WorkerLogPayload,
          "reserva perdida para outro chamador",
        );
        continue;
      }

      processed += 1;
      // O `extractionId` sai do RETORNO da execucao, nunca de `pendente.id`.
      // Entre a leitura da fila e a reserva, a tentativa lida pode ter terminado
      // e outra ter nascido no mesmo documento — quem executa resolve a mais
      // recente e processa ELA. Logar o id da fila descreveria com precisao uma
      // tentativa que nao rodou, que e pior que nao logar.
      logger.info(
        {
          event: "worker_completed",
          extractionId: result.extraction.id,
          documentId: result.extraction.documentId,
          state: result.extraction.state,
          durationMs: Date.now() - itemStartedAt,
        } satisfies WorkerLogPayload,
        "tentativa processada",
      );
    } catch {
      // Rede de seguranca. Hoje `runDocumentExtraction` captura tudo internamente
      // e nunca lanca, entao este bloco e INALCANCAVEL pela superficie publica —
      // por isso a trava dele e estatica, nao comportamental (ver o teste). Ele
      // existe para o dia em que aquele contrato mudar sem que alguem se lembre
      // deste laco.
      failed += 1;
      logger.warn(
        {
          event: "worker_failed",
          documentId: pendente.documentId,
          reasonCode: "ERRO_INTERNO",
          durationMs: Date.now() - itemStartedAt,
        } satisfies WorkerLogPayload,
        "erro inesperado ao processar tentativa",
      );
    }
  }

  const durationMs = Date.now() - batchStartedAt;
  logger.info(
    {
      event: "worker_batch_completed",
      batchSize,
      count: pendentes.length,
      durationMs,
    } satisfies WorkerLogPayload,
    "lote de extracao concluido",
  );

  return { scanned: pendentes.length, processed, skipped, failed, durationMs };
}
