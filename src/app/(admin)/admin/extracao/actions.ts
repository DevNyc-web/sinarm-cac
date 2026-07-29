"use server";

/**
 * Server Actions do acionamento MANUAL de extracao (PR #47D-3A).
 *
 * ESTE E O UNICO ARQUIVO DE `src/app` AUTORIZADO a importar o lote e a varredura.
 * As travas de `documentExtractionWorker.test.ts` e `documentExtractionReaper.test.ts`
 * varrem `src/app` inteiro e isentam SO este caminho, por nome. O motivo da trava
 * e impedir extracao no caminho de RENDER; uma server action nao e render — e
 * handler de POST, protegido por permissao. `page.tsx` continua proibido de
 * importar qualquer um dos dois.
 *
 * O QUE ESTAS ACOES NAO FAZEM: nao criam tentativas pendentes (isso e o #47D-3B),
 * nao leem arquivo, nao chamam storage, nao usam rede, nao fazem OCR real, nao
 * alcancam orgao publico algum e nao tocam Fase 9. Tambem nao alcancam a
 * execucao por documento, a reserva atomica nem a engine — quem decide a reserva
 * continua sendo quem executa, dentro do lote.
 *
 * Os nomes dessas funcoes NAO aparecem aqui de proposito: a trava de
 * `documentExtractionEngine.test.ts` varre `src/app` pelo texto cru e NAO isenta
 * este arquivo — e e para continuar assim. Citar os identificadores, ainda que
 * em comentario, gastaria a unica trava que segue valendo integralmente aqui.
 *
 * SEM AGENDAMENTO: quem aciona e uma pessoa, com permissao e registro de autoria.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/server/auth/guards";
import { type Role } from "@/server/auth/roles";
import { type ExtractionFailureReason } from "@/server/documents/documentExtractionTypes";
import { enqueueDocumentExtractions } from "@/server/services/enqueueDocumentExtractions";
import { runExtractionReaperOnce } from "@/server/workers/documentExtractionReaper";
import { runExtractionWorkerOnce } from "@/server/workers/documentExtractionWorker";

const PAINEL = "/admin/extracao";

/** Nomes de evento que este acionamento emite. Fechado. */
type OpsLogEvent =
  | "extraction_worker_manual_triggered"
  | "extraction_worker_manual_failed"
  | "extraction_reaper_manual_triggered"
  | "extraction_reaper_manual_failed"
  | "extraction_enqueue_manual_triggered"
  | "extraction_enqueue_manual_failed";

/**
 * Payload de log — o TIPO E a allowlist.
 *
 * Mesmo mecanismo do lote e da varredura: chave fora desta lista nao compila
 * (excess property check), e `reasonCode` fora do conjunto fechado do dominio
 * tambem nao. Ampliar e decisao de PRIVACIDADE, nao de conveniencia.
 *
 * `actorId`/`actorRole` sao o operador INTERNO — mesmo par que
 * `ProcessStatusEvent` ja persiste (`actorMockUserId`, `actorRole`). NAO existe
 * `clientId`, `documentId` nem `extractionId` aqui: uma varredura que ceifa
 * dezenas de linhas nao pode virar inventario de documentos travados no log, e
 * quem opera nao precisa desses ids para saber que a acao funcionou.
 */
type OpsLogPayload = {
  event: OpsLogEvent;
  actorId: string;
  actorRole: Role;
  candidates?: number;
  requested?: number;
  reused?: number;
  scanned?: number;
  processed?: number;
  skipped?: number;
  failed?: number;
  reaped?: number;
  reasonCode?: ExtractionFailureReason;
  durationMs: number;
};

/**
 * Monta a URL de volta com o resultado.
 *
 * SO NUMEROS e dois literais fechados. O resultado nao viaja em texto livre
 * porque a pagina o exibe: qualquer string vinda daqui seria conteudo controlado
 * pela URL aparecendo na tela. A pagina ainda coage tudo com `Number()`, mas a
 * primeira barreira e nao produzir texto arbitrario.
 */
function urlDoResultado(
  acao: "lote" | "limpeza" | "fila",
  numeros: Record<string, number>,
): string {
  const params = new URLSearchParams({ acao });
  for (const [chave, valor] of Object.entries(numeros)) {
    params.set(chave, String(Math.trunc(valor)));
  }
  return `${PAINEL}?${params.toString()}`;
}

