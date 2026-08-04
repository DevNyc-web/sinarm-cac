/**
 * Numero interno do processo — formato decidido pelo docs/62.
 *
 * `CAC-YYYY-NNNNNN` (ex.: `CAC-2026-000001`), com sequencia GLOBAL e
 * monotonica: o ano e rotulo visual do momento da criacao e a sequencia NAO
 * reinicia por ano (docs/62 §3/§4).
 *
 * NAO E PROTOCOLO: este numero e interno e privado do site, nunca protocolo
 * Gov.br/SINARM/PF (docs/62 §9). O prefixo `CAC-` e do produto, nao do orgao.
 *
 * CODIGOS ANTIGOS: `GT-DEV-...` (gerador anterior) e `GT-DEMO-001` (seed)
 * continuam validos e intocados. Este modulo NAO valida formato e nao existe
 * nenhum lugar que rejeite um codigo antigo — a busca admin segue por
 * `contains` case-insensitive (docs/62 §5/§8).
 */
import { getPrisma } from "@/server/db/prisma";

/** Nome da sequence criada em `20260804000000_add_process_code_sequence`. */
const SEQUENCE_NAME = "process_code_seq";

/**
 * Monta o codigo a partir do numero da sequencia e do ano.
 *
 * Pura de proposito: o formato e a parte que precisa de teste, e o CI roda
 * SEM banco (`.github/workflows/ci.yml`). Separar leitura de formatacao deixa
 * a regra testavel sem Postgres.
 *
 * ESTOURO DE 6 DIGITOS: `padStart` so COMPLETA, nunca corta — a partir de
 * 1000000 o numero passa a ocupar 7 digitos (`CAC-2027-1000000`) e a
 * monotonicidade continua. docs/62 §4.1 deixou o comportamento em aberto;
 * crescer e mais seguro que estourar, e nao exige decisao nova de formato.
 */
export function formatProcessCode(sequenceValue: bigint | number, year: number): string {
  return `CAC-${year}-${String(sequenceValue).padStart(6, "0")}`;
}

/**
 * Reserva o proximo numero e devolve o codigo pronto.
 *
 * `nextval` e atomico e nao bloqueante: duas criacoes simultaneas nunca
 * recebem o mesmo valor (docs/62 §4.1). Lacunas sao esperadas — rollback
 * consome o numero —, o que a decisao permite: exige monotonica, nao sem
 * lacunas.
 *
 * O ano vem de `getUTCFullYear` para casar com `createdAt`, que o Prisma grava
 * em UTC; usar o fuso local faria a virada de ano divergir do registro.
 */
export async function generateProcessCode(): Promise<string> {
  // Template tagged (nao `$queryRawUnsafe`): a query e literal, sem
  // interpolacao — nenhuma superficie de injecao, nenhum parametro.
  const rows = await getPrisma().$queryRaw<{ n: bigint }[]>`
    SELECT nextval('process_code_seq') AS n
  `;

  const sequenceValue = rows[0]?.n;
  if (sequenceValue == null) {
    // Sem numero nao ha codigo, e `code` e NOT NULL UNIQUE: falhar aqui e
    // melhor que inventar um valor e furar a monotonicidade.
    throw new Error(
      `Sequence "${SEQUENCE_NAME}" nao retornou valor. Rode: npm run db:migrate`,
    );
  }

  return formatProcessCode(sequenceValue, new Date().getUTCFullYear());
}
