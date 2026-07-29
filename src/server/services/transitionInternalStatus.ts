/**
 * Porta canonica de transicao do `internalStatus` (docs/44 §4) — Fase 3a.
 *
 * O QUE RESOLVE: o padrao "ler o estado anterior, gravar o novo, registrar evento
 * TIPADO" ja existia — inline em `confirmPixPayment`, o unico fluxo que escreve o
 * canonico hoje. Este helper extrai esse padrao para que os fluxos da Fase 3+
 * nascam com auditoria tipada em vez de reinventa-lo (ou esquece-lo).
 *
 * O QUE ELE NAO FAZ, DE PROPOSITO:
 *
 * - **Nao deriva** `operationalStatus` nem `userFacingStatus` a partir de
 *   `internalStatus`. Essa derivacao e decisao das Fases 4 e 5 (docs/44 §8); aqui
 *   ela seria um mapa implicito criado no lugar errado.
 * - **Nao mapeia** `OperationalStatus` -> `InternalStatus`. Dos nove estados
 *   operacionais so tres sao 1:1, e `BLOQUEADO`/`CANCELADO_DEV`/
 *   `EM_REVISAO_OPERACIONAL` inventariam causa, reembolso e tipo de pausa que
 *   nao aconteceram (ver `processEventRepository`).
 * - **Nao valida** a maquina de transicoes. As regras do docs/44 §7 ainda nao sao
 *   codigo; recusar transicao aqui seria inventar politica antes da decisao.
 *   Enquanto isso o helper REGISTRA o que o chamador pediu — e o evento tipado
 *   torna qualquer transicao estranha visivel na trilha.
 * - **Nao abre transacao.** `update` e evento continuam sendo duas operacoes,
 *   exatamente como hoje. A atomicidade e o PR 3b: o ganho de centralizar aqui e
 *   que ela sera corrigida em UM arquivo, para todos os chamadores.
 *
 * `fromStatus` e SEMPRE lido do banco, nunca recebido de fora: um chamador que
 * informa o estado anterior pode informar errado, e a trilha e append-only —
 * evento com estado errado mente para sempre.
 */
import {
  type InternalStatus,
  type OperationalStatus,
  type UserFacingStatus,
} from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { recordStatusEvent } from "@/server/repositories/processEventRepository";

export type TransitionInternalStatusInput = {
  processId: string;
  toStatus: InternalStatus;
  /** Quem causou a transicao. `"webhook"`/`"SYSTEM"` quando nao ha humano. */
  actorMockUserId: string;
  actorRole: string;
  /** Texto curto, SEM PII (docs/12 §3.5). */
  note?: string;
  /**
   * Outras visoes de status a gravar NA MESMA `update`.
   *
   * Existe para PRESERVAR o que o chamador ja escrevia — nao para o helper
   * decidir. Sem isto, um fluxo que hoje move as tres visoes numa unica `update`
   * precisaria de duas, o que PIORARIA a atomicidade que este PR nao pretende
   * mexer. Omitir nao escreve nada alem de `internalStatus`.
   */
  alsoSet?: {
    operationalStatus?: OperationalStatus;
    userFacingStatus?: UserFacingStatus;
  };
};

export type TransitionInternalStatusResult =
  | { ok: true; fromStatus: InternalStatus; toStatus: InternalStatus }
  | { ok: false; error: string };

/**
 * Move o `internalStatus` do processo e registra o evento tipado.
 *
 * NAO engole erro de banco: excecao propaga para o `try/catch` de quem chama —
 * os services deste projeto ja traduzem falha de infraestrutura na propria
 * mensagem. So o caso "processo nao existe" volta como `ok: false`, e nesse
 * caminho NADA e escrito: nem status, nem evento.
 */
export async function transitionInternalStatus(
  input: TransitionInternalStatusInput,
): Promise<TransitionInternalStatusResult> {
  const { processId, toStatus, actorMockUserId, actorRole, note, alsoSet } = input;

  const current = await getPrisma().process.findUnique({
    where: { id: processId },
    select: { internalStatus: true },
  });
  if (!current) return { ok: false, error: "Processo nao encontrado." };

  const fromStatus = current.internalStatus as InternalStatus;

  // Uma unica `update`: `internalStatus` mais o que o chamador pediu em
  // `alsoSet`. As chaves ausentes nao entram no `data` — coluna omitida no
  // Prisma nao e tocada.
  await getPrisma().process.update({
    where: { id: processId },
    data: {
      internalStatus: toStatus,
      ...(alsoSet?.operationalStatus ? { operationalStatus: alsoSet.operationalStatus } : {}),
      ...(alsoSet?.userFacingStatus ? { userFacingStatus: alsoSet.userFacingStatus } : {}),
    },
  });

  await recordStatusEvent({
    processId,
    fromStatus,
    toStatus,
    actorMockUserId,
    actorRole,
    note,
  });

  return { ok: true, fromStatus, toStatus };
}