/**
 * Processa UM lote de tentativas PENDENTE.
 *
 * `formData` NAO e lido: a acao nao recebe documento, escopo nem filtro. O
 * parametro existe apenas porque `<form action>` sempre o entrega — recebe-lo e
 * ignora-lo e a garantia de que nao ha caminho para um `documentId` entrar aqui.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- receber e IGNORAR e o ponto: e o que garante que nenhum parametro (documentId, escopo, filtro) entre na acao
export async function runExtractionBatchAction(_formData: FormData): Promise<void> {
  const actor = await requirePermission("extraction.run");
  const iniciadoEm = Date.now();

  let destino: string;
  try {
    const resumo = await runExtractionWorkerOnce();

    logger.info(
      {
        event: "extraction_worker_manual_triggered",
        actorId: actor.id,
        actorRole: actor.role,
        scanned: resumo.scanned,
        processed: resumo.processed,
        skipped: resumo.skipped,
        failed: resumo.failed,
        durationMs: resumo.durationMs,
      } satisfies OpsLogPayload,
      "lote de extracao acionado manualmente",
    );

    destino = urlDoResultado("lote", {
      scanned: resumo.scanned,
      processed: resumo.processed,
      skipped: resumo.skipped,
      failed: resumo.failed,
      ms: resumo.durationMs,
    });
  } catch {
    // REDE DE SEGURANCA. Hoje `runExtractionWorkerOnce` captura tudo e nunca
    // lanca, entao este bloco e inalcancavel pela superficie publica — a trava
    // dele e estatica, nao comportamental. Existe para o dia em que aquele
    // contrato mudar sem que alguem se lembre desta acao.
    //
    // `catch` SEM binding: o erro nao existe como variavel, entao nao ha como
    // registra-lo por descuido.
    logger.warn(
      {
        event: "extraction_worker_manual_failed",
        actorId: actor.id,
        actorRole: actor.role,
        reasonCode: "ERRO_INTERNO",
        durationMs: Date.now() - iniciadoEm,
      } satisfies OpsLogPayload,
      "acionamento manual do lote de extracao falhou",
    );
    destino = `${PAINEL}?acao=lote&erro=1`;
  }

  // FORA DO `try`, sempre. `redirect()` funciona LANCANDO `NEXT_REDIRECT`: dentro
  // do bloco protegido, o `catch` acima o engoliria e a acao terminaria sem
  // navegar — em silencio, com a tela parecendo travada.
  revalidatePath(PAINEL);
  redirect(destino);
}

/**
 * Abre tentativas para os documentos elegiveis — CRIA fila, nao processa.
 *
 * Nao encadeia com o lote de proposito: um clique que enfileira E processa
 * esconderia qual dos dois passos falhou e dobraria a duracao de uma acao manual.
 * Depois desta, quem opera aciona "Processar fila de extracoes".
 *
 * O LIMITE NAO VEM DAQUI: `enqueueDocumentExtractions()` e chamada sem argumento,
 * usando a constante de servidor. Aceitar um limite do formulario seria entrada
 * nao validada num caminho que cria linhas.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- mesmo motivo das acoes acima
export async function enqueueExtractionsAction(_formData: FormData): Promise<void> {
  const actor = await requirePermission("extraction.run");
  const iniciadoEm = Date.now();

  let destino: string;
  try {
    const resumo = await enqueueDocumentExtractions();

    logger.info(
      {
        event: "extraction_enqueue_manual_triggered",
        actorId: actor.id,
        actorRole: actor.role,
        candidates: resumo.candidates,
        requested: resumo.requested,
        reused: resumo.reused,
        failed: resumo.failed,
        durationMs: resumo.durationMs,
      } satisfies OpsLogPayload,
      "criacao de tentativas de extracao acionada manualmente",
    );

    destino = urlDoResultado("fila", {
      candidates: resumo.candidates,
      requested: resumo.requested,
      reused: resumo.reused,
      failed: resumo.failed,
      ms: resumo.durationMs,
    });
  } catch {
    logger.warn(
      {
        event: "extraction_enqueue_manual_failed",
        actorId: actor.id,
        actorRole: actor.role,
        reasonCode: "ERRO_INTERNO",
        durationMs: Date.now() - iniciadoEm,
      } satisfies OpsLogPayload,
      "acionamento manual da criacao de tentativas falhou",
    );
    destino = `${PAINEL}?acao=fila&erro=1`;
  }

  revalidatePath(PAINEL);
  redirect(destino);
}

/** Encerra tentativas PROCESSANDO abandonadas. Mesmo contrato da acao acima. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- mesmo motivo da acao acima
export async function runExtractionReapAction(_formData: FormData): Promise<void> {
  const actor = await requirePermission("extraction.run");
  const iniciadoEm = Date.now();

  let destino: string;
  try {
    const resumo = await runExtractionReaperOnce();

    logger.info(
      {
        event: "extraction_reaper_manual_triggered",
        actorId: actor.id,
        actorRole: actor.role,
        reaped: resumo.reaped,
        durationMs: resumo.durationMs,
      } satisfies OpsLogPayload,
      "limpeza de extracoes abandonadas acionada manualmente",
    );

    destino = urlDoResultado("limpeza", { reaped: resumo.reaped, ms: resumo.durationMs });
  } catch {
    logger.warn(
      {
        event: "extraction_reaper_manual_failed",
        actorId: actor.id,
        actorRole: actor.role,
        reasonCode: "ERRO_INTERNO",
        durationMs: Date.now() - iniciadoEm,
      } satisfies OpsLogPayload,
      "acionamento manual da limpeza de extracoes falhou",
    );
    destino = `${PAINEL}?acao=limpeza&erro=1`;
  }

  revalidatePath(PAINEL);
  redirect(destino);
}
