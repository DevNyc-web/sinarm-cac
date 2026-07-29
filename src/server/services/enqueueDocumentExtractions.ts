/**
 * Caso de uso: ABRIR tentativas de extracao para os documentos elegiveis (#47D-3B).
 *
 * O QUE RESOLVE: ate aqui, `requestDocumentExtraction` existia sem chamador de
 * producao, entao a fila nunca tinha nada e o lote manual sempre devolvia zero.
 * Este service e o unico ponto que CRIA fila — de forma limitada e sem escolha
 * individual de documento.
 *
 * NAO EXECUTA NADA: nao chama a engine, nao chama o lote, nao le arquivo, nao
 * consulta storage, nao usa rede. Depois de enfileirar, processar continua sendo
 * um segundo acionamento explicito. Encadear os dois esconderia qual dos passos
 * falhou.
 *
 * SEM `documentId` DE FORA: o escopo e fixo (status + ausencia de tentativa
 * ativa + limite). Nao ha selecao individual, entao nao ha caminho para a UI
 * apontar um documento — e por isso a tela nunca precisa lista-los.
 */
import {
  listActiveExtractionDocumentIds,
} from "@/server/repositories/documentExtractionRepository";
import { listDocumentsAwaitingExtraction } from "@/server/repositories/processDocumentRepository";
import { requestDocumentExtraction } from "./requestDocumentExtraction";

/**
 * Quantos documentos um acionamento enfileira.
 *
 * 10 e pequeno de proposito, e maior que o lote de processamento (5) tambem de
 * proposito: enfileirar e barato — nao roda engine, nao le arquivo — e uma fila
 * um pouco maior que um lote evita que quem opera fique alternando cliques um a
 * um. Pequeno o bastante para que um criterio de elegibilidade errado atinja dez
 * documentos, nao a base inteira.
 *
 * Constante de SERVIDOR: nao vem de formulario nem de query. Um limite
 * controlavel por quem chama e entrada nao validada num caminho que CRIA linhas.
 */
export const ENQUEUE_BATCH_SIZE = 10;

/**
 * Resultado do acionamento: contagens e tempo. Nunca linhas, nunca PII.
 *
 * `requested` sao as tentativas NOVAS. `reused` e corrida esperada: entre a
 * leitura dos candidatos e o INSERT, outro operador abriu a tentativa e o indice
 * unico parcial recusou a segunda — `requestDocumentExtraction` releu e devolveu
 * a existente. Isso e a protecao funcionando, nao falha, e por isso tem contador
 * proprio em vez de somar em `failed`.
 *
 * Vale sempre: `candidates === requested + reused + failed`. Cada candidato
 * incrementa exatamente um contador.
 */
export type EnqueueSummary = {
  /** Documentos elegiveis encontrados nesta passada. */
  candidates: number;
  /** Tentativas ABERTAS agora. */
  requested: number;
  /** Ja havia tentativa ativa — corrida entre acionamentos. */
  reused: number;
  /** Nao foi possivel abrir (documento sumiu, banco recusou). */
  failed: number;
  durationMs: number;
};

/**
 * Enfileira ate `limit` documentos elegiveis.
 *
 * NUNCA lanca: um documento problematico nao pode impedir os outros nove, e
 * falha de leitura devolve resumo zerado em vez de derrubar quem chamou.
 *
 * NAO LOGA: quem tem o autor da acao e a camada de cima. Logar aqui produziria
 * evento sem `actorId`, que para uma acao manual e auditoria pela metade.
 */
export async function enqueueDocumentExtractions(
  limit: number = ENQUEUE_BATCH_SIZE,
): Promise<EnqueueSummary> {
  const iniciadoEm = Date.now();
  const zerado = (): EnqueueSummary => ({
    candidates: 0,
    requested: 0,
    reused: 0,
    failed: 0,
    durationMs: Date.now() - iniciadoEm,
  });

  if (limit <= 0) return zerado();

  let candidatos: { id: string }[];
  try {
    // ORDEM IMPORTA: os ativos primeiro, para que a consulta de candidatos ja
    // exclua quem ocupa a vaga. Excluir depois, em memoria, gastaria o limite com
    // documentos que nunca poderiam ser enfileirados — e um lote de 10 poderia
    // voltar sem abrir nenhuma tentativa, parecendo defeito.
    const ocupados = await listActiveExtractionDocumentIds();
    candidatos = await listDocumentsAwaitingExtraction(limit, ocupados);
  } catch {
    // `catch` SEM binding: o erro do banco nao existe como variavel, entao nao ha
    // como registra-lo por descuido.
    return zerado();
  }

  let requested = 0;
  let reused = 0;
  let failed = 0;

  // SEQUENCIAL. Cada `requestDocumentExtraction` faz suas proprias consultas;
  // dispara-las juntas multiplicaria corrida no mesmo indice parcial sem ganho
  // perceptivel num lote de dez.
  for (const candidato of candidatos) {
    const resultado = await requestDocumentExtraction(candidato.id);

    if (!resultado.ok) {
      failed += 1;
      continue;
    }
    if (resultado.reused) {
      reused += 1;
      continue;
    }
    requested += 1;
  }

  return {
    candidates: candidatos.length,
    requested,
    reused,
    failed,
    durationMs: Date.now() - iniciadoEm,
  };
}
