import { type ExtractionState, type Prisma } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";

/**
 * Repositorio de tentativas de extracao (PR #47A).
 *
 * 1:N por documento: uma linha POR TENTATIVA, historico preservado. "A extracao
 * atual" e sempre a MAIS RECENTE — nunca um update destrutivo, porque a decisao
 * automatica precisa saber em qual tentativa se baseou.
 *
 * NEED-TO-KNOW (mesmo criterio de `processDocumentRepository`): `fields` guarda o
 * que foi lido do documento do cliente, ou seja, PII. O select BASE nao o inclui —
 * so a funcao explicitamente marcada como "full" o busca, e ela exige que o
 * chamador ja tenha checado `process.pii.viewFull`. Esconder na UI nao bastaria:
 * o dado buscado ainda trafega no payload RSC e em log.
 *
 * Este modulo NAO conhece storage: nao ha `storageKey` aqui, nem caminho local.
 * Tambem nao faz OCR, nao chama rede e nao toca Gov.br/SINARM/PF.
 */

/** Campos NAO sensiveis — seguros para fila, contagem e decisao automatica. */
const EXTRACTION_BASE_SELECT = {
  id: true,
  documentId: true,
  state: true,
  confidence: true,
  engine: true,
  engineVersion: true,
  failureReason: true,
  extractedAt: true,
  reviewedAt: true,
  reviewedBy: true,
  reviewedByRole: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** PII — so para quem tem `process.pii.viewFull`. */
const EXTRACTION_FIELDS_SELECT = { fields: true } as const;

/**
 * Ordem de "a extracao mais recente deste documento".
 *
 * `created_at` e TIMESTAMP(3): duas linhas no MESMO milissegundo empatavam, e o
 * desempate era o que o Postgres devolvesse — podia alternar entre execucoes e
 * fazer a mesma pergunta ter duas respostas. `id DESC` torna o resultado ESTAVEL.
 *
 * Honestidade sobre o que isso e: `id` e uuid v4, aleatorio. O desempate e
 * REPRODUTIVEL, nao semanticamente "mais novo". Com o unique parcial de
 * `20260729000000`, duas ATIVAS deixam de existir, entao o empate so pode
 * ocorrer entre linhas terminais criadas no mesmo milissegundo.
 */
const LATEST_FIRST: Prisma.DocumentExtractionOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

/**
 * Ordem da FILA de trabalho: a mais ANTIGA primeiro.
 *
 * ASC, nao DESC: FIFO. Ordenar pela mais recente faria a tentativa mais antiga
 * nunca chegar ao topo enquanto entrasse trabalho novo — e a que ja esperou mais
 * e justamente a que nao pode ser preterida.
 *
 * O desempate por `id` existe pelo mesmo motivo de `LATEST_FIRST`: `created_at`
 * e TIMESTAMP(3), duas linhas no mesmo milissegundo empatam, e sem criterio
 * declarado a mesma fila podia sair em ordens diferentes entre execucoes.
 */
const OLDEST_FIRST: Prisma.DocumentExtractionOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];

