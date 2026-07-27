/**
 * Repositorio de sessoes — SO I/O. Nenhuma politica mora aqui: quem decide se a
 * sessao vale e `authenticate.ts`.
 *
 * INVARIANTE: este modulo nunca ve nem grava o token em claro. Ele recebe e
 * devolve `tokenHash` (SHA-256 do token). Um dump da tabela `sessions` nao
 * permite forjar sessao.
 *
 * Sessao do NOSSO app. Nada aqui tem relacao com sessao de Gov.br/SINARM, que
 * continua proibida de ser criada ou persistida (docs/00 §8).
 */
import { getPrisma } from "@/server/db/prisma";

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}

const SESSION_SELECT = { tokenHash: true, userId: true, expiresAt: true } as const;

/** Cria a sessao. O chamador ja gerou o token e guardou so o hash. */
export async function createSession(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await getPrisma().session.create({
    data: { userId: data.userId, tokenHash: data.tokenHash, expiresAt: data.expiresAt },
  });
}

/** Busca por hash. `null` quando nao existe. */
export async function findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
  return getPrisma().session.findUnique({ where: { tokenHash }, select: SESSION_SELECT });
}

/**
 * Marca uso recente. Best-effort: uma falha aqui NAO pode derrubar a requisicao —
 * `lastUsedAt` e telemetria de sessao, nao controle de acesso.
 */
export async function touchSession(tokenHash: string, at: Date = new Date()): Promise<void> {
  try {
    await getPrisma().session.update({ where: { tokenHash }, data: { lastUsedAt: at } });
  } catch {
    // Sessao pode ter sido revogada entre a leitura e a escrita. Ignorar.
  }
}

/** Revoga uma sessao. Idempotente: revogar o que nao existe nao e erro. */
export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  await getPrisma().session.deleteMany({ where: { tokenHash } });
}

/** Revoga TODAS as sessoes do usuario — base para "sair de todos os dispositivos". */
export async function deleteSessionsForUser(userId: string): Promise<number> {
  const { count } = await getPrisma().session.deleteMany({ where: { userId } });
  return count;
}

/**
 * Remove sessoes vencidas. Ha indice em `expires_at`.
 *
 * Nao ha agendador neste PR: a limpeza acontece de carona no logout e pode ser
 * chamada por rotina futura. Sessao vencida nao autentica de qualquer forma
 * (`resolveSession` confere a validade), entao isto e higiene, nao seguranca.
 */
export async function deleteExpiredSessions(now: Date = new Date()): Promise<number> {
  const { count } = await getPrisma().session.deleteMany({ where: { expiresAt: { lte: now } } });
  return count;
}
