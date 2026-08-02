/**
 * Projecao PARCIAL e segura `internalStatus` -> `operationalStatus` — Fase 5h
 * (docs/46 §6/§7, docs/49).
 *
 * POR QUE ESTE MODULO EXISTE: `statusDivergence.ts` (Fase 5c) definia o mapa dos
 * 6 pares canonicos (`SAFE_PROJECTION`) inline, junto com o diagnostico inteiro.
 * Depois que `DOCUMENTO_ENVIADO`/`DOCUMENTO_APROVADO` tambem sairam da porta
 * manual (docs/50 §3/§6), o mapa canonico e a classificacao "operacional/
 * declarado" viraram conhecimento reutilizavel por si so — nao so pelo
 * diagnostico. Este modulo os extrai como fonte unica.
 *
 * O QUE ELE E: uma projecao PARCIAL, de proposito. So responde pelos 6 pares
 * que passam pela porta canonica (`transitionInternalStatus`) e pelos 3
 * `OperationalStatus` que docs/49 decidiu que permanecem SO operacionais
 * (estado da EQUIPE, sem `InternalStatus` 1:1 — categorias B e C do docs/49).
 * Todo o resto (os 12 `InternalStatus` avancados, os 2 da Fase 2, os pares
 * "legado esperado") continua sendo assunto de `statusDivergence.ts`, que tem
 * a narrativa e o motivo de cada caso.
 *
 * O QUE ELE NAO FAZ, DE PROPOSITO:
 *  - NAO e projecao TOTAL: nao tenta responder por todo `InternalStatus` nem
 *    inventar candidato para o que docs/46 nao documentou. `projectOperationalStatus`
 *    devolve `undefined` para qualquer valor fora dos 6 pares — "sem projecao
 *    segura" e resposta valida, nao lacuna a preencher.
 *  - NAO decide fila, permissao, readiness nem status visivel ao cliente —
 *    mesma restricao de `statusDivergence.ts` (docs/46 §11 proibe o mapa
 *    `operationalFromInternalStatus` como fonte operacional).
 *  - NAO trata `CANCELADO_DEV` como par canonico: docs/49 §3.5 deixou
 *    EXPLICITAMENTE pendente se um cancelamento real de cliente um dia existe,
 *    e nesse caso exigiria estado proprio — nunca reuso deste. Por isso
 *    `CANCELADO_DEV` entra em `OPERATIONAL_ONLY_STATUSES`, nunca em
 *    `CANONICAL_OPERATIONAL_PROJECTION`.
 *  - NAO acessa banco, rede ou arquivo. Modulo PURO, mesmo padrao de
 *    `statusDivergence.ts`/`operationalSignals.ts`.
 */
import { type InternalStatus, type OperationalStatus } from "@prisma/client";

/**
 * Os 6 pares com projecao SEGURA — o valor de `internalStatus` (chave) e o
 * `operationalStatus` esperado (valor) quando o processo passou pela porta
 * canonica `transitionInternalStatus`.
 *
 * Os 3 primeiros vem de docs/46 §6, mesmo nome nos dois campos. Os outros 3
 * tem NOMES DIFERENTES nos dois campos — `DOCUMENTO_RECEBIDO_PARA_ANALISE`/
 * `DOCUMENTO_VALIDADO`/`BLOQUEADO_OPERACIONAL` sao os candidatos aprovados
 * pela Fase 5d (docs/47 §6.2), com nome proprio no `InternalStatus` em vez de
 * reusar o nome do `OperationalStatus` de origem. `operationalStatus` continua
 * indo para `DOCUMENTO_ENVIADO`/`DOCUMENTO_APROVADO`/`BLOQUEADO` via `alsoSet`
 * — MESMO efeito final, so a porta mudou (docs/47, docs/48).
 */
export const CANONICAL_OPERATIONAL_PROJECTION = {
  RASCUNHO: "RASCUNHO",
  AGUARDANDO_PAGAMENTO: "AGUARDANDO_PAGAMENTO",
  PAGO_EM_FILA: "PAGO_EM_FILA",
  DOCUMENTO_RECEBIDO_PARA_ANALISE: "DOCUMENTO_ENVIADO",
  DOCUMENTO_VALIDADO: "DOCUMENTO_APROVADO",
  BLOQUEADO_OPERACIONAL: "BLOQUEADO",
} as const satisfies Partial<Record<InternalStatus, OperationalStatus>>;

export type CanonicalInternalStatus = keyof typeof CANONICAL_OPERATIONAL_PROJECTION;

const CANONICAL_INTERNAL_VALUES = Object.keys(
  CANONICAL_OPERATIONAL_PROJECTION,
) as CanonicalInternalStatus[];

/** `true` se `status` e um dos 6 `InternalStatus` com projecao segura. */
export function hasCanonicalProjection(status: InternalStatus): status is CanonicalInternalStatus {
  return (CANONICAL_INTERNAL_VALUES as readonly InternalStatus[]).includes(status);
}