/** Tentativa SEM os campos extraidos. */
export type ExtractionRow = {
  id: string;
  documentId: string;
  state: ExtractionState;
  confidence: string | null;
  engine: string;
  engineVersion: string;
  failureReason: string | null;
  extractedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewedByRole: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Tentativa COM os campos extraidos (PII). */
export type ExtractionRowWithFields = ExtractionRow & { fields: Prisma.JsonValue | null };

export type CreateExtractionData = {
  documentId: string;
  engine: string;
  engineVersion: string;
};

/**
 * Abre uma tentativa PENDENTE para o documento.
 *
 * Sempre INSERE: reprocessar cria uma linha nova, nunca sobrescreve a anterior.
 * `state` usa o default PENDENTE do schema, e nenhum campo extraido nasce
 * preenchido — nao ha OCR nesta fase.
 */
export function createPendingExtractionForDocument(
  data: CreateExtractionData,
): Promise<ExtractionRow> {
  return getPrisma().documentExtraction.create({
    data,
    select: EXTRACTION_BASE_SELECT,
  });
}

/**
 * Tentativa mais recente do documento, SEM os campos extraidos.
 *
 * E a leitura padrao: fila, decisao automatica e painel de excecao precisam do
 * estado, nao do conteudo do documento.
 */
export function findLatestExtractionForDocument(
  documentId: string,
): Promise<ExtractionRow | null> {
  return getPrisma().documentExtraction.findFirst({
    where: { documentId },
    orderBy: LATEST_FIRST,
    select: EXTRACTION_BASE_SELECT,
  });
}

/**
 * Tentativa mais recente COM os campos extraidos (PII).
 *
 * O NOME e longo de proposito: quem chama tem de assumir que esta pedindo PII e
 * ja ter verificado `process.pii.viewFull`. Nao ha checagem de permissao aqui —
 * repositorio nao conhece sessao; o guard fica na action/rota, como no resto do
 * projeto.
 */
export function findLatestExtractionWithFieldsForDocument(
  documentId: string,
): Promise<ExtractionRowWithFields | null> {
  return getPrisma().documentExtraction.findFirst({
    where: { documentId },
    orderBy: LATEST_FIRST,
    select: { ...EXTRACTION_BASE_SELECT, ...EXTRACTION_FIELDS_SELECT },
  });
}

/**
 * Tentativa mais recente COM os campos extraidos (PII) para VARIOS documentos.
 *
 * UMA query para N documentos. A versao singular acima, chamada em laco, geraria
 * N+1: a tela de um processo tem varios documentos, e a fila de automacao percorre
 * varios processos. O `orderBy` desc + "primeiro visto vence" reproduz exatamente
 * o criterio da singular — a mais recente por documento.
 *
 * Mesmo aviso de PII da singular, e pelo mesmo motivo: o nome diz "WithFields"
 * para que ninguem a chame sem perceber que esta pedindo o conteudo do documento
 * do cliente. Quem chama tem de ter direito de ver esses campos — por posse do
 * processo (o dono) ou por `process.pii.viewFull` (a equipe).
 *
 * Lista vazia NAO consulta o banco: `in: []` seria uma ida inutil ao Postgres.
 */
export async function findLatestExtractionsWithFieldsForDocuments(
  documentIds: readonly string[],
): Promise<ExtractionRowWithFields[]> {
  if (documentIds.length === 0) return [];

  const rows: ExtractionRowWithFields[] = await getPrisma().documentExtraction.findMany({
    where: { documentId: { in: [...documentIds] } },
    orderBy: LATEST_FIRST,
    select: { ...EXTRACTION_BASE_SELECT, ...EXTRACTION_FIELDS_SELECT },
  });

  const latestByDocument = new Map<string, ExtractionRowWithFields>();
  for (const row of rows) {
    if (!latestByDocument.has(row.documentId)) latestByDocument.set(row.documentId, row);
  }
  return [...latestByDocument.values()];
}

/**
 * Referencia MINIMA de uma tentativa aguardando execucao.
 *
 * Duas chaves, e so. Quem monta um lote precisa saber o que existe e a qual
 * documento pertence — nao precisa de `fields`, nem de `confidence`, nem de
 * `engine`. Um tipo maior aqui viraria, sem esforco, um caminho de PII para
 * dentro de log e de resumo de execucao.
 */
export type PendingExtractionRef = {
  id: string;
  documentId: string;
};

/**
 * Proximas tentativas PENDENTE, as mais antigas primeiro.
 *
 * SO OLHA: nao transiciona estado, nao reserva nada. O claim continua sendo
 * exclusividade de `claimPendingExtraction`, chamado por quem executa. Reservar
 * aqui criaria um segundo dono da mesma regra, e dois donos divergem no primeiro
 * ajuste.
 *
 * Consequencia disso, e nao e defeito: entre esta leitura e o claim a linha pode
 * mudar (outra instancia venceu, ou a tentativa terminou). Quem executa precisa
 * tratar `claimed: false` como caso normal — e trata.
 *
 * `limit <= 0` NAO consulta o banco, mesma economia de `in: []` acima.
 */
export function listPendingExtractions(limit: number): Promise<PendingExtractionRef[]> {
  if (limit <= 0) return Promise.resolve([]);

  return getPrisma().documentExtraction.findMany({
    where: { state: "PENDENTE" },
    orderBy: OLDEST_FIRST,
    take: limit,
    // O `select` E o gate: `fields` fora daqui significa que a PII nao chega nem
    // a sair da tabela. Filtrar depois nao seria equivalente — o dado ja teria
    // trafegado, e log e resumo passariam a poder alcanca-lo por descuido.
    select: { id: true, documentId: true },
  });
}

/**
 * Estados em que uma tentativa ocupa a vaga ATIVA do documento.
 *
 * Duplicado de proposito: `ACTIVE_EXTRACTION_STATES` mora em
 * `requestDocumentExtraction`, que e um SERVICE — um repositorio importando
 * service inverteria a camada. A copia e travada por teste de paridade, para que
 * as duas nao possam divergir em silencio.
 */
const ACTIVE_STATES: readonly ExtractionState[] = ["PENDENTE", "PROCESSANDO"];

/**
 * `documentId` de toda tentativa ATIVA, em todos os documentos.
 *
 * Conjunto pequeno POR CONSTRUCAO: o indice unico parcial garante no maximo uma
 * ativa por documento, entao isto e limitado a "documentos em voo agora", nao ao
 * historico — que continua sendo 1:N e pode ser grande.
 *
 * Devolve so o id. Quem monta fila precisa saber QUAIS documentos ja estao
 * ocupados; nao precisa da tentativa, do estado nem de nada que venha do
 * documento do cliente.
 */
export async function listActiveExtractionDocumentIds(): Promise<string[]> {
  const linhas = await getPrisma().documentExtraction.findMany({
    where: { state: { in: [...ACTIVE_STATES] } },
    select: { documentId: true },
  });
  return linhas.map((linha) => linha.documentId);
}

/** Historico completo do documento, mais recentes primeiro, SEM PII. */
export function listExtractionsForDocument(documentId: string): Promise<ExtractionRow[]> {
  return getPrisma().documentExtraction.findMany({
    where: { documentId },
    orderBy: LATEST_FIRST,
    select: EXTRACTION_BASE_SELECT,
  });
}

/**
 * CLAIM: transiciona PENDENTE -> PROCESSANDO, e devolve se ESTE chamador venceu.
 *
 * O `where` carrega `id` E `state` de proposito — e o coracao da funcao. Um
 * `update` por id apenas sobrescreveria o estado, e dois runners que lessem
 * "PENDENTE" ao mesmo tempo passariam os dois, rodando a engine em duplicidade
 * sobre o mesmo documento. Com `state` no `where`, o Postgres resolve: o UPDATE
 * e uma unica instrucao atomica, so uma transacao encontra a linha em PENDENTE,
 * e o perdedor recebe `count: 0` ANTES de chamar a engine.
 *
 * Nao ha transacao explicita nem `FOR UPDATE`: um UPDATE condicional ja e a
 * primitiva certa, e e mais barato que segurar lock por toda a extracao.
 */
export async function claimPendingExtraction(id: string): Promise<boolean> {
  const { count } = await getPrisma().documentExtraction.updateMany({
    where: { id, state: "PENDENTE" },
    data: { state: "PROCESSANDO" },
  });
  return count === 1;
}

/**
 * Encerra tentativas PROCESSANDO paradas ha tempo demais NESTE documento.
 *
 * Existe por causa de um efeito colateral da propria protecao do #47C-4: o
 * indice unico parcial impede uma segunda tentativa ativa, entao uma linha que
 * ficou PROCESSANDO por queda da app nao so persiste — ela BLOQUEIA o documento.
 * `requestDocumentExtraction` a reusaria para sempre e `runDocumentExtraction` a
 * recusaria; sem isto, nao ha saida pela aplicacao.
 *
 * RELOGIO E `updatedAt`, NAO `createdAt`. Verificado contra o Postgres: o
 * `updateMany` do claim RENOVA `@updatedAt`, entao numa linha PROCESSANDO ele
 * marca o instante em que o processamento COMECOU. `createdAt` marca o pedido,
 * que pode ser muito anterior — mediria a espera na fila junto com o trabalho e
 * mataria tentativa recem-iniciada.
 *
 * Consequencia a nao esquecer: qualquer update numa linha PROCESSANDO adia o
 * timeout. Um heartbeat de worker (#47D) usaria isso de proposito; um update
 * acidental quebraria a garantia sem aviso.
 *
 * Um unico UPDATE condicional — atomico como o claim. Dois reapers concorrentes
 * nao se atrapalham: o segundo encontra 0 linhas. Devolve a CONTAGEM, nunca as
 * linhas: quem limpa nao precisa receber PII de volta.
 */
export async function failStaleProcessingExtractions(
  documentId: string,
  cutoff: Date,
): Promise<number> {
  const { count } = await getPrisma().documentExtraction.updateMany({
    where: { documentId, state: "PROCESSANDO", updatedAt: { lt: cutoff } },
    // `TIMEOUT` ja existe em `EXTRACTION_FAILURE_REASONS` — codigo fechado, sem PII.
    data: { state: "FALHOU", failureReason: "TIMEOUT" },
  });
  return count;
}

/**
 * Encerra tentativas PROCESSANDO paradas ha tempo demais em TODOS os documentos.
 *
 * IRMA da funcao acima, NAO substituta. As duas resolvem coisas diferentes e
 * precisam das duas: a por `documentId` DESTRAVA o documento do cliente no
 * instante em que ele pede de novo — e e ela que garante que ninguem fica preso,
 * mesmo sem nada varrendo a tabela. Esta aqui e REDE DE SEGURANCA, para a orfa de
 * um documento que ninguem foi pedir: sem ela, a linha fica PROCESSANDO para
 * sempre, aparecendo em relatorio como trabalho em andamento que nao existe.
 *
 * NAO recebe `documentId`, e a versao por documento NAO ganhou um parametro
 * opcional para virar global. O `where` escopado dela e protegido por teste
 * justamente porque afroxa-lo era o atalho previsivel para chegar aqui — e um
 * escopo variavel erraria em silencio, matando tentativa viva de outro documento.
 * Duas funcoes com `where` fixo sao mais dificeis de usar errado que uma com
 * escopo configuravel.
 *
 * RELOGIO E `updatedAt`, mesmo criterio da versao por documento: o claim
 * PENDENTE -> PROCESSANDO renova `@updatedAt`, entao numa linha PROCESSANDO ele
 * marca quando o processamento COMECOU. `createdAt` mediria a espera na fila
 * junto com o trabalho e mataria tentativa recem-iniciada.
 *
 * Um unico UPDATE condicional — atomico e idempotente como o claim: dois
 * chamadores concorrentes nao se atrapalham, o segundo encontra 0 linhas. Devolve
 * a CONTAGEM, nunca as linhas: quem limpa nao precisa receber PII de volta.
 */
export async function failStaleProcessingExtractionsEverywhere(cutoff: Date): Promise<number> {
  const { count } = await getPrisma().documentExtraction.updateMany({
    where: { state: "PROCESSANDO", updatedAt: { lt: cutoff } },
    // `TIMEOUT` ja existe em `EXTRACTION_FAILURE_REASONS` — codigo fechado, sem PII.
    data: { state: "FALHOU", failureReason: "TIMEOUT" },
  });
  return count;
}

export type UpdateExtractionStateData = {
  state: ExtractionState;
  /** Campos lidos (PII). Omitido => nao mexe no que ja estava gravado. */
  fields?: Prisma.InputJsonValue;
  /** Agregado do PIOR campo. */
  confidence?: string | null;
  /** CODIGO de `EXTRACTION_FAILURE_REASONS` — nunca texto bruto de OCR. */
  failureReason?: string | null;
  extractedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  reviewedByRole?: string | null;
};

/**
 * Move o estado de UMA tentativa.
 *
 * Devolve a linha SEM `fields`: quem atualiza nao precisa receber PII de volta.
 */
export function updateExtractionState(
  id: string,
  data: UpdateExtractionStateData,
): Promise<ExtractionRow> {
  return getPrisma().documentExtraction.update({
    where: { id },
    data,
    select: EXTRACTION_BASE_SELECT,
  });
}
