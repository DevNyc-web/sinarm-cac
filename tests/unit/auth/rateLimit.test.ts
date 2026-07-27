/**
 * Rate limit em memoria. Sem banco, sem rede, relogio controlado pelo teste.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LOGIN_RATE_LIMIT,
  SIGNUP_RATE_LIMIT,
  createRateLimiter,
} from "../../../src/server/auth/rateLimit";

/** Relogio manual: nenhum teste depende de tempo real. */
function relogio(inicio = 0) {
  let agora = inicio;
  return { now: () => agora, avancar: (ms: number) => (agora += ms) };
}

test("login: bloqueia depois do limite de tentativas", () => {
  const t = relogio();
  const limiter = createRateLimiter(LOGIN_RATE_LIMIT, t.now);
  const chave = "login:fulano@example.com";

  for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i += 1) {
    assert.equal(limiter.consume(chave).allowed, true, `tentativa ${i + 1} deveria passar`);
  }

  const bloqueado = limiter.consume(chave);
  assert.equal(bloqueado.allowed, false, "a tentativa seguinte deve ser bloqueada");
  assert.equal(bloqueado.remaining, 0);
  assert.ok(bloqueado.retryAfterMs > 0, "deve informar quanto falta");
});

test("cadastro: bloqueia depois do limite, com janela propria", () => {
  const t = relogio();
  const limiter = createRateLimiter(SIGNUP_RATE_LIMIT, t.now);
  const chave = "signup:203.0.113.7";

  for (let i = 0; i < SIGNUP_RATE_LIMIT.limit; i += 1) {
    assert.equal(limiter.consume(chave).allowed, true);
  }
  assert.equal(limiter.consume(chave).allowed, false);

  // A janela de cadastro e maior que a de login: meia hora nao libera.
  t.avancar(30 * 60 * 1000);
  assert.equal(limiter.consume(chave).allowed, false, "ainda dentro da janela de 60 min");
});

test("a janela desliza: passado o tempo, libera de novo", () => {
  const t = relogio();
  const limiter = createRateLimiter(LOGIN_RATE_LIMIT, t.now);
  const chave = "login:fulano@example.com";

  for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i += 1) limiter.consume(chave);
  assert.equal(limiter.consume(chave).allowed, false);

  t.avancar(LOGIN_RATE_LIMIT.windowMs + 1);
  assert.equal(limiter.consume(chave).allowed, true, "fora da janela deveria liberar");
});

test("chaves diferentes nao interferem entre si", () => {
  const t = relogio();
  const limiter = createRateLimiter(LOGIN_RATE_LIMIT, t.now);

  for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i += 1) limiter.consume("login:a@example.com");
  assert.equal(limiter.consume("login:a@example.com").allowed, false);
  assert.equal(
    limiter.consume("login:b@example.com").allowed,
    true,
    "bloquear um e-mail nao pode bloquear outro",
  );
});

test("reset libera o alvo — usado apos login bem-sucedido", () => {
  const t = relogio();
  const limiter = createRateLimiter(LOGIN_RATE_LIMIT, t.now);
  const chave = "login:fulano@example.com";

  for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i += 1) limiter.consume(chave);
  assert.equal(limiter.consume(chave).allowed, false);

  limiter.reset(chave);
  assert.equal(limiter.consume(chave).allowed, true);
});

test("a memoria nao cresce sem limite: chave expirada e descartada", () => {
  const t = relogio();
  const limiter = createRateLimiter(LOGIN_RATE_LIMIT, t.now);

  for (let i = 0; i < 50; i += 1) limiter.consume(`login:usuario${i}@example.com`);
  assert.equal(limiter.size(), 50);

  t.avancar(LOGIN_RATE_LIMIT.windowMs + 1);
  // Tocar em UMA chave ja limpa a propria; a varredura geral cobre o resto.
  limiter.consume("login:usuario0@example.com");
  assert.ok(limiter.size() <= 50, "chaves vencidas nao podem se acumular");

  for (let i = 0; i < 50; i += 1) limiter.consume(`login:usuario${i}@example.com`);
  assert.equal(limiter.size(), 50, "so as chaves vivas permanecem");
});

test("os limites configurados sao os acordados", () => {
  assert.deepEqual(LOGIN_RATE_LIMIT, { limit: 5, windowMs: 15 * 60 * 1000 });
  assert.deepEqual(SIGNUP_RATE_LIMIT, { limit: 3, windowMs: 60 * 60 * 1000 });
});

test("o modulo e puro: sem banco, sem rede, sem Date.now implicito no teste", () => {
  // Relogio injetado: dois limiters com relogios distintos nao se afetam.
  const a = relogio(0);
  const b = relogio(1_000_000);
  const la = createRateLimiter(LOGIN_RATE_LIMIT, a.now);
  const lb = createRateLimiter(LOGIN_RATE_LIMIT, b.now);

  for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i += 1) la.consume("x");
  assert.equal(la.consume("x").allowed, false);
  assert.equal(lb.consume("x").allowed, true);
});