/**
 * O `operationalStatus` esperado para `internalStatus`, quando existe
 * projecao segura. `undefined` para qualquer outro valor — NAO e "ainda nao
 * implementado", e "este `internalStatus` nao tem candidato canonico
 * documentado" (docs/46 §6/§7), resposta que `statusDivergence.ts` usa para
 * decidir entre `needs_decision` e `invalid_projection`.
 */
export function projectOperationalStatus(status: InternalStatus): OperationalStatus | undefined {
  return hasCanonicalProjection(status) ? CANONICAL_OPERATIONAL_PROJECTION[status] : undefined;
}

/**
 * `true` se o PAR e exatamente o par canonico seguro — o unico caso em que
 * `statusDivergence.ts` reporta `severity: "none"`. Qualquer outra combinacao
 * (inclusive `internalStatus` canonico com `operationalStatus` diferente do
 * esperado) NAO e coerente, mesmo que ambos sejam valores conhecidos.
 */
export function isCoherentPair(
  internalStatus: InternalStatus,
  operationalStatus: OperationalStatus,
): boolean {
  return projectOperationalStatus(internalStatus) === operationalStatus;
}

/**
 * Os 3 `OperationalStatus` que docs/49 decidiu que permanecem SO
 * operacionais — estado da EQUIPE ou da FILA, nao da jornada do processo:
 *
 *  - `EM_REVISAO_OPERACIONAL` — conferencia interna (categoria B, docs/49):
 *    divergencia PERMANENTE, nao ha `InternalStatus` 1:1, nem havera.
 *  - `PRONTO_PARA_PROTOCOLO_MANUAL` — fila de trabalho do operador (categoria
 *    B, docs/49), nao confundir com o `ReadinessLevel` homonimo de
 *    `operationalSignals.ts`, que e DERIVADO de criterios, nao projecao deste
 *    campo.
 *  - `CANCELADO_DEV` — cancelamento de ambiente DEV (categoria C, docs/49):
 *    fica FORA da projecao canonica por decisao FORMAL pendente — nunca
 *    tratar como par canonico so porque nao ha alternativa hoje.
 *
 * Nenhum dos 3 aparece em `CANONICAL_OPERATIONAL_PROJECTION`: nao tem par, nem
 * terao por reuso automatico se um dia ganharem um.
 */
export const OPERATIONAL_ONLY_STATUSES = [
  "EM_REVISAO_OPERACIONAL",
  "PRONTO_PARA_PROTOCOLO_MANUAL",
  "CANCELADO_DEV",
] as const satisfies readonly OperationalStatus[];

export type OperationalOnlyStatus = (typeof OPERATIONAL_ONLY_STATUSES)[number];

/** `true` se `status` e um dos 3 valores SO operacionais (docs/49 categorias B/C). */
export function isOperationalOnlyStatus(status: OperationalStatus): status is OperationalOnlyStatus {
  return (OPERATIONAL_ONLY_STATUSES as readonly OperationalStatus[]).includes(status);
}

/**
 * Os `OperationalStatus` que sao ALVO de um par canonico (aparecem como valor
 * em `CANONICAL_OPERATIONAL_PROJECTION`) mas tem nome DIFERENTE do
 * `InternalStatus` correspondente — `DOCUMENTO_ENVIADO`, `DOCUMENTO_APROVADO`
 * e `BLOQUEADO`. Quando um destes aparece com `internalStatus` fora do par
 * (um dos 6 canonicos ou um avancado), so pode ser DADO ANTIGO ou escrita de
 * uma porta legada anterior a migracao (docs/50 §3/§6, docs/48) — nunca um
 * escritor vivo, ja que todo escritor vivo destes 3 valores passa pela porta
 * canonica hoje. `statusDivergence.ts` reporta essa combinacao como
 * `expected_legacy`, nunca `needs_decision`.
 *
 * Os 3 primeiros pares (`RASCUNHO`/`AGUARDANDO_PAGAMENTO`/`PAGO_EM_FILA`) FICAM
 * DE FORA desta lista de proposito: mesmo nome nos dois campos, entao um
 * mismatch entre eles (ex.: internalStatus RASCUNHO com operationalStatus
 * PAGO_EM_FILA) nao tem "porta legada anterior" identificavel do mesmo jeito —
 * `statusDivergence.ts` classifica esse caso como `needs_decision`, nao
 * `expected_legacy`.
 */
export const LEGACY_EXPECTED_OPERATIONAL_STATUSES = [
  "DOCUMENTO_ENVIADO",
  "DOCUMENTO_APROVADO",
  "BLOQUEADO",
] as const satisfies readonly OperationalStatus[];

export type LegacyExpectedOperationalStatus = (typeof LEGACY_EXPECTED_OPERATIONAL_STATUSES)[number];

/** `true` se `status` e um dos 3 alvos canonicos com nome diferente (docs/50 §3/§6, docs/48). */
export function isLegacyExpectedOperationalStatus(
  status: OperationalStatus,
): status is LegacyExpectedOperationalStatus {
  return (LEGACY_EXPECTED_OPERATIONAL_STATUSES as readonly OperationalStatus[]).includes(status);
}
