/**
 * Reconciliacao CATALOGO <-> PERSISTENCIA do tipo de processo (dominio puro).
 *
 * Contexto (diagnostico Opcao B): `ProcessType` NAO e enum Prisma — e a tabela
 * relacional `process_types`, com `code String @unique`. O problema atual e de
 * NAMESPACE, nao de schema: a Guia e persistida com `code = GUIA_TRAFEGO_PF_CAC`,
 * enquanto o catalogo usa `LaunchProcessCode = GUIA_TRAFEGO`.
 *
 * Este modulo e a UNICA fonte de reconciliacao entre os dois namespaces. Nao
 * altera schema, nao cria migration, nao muda o `code` existente da Guia e nao
 * mexe no seed. Os 3 tipos futuros (CR/Autorizacao/CRAF) ja tem entrada aqui,
 * mesmo sem existir ainda no banco — a linha de seed correspondente e ETAPA
 * FUTURA e aprovada (fora deste PR).
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */
import { isLaunchProcessCode, type LaunchProcessCode } from "./processCatalog";

/**
 * Codigo do tipo de processo como GRAVADO em `process_types.code`.
 * So a Guia diverge do catalogo (`GUIA_TRAFEGO_PF_CAC`); os demais usam o mesmo
 * identificador do catalogo enquanto nao houver motivo para divergir.
 */
export const PERSISTED_PROCESS_TYPE_CODES = [
  "GUIA_TRAFEGO_PF_CAC",
  "CONCESSAO_CR",
  "AUTORIZACAO_COMPRA",
  "EMISSAO_CRAF",
] as const;

export type PersistedProcessTypeCode = (typeof PERSISTED_PROCESS_TYPE_CODES)[number];

/** Persistido -> Catalogo. So a Guia difere; os demais sao identidade. */
const CATALOG_BY_PERSISTED: Record<PersistedProcessTypeCode, LaunchProcessCode> = {
  GUIA_TRAFEGO_PF_CAC: "GUIA_TRAFEGO",
  CONCESSAO_CR: "CONCESSAO_CR",
  AUTORIZACAO_COMPRA: "AUTORIZACAO_COMPRA",
  EMISSAO_CRAF: "EMISSAO_CRAF",
};

/** Catalogo -> Persistido (inverso exato do mapa acima). */
const PERSISTED_BY_CATALOG: Record<LaunchProcessCode, PersistedProcessTypeCode> = {
  GUIA_TRAFEGO: "GUIA_TRAFEGO_PF_CAC",
  CONCESSAO_CR: "CONCESSAO_CR",
  AUTORIZACAO_COMPRA: "AUTORIZACAO_COMPRA",
  EMISSAO_CRAF: "EMISSAO_CRAF",
};

/** `true` se o valor e um `process_types.code` conhecido pelo catalogo. */
export function isKnownPersistedProcessTypeCode(
  code: unknown,
): code is PersistedProcessTypeCode {
  return (
    typeof code === "string" &&
    (PERSISTED_PROCESS_TYPE_CODES as readonly string[]).includes(code)
  );
}

/**
 * `true` se o `process_types.code` corresponde a um processo do catalogo.
 * Hoje equivale a `isKnownPersistedProcessTypeCode`, mas expressa a INTENCAO
 * (pode existir, no futuro, tipo persistido fora do catalogo de lancamento).
 */
export function isPersistedCodeForLaunchCatalog(code: unknown): boolean {
  return isKnownPersistedProcessTypeCode(code);
}

/** Persistido -> Catalogo, ou `undefined` para codigo desconhecido. */
export function catalogCodeFromPersistedProcessTypeCode(
  code: string,
): LaunchProcessCode | undefined {
  return isKnownPersistedProcessTypeCode(code) ? CATALOG_BY_PERSISTED[code] : undefined;
}

/** Catalogo -> Persistido, ou `undefined` para codigo desconhecido. */
export function persistedProcessTypeCodeFromCatalogCode(
  code: string,
): PersistedProcessTypeCode | undefined {
  return isLaunchProcessCode(code) ? PERSISTED_BY_CATALOG[code] : undefined;
}
