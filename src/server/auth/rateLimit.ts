/**
 * Rate limit MINIMO para login e cadastro — janela deslizante em memoria.
 *
 * LIMITES CONHECIDOS, e sao serios o bastante para estarem aqui e nao so no PR:
 *
 * 1. **Memoria do processo.** Com mais de uma instancia, cada uma tem seu proprio
 *    contador — o limite efetivo e multiplicado pelo numero de replicas.
 * 2. **Zera no restart.** Deploy ou crash limpa o historico.
 * 3. **Limitar login por e-mail permite DoS de conta**: um atacante que conheca o
 *    e-mail da vitima pode manter a conta bloqueada. O contrario (limitar so por
 *    IP) deixa passar ataque distribuido. Nenhuma das duas escolhas e boa sozinha.
 *
 * Isto NAO e suficiente para producao. Rate limit distribuido (Redis ou
 * equivalente) e PR futuro e pre-condicao de trafego real.
 *
 * Modulo PURO: sem I/O, sem banco, relogio injetavel — testavel sem infraestrutura.
 */

export interface RateLimitRule {
  /** Tentativas permitidas dentro da janela. */
  limit: number;
  /** Tamanho da janela, em milissegundos. */
  windowMs: number;
}

export const LOGIN_RATE_LIMIT: RateLimitRule = { limit: 5, windowMs: 15 * 60 * 1000 };
export const SIGNUP_RATE_LIMIT: RateLimitRule = { limit: 3, windowMs: 60 * 60 * 1000 };

export interface RateLimitDecision {
  allowed: boolean;
  /** Tentativas ainda disponiveis na janela. */
  remaining: number;
  /** Quanto falta para liberar. `0` quando permitido. */
  retryAfterMs: number;
}

export interface RateLimiter {
  /** Registra uma tentativa e decide se ela passa. */
  consume(key: string): RateLimitDecision;
  /** Zera um alvo — usado apos login bem-sucedido. */
  reset(key: string): void;
  /** Chaves vivas. Existe para o teste provar que a memoria nao cresce sem fim. */
  size(): number;
}

/** Acima disto, faz uma varredura geral antes de inserir. Evita vazamento de memoria. */
const SWEEP_THRESHOLD = 10_000;

export function createRateLimiter(
  rule: RateLimitRule,
  now: () => number = () => Date.now(),
): RateLimiter {
  const hits = new Map<string, number[]>();

  /** Descarta marcas fora da janela e remove a chave quando ela esvazia. */
  function prune(key: string, current: number): number[] {
    const cutoff = current - rule.windowMs;
    const kept = (hits.get(key) ?? []).filter((at) => at > cutoff);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
    return kept;
  }

  function sweep(current: number): void {
    for (const key of [...hits.keys()]) prune(key, current);
  }

  return {
    consume(key: string): RateLimitDecision {
      const current = now();
      if (hits.size >= SWEEP_THRESHOLD) sweep(current);

      const recent = prune(key, current);

      if (recent.length >= rule.limit) {
        const oldest = recent[0] ?? current;
        // A vaga mais antiga sai da janela quando ela completa `windowMs`.
        const retryAfterMs = Math.max(0, oldest + rule.windowMs - current);
        return { allowed: false, remaining: 0, retryAfterMs };
      }

      hits.set(key, [...recent, current]);
      return {
        allowed: true,
        remaining: Math.max(0, rule.limit - (recent.length + 1)),
        retryAfterMs: 0,
      };
    },

    reset(key: string): void {
      hits.delete(key);
    },

    size(): number {
      return hits.size;
    },
  };
}
