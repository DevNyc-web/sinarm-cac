import { type InternalStatus, type ProcessEventKind } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";

/**
 * Repositorio de eventos de status do processo (docs/12 §3.5).
 * APPEND-ONLY: so cria e lista — nunca edita/apaga.
 */

export type RecordStatusEventData = {
  processId: string;
  fromStatus: InternalStatus | null;
  toStatus: InternalStatus;
  actorMockUserId: string;
  actorRole: string;
  /** Texto curto, SEM PII. */
  note?: string;
};

export function recordStatusEvent(data: RecordStatusEventData) {
  return getPrisma().processStatusEvent.create({
    data: {
      processId: data.processId,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      actorMockUserId: data.actorMockUserId,
      actorRole: data.actorRole,
      note: data.note,
    },
  });
}

/** Eventos do processo, mais antigos primeiro (ordem de linha do tempo). */
export function listStatusEvents(processId: string) {
  return getPrisma().processStatusEvent.findMany({
    where: { processId },
    orderBy: { createdAt: "asc" },
  });
}

export type RecordOperationalEventData = {
  processId: string;
  kind: Exclude<ProcessEventKind, "STATUS_INTERNO">;
  /** Rotulos curtos, SEM PII (ex.: "Normal" -> "Urgente"). */
  fromValue?: string | null;
  toValue?: string | null;
  /**
   * Estado canonico do processo (docs/44 §4), OPCIONAL.
   *
   * So preencher quando o chamador souber o `InternalStatus` COM CERTEZA — por
   * exemplo um fluxo que escreve o proprio canonico e ja tem os dois lados da
   * transicao em maos.
   *
   * NAO EXISTE mapeamento automatico de `OperationalStatus` para
   * `InternalStatus`, e nenhum sera adicionado aqui. Dos nove estados
   * operacionais, apenas tres sao 1:1 (`RASCUNHO`, `AGUARDANDO_PAGAMENTO`,
   * `PAGO_EM_FILA`) — e esses ja chegam pelo `recordStatusEvent`. Os demais
   * NAO devem ser inferidos:
   *
   * - `BLOQUEADO` e generico; `BLOQUEADO_INSTABILIDADE` afirma a CAUSA (portal
   *   fora do ar). Mapear inventaria o motivo do bloqueio.
   * - `CANCELADO_DEV` e cancelamento de desenvolvimento;
   *   `CANCELADO_REEMBOLSADO` afirma que houve reembolso.
   * - `EM_REVISAO_OPERACIONAL` e conferencia interna;
   *   `EM_REVISAO_HUMANA` e pausa de excecao da automacao assistida.
   *
   * Omitir grava `null` — exatamente o comportamento anterior a este campo
   * existir. **Auditoria parcialmente legada e melhor que auditoria falsa:** um
   * evento sem estado tipado diz "nao sei"; um evento com estado errado mente,
   * e a trilha e append-only.
   */
  fromStatus?: InternalStatus | null;
  toStatus?: InternalStatus | null;
  actorMockUserId: string;
  actorRole: string;
  note?: string;
};

/**
 * Registra evento operacional (status operacional, prioridade, responsavel,
 * nota) na mesma trilha append-only dos eventos de status (docs/11 §18).
 */
export function recordOperationalEvent(data: RecordOperationalEventData) {
  return getPrisma().processStatusEvent.create({
    data: {
      processId: data.processId,
      kind: data.kind,
      fromValue: data.fromValue ?? null,
      toValue: data.toValue ?? null,
      // `?? null` e nao `data.fromStatus`: mesmo criterio de `fromValue` acima.
      // Um lado informado sem o outro e VALIDO — meia transicao conhecida nao
      // autoriza adivinhar a outra metade.
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus ?? null,
      actorMockUserId: data.actorMockUserId,
      actorRole: data.actorRole,
      note: data.note,
    },
  });
}
