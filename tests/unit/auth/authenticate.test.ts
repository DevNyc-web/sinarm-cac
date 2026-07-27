/**
 * Politica de autenticacao — login, cadastro, sessao e revogacao.
 *
 * TUDO com stub: nenhum teste toca Postgres. Foi para isso que `authenticate.ts`
 * recebe as dependencias por injecao — o CI nao tem banco, e deixar o caminho
 * critico de auth sem cobertura seria o pior lugar para abrir excecao.
 *
 * LIMITE HONESTO: stub prova a POLITICA, nao a integracao. O comportamento real
 * do Prisma (unique de e-mail, cascade da sessao) continua sem cobertura em CI.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type RegisterDeps,
  type StoredUser,
  login,
  normalizeEmail,
  register,
  resolveSession,
  revokeSession,
  toAuthUser,
} from "../../../src/server/auth/authenticate";
import { hashPassword } from "../../../src/server/auth/password";

const SENHA = "SenhaFicticia123";

async function usuarioFicticio(overrides: Partial<StoredUser> = {}): Promise<StoredUser> {
  return {
    id: "user-ficticio",
    name: "Fulano Ficticio",
    email: "fulano@example.com",
    role: "USER",
    active: true,
    passwordHash: await hashPassword(SENHA),
    ...overrides,
  };
}

function lookupDe(usuarios: StoredUser[]) {
  return async (email: string) => usuarios.find((u) => u.email === email) ?? null;
}

// ---------------------------------------------------------------------- login

test("senha correta autentica", async () => {
  const user = await usuarioFicticio();
  const resultado = await login(
    { email: "fulano@example.com", password: SENHA },
    { findUserByEmail: lookupDe([user]) },
  );

  assert.equal(resultado.ok, true);
  assert.ok(resultado.ok && resultado.user);
  assert.equal(resultado.ok && resultado.user.id, "user-ficticio");
});

test("senha errada nao autentica", async () => {
  const user = await usuarioFicticio();
  const resultado = await login(
    { email: "fulano@example.com", password: "SenhaErradaFicticia" },
    { findUserByEmail: lookupDe([user]) },
  );
  assert.deepEqual(resultado, { ok: false, reason: "INVALID_CREDENTIALS" });
});

test("e-mail e case-insensitive e ignora espacos", async () => {
  const user = await usuarioFicticio();
  for (const digitado of ["FULANO@EXAMPLE.COM", "  Fulano@Example.Com  ", "fulano@example.com"]) {
    const resultado = await login(
      { email: digitado, password: SENHA },
      { findUserByEmail: lookupDe([user]) },
    );
    assert.equal(resultado.ok, true, `"${digitado}" deveria autenticar`);
  }
});

test("usuario inativo nao autentica", async () => {
  const user = await usuarioFicticio({ active: false });
  const resultado = await login(
    { email: "fulano@example.com", password: SENHA },
    { findUserByEmail: lookupDe([user]) },
  );
  assert.deepEqual(resultado, { ok: false, reason: "INVALID_CREDENTIALS" });
});

test("usuario com passwordHash null nao autentica", async () => {
  // Caso dos 5 usuarios de seed: existem, estao ativos, e nao entram por senha.
  const user = await usuarioFicticio({ passwordHash: null });
  const resultado = await login(
    { email: "fulano@example.com", password: SENHA },
    { findUserByEmail: lookupDe([user]) },
  );
  assert.deepEqual(resultado, { ok: false, reason: "INVALID_CREDENTIALS" });
});

test("usuario inexistente devolve o MESMO motivo dos demais", async () => {
  // Enumeracao de usuario: o motivo nao pode diferenciar os casos.
  const inexistente = await login(
    { email: "ninguem@example.com", password: SENHA },
    { findUserByEmail: lookupDe([]) },
  );
  const senhaErrada = await login(
    { email: "fulano@example.com", password: "erradaFicticia" },
    { findUserByEmail: lookupDe([await usuarioFicticio()]) },
  );
  const inativo = await login(
    { email: "fulano@example.com", password: SENHA },
    { findUserByEmail: lookupDe([await usuarioFicticio({ active: false })]) },
  );

  assert.deepEqual(inexistente, senhaErrada);
  assert.deepEqual(inexistente, inativo);
});

test("rate limit interrompe o login antes de consultar o usuario", async () => {
  let consultas = 0;
  const resultado = await login(
    { email: "fulano@example.com", password: SENHA },
    {
      findUserByEmail: async () => {
        consultas += 1;
        return null;
      },
      checkRateLimit: () => ({ allowed: false }),
    },
  );

  assert.deepEqual(resultado, { ok: false, reason: "RATE_LIMITED" });
  assert.equal(consultas, 0, "bloqueado nao pode custar consulta");
});

test("login bem-sucedido zera o contador de tentativas", async () => {
  const user = await usuarioFicticio();
  const resetadas: string[] = [];
  await login(
    { email: "Fulano@Example.com", password: SENHA },
    {
      findUserByEmail: lookupDe([user]),
      checkRateLimit: () => ({ allowed: true }),
      resetRateLimit: (key) => resetadas.push(key),
    },
  );
  assert.deepEqual(resetadas, ["login:fulano@example.com"], "a chave usa o e-mail normalizado");
});

test("passwordHash NUNCA sai no resultado do login", async () => {
  const user = await usuarioFicticio();
  const resultado = await login(
    { email: "fulano@example.com", password: SENHA },
    { findUserByEmail: lookupDe([user]) },
  );

  assert.ok(resultado.ok);
  const serializado = JSON.stringify(resultado.ok ? resultado.user : {});
  assert.equal(serializado.includes("passwordHash"), false);
  assert.equal(serializado.includes(SENHA), false);
  assert.equal(serializado.includes("scrypt"), false);
  assert.equal("passwordHash" in (resultado.ok ? resultado.user : {}), false);
  assert.equal("active" in (resultado.ok ? resultado.user : {}), false);
});

test("toAuthUser descarta os campos sensiveis", async () => {
  const user = await usuarioFicticio();
  const publico = toAuthUser(user);
  assert.deepEqual(Object.keys(publico).sort(), ["email", "id", "name", "role"]);
});

// ------------------------------------------------------------------- cadastro

function registerDeps(existentes: StoredUser[] = []): RegisterDeps & { criados: unknown[] } {
  const criados: unknown[] = [];
  return {
    criados,
    findUserByEmail: lookupDe(existentes),
    createUser: async (data) => {
      criados.push(data);
      return { id: "novo", name: data.name, email: data.email, role: data.role };
    },
  };
}

test("cadastro cria apenas USER, mesmo se o formulario mandar outro papel", async () => {
  const deps = registerDeps();
  const resultado = await register(
    // Campo extra hostil: um `role` no corpo do request nao pode ter efeito.
    { name: "Fulano", email: "novo@example.com", password: SENHA, role: "ADMIN" } as never,
    deps,
  );

  assert.equal(resultado.ok, true);
  assert.equal(resultado.ok && resultado.user.role, "USER");
  assert.equal((deps.criados[0] as { role: string }).role, "USER");
});

test("cadastro normaliza o e-mail antes de gravar", async () => {
  const deps = registerDeps();
  await register({ name: "Fulano", email: "  NOVO@Example.COM ", password: SENHA }, deps);
  assert.equal((deps.criados[0] as { email: string }).email, "novo@example.com");
});

test("cadastro nao aceita e-mail duplicado, mesmo com caixa diferente", async () => {
  const existente = await usuarioFicticio({ email: "fulano@example.com" });
  const resultado = await register(
    { name: "Outro", email: "FULANO@example.com", password: SENHA },
    registerDeps([existente]),
  );
  assert.deepEqual(resultado, { ok: false, reason: "EMAIL_TAKEN" });
});

test("cadastro grava hash, nunca a senha", async () => {
  const deps = registerDeps();
  await register({ name: "Fulano", email: "novo@example.com", password: SENHA }, deps);

  const criado = deps.criados[0] as { passwordHash: string };
  assert.match(criado.passwordHash, /^scrypt\$/);
  assert.equal(criado.passwordHash.includes(SENHA), false);
  assert.equal(JSON.stringify(criado).includes(SENHA), false);
});

test("cadastro valida entrada", async () => {
  for (const ruim of [
    { name: "F", email: "novo@example.com", password: SENHA },
    { name: "Fulano", email: "nao-e-email", password: SENHA },
    { name: "Fulano", email: "novo@example.com", password: "curta" },
  ]) {
    const resultado = await register(ruim, registerDeps());
    assert.equal(resultado.ok, false);
    assert.equal(resultado.ok === false && resultado.reason, "INVALID_INPUT");
  }
});

test("rate limit interrompe o cadastro antes de qualquer consulta", async () => {
  const deps = registerDeps();
  const resultado = await register(
    { name: "Fulano", email: "novo@example.com", password: SENHA },
    { ...deps, checkRateLimit: () => ({ allowed: false }), rateLimitKey: "signup:203.0.113.7" },
  );
  assert.deepEqual(resultado, { ok: false, reason: "RATE_LIMITED" });
  assert.equal(deps.criados.length, 0);
});

// --------------------------------------------------------------------- sessao

const AGORA = new Date("2026-07-27T12:00:00.000Z");

function sessionDeps(overrides: {
  session?: { tokenHash: string; userId: string; expiresAt: Date } | null;
  user?: StoredUser | null;
}) {
  const apagadas: string[] = [];
  return {
    apagadas,
    findSessionByTokenHash: async () => overrides.session ?? null,
    findUserById: async () => overrides.user ?? null,
    deleteSessionByTokenHash: async (hash: string) => {
      apagadas.push(hash);
    },
    now: () => AGORA,
  };
}

test("sessao valida resolve o usuario", async () => {
  const user = await usuarioFicticio();
  const deps = sessionDeps({
    session: { tokenHash: "hash", userId: user.id, expiresAt: new Date(AGORA.getTime() + 1000) },
    user,
  });

  const resolvido = await resolveSession("hash", deps);
  assert.equal(resolvido?.id, user.id);
  assert.equal(resolvido && "passwordHash" in resolvido, false);
});

test("sessao inexistente nao autentica", async () => {
  assert.equal(await resolveSession("hash", sessionDeps({ session: null })), null);
});

test("sessao EXPIRADA nao autentica — e a linha e apagada", async () => {
  const user = await usuarioFicticio();
  const deps = sessionDeps({
    session: { tokenHash: "hash", userId: user.id, expiresAt: new Date(AGORA.getTime() - 1) },
    user,
  });

  assert.equal(await resolveSession("hash", deps), null);
  assert.deepEqual(deps.apagadas, ["hash"], "sessao vencida deve ser limpa");
});

test("usuario desativado derruba a sessao existente", async () => {
  const user = await usuarioFicticio({ active: false });
  const deps = sessionDeps({
    session: { tokenHash: "hash", userId: user.id, expiresAt: new Date(AGORA.getTime() + 1000) },
    user,
  });
  assert.equal(await resolveSession("hash", deps), null, "active=false precisa valer na hora");
});

test("logout revoga a sessao", async () => {
  const apagadas: string[] = [];
  await revokeSession("hash-da-sessao", {
    deleteSessionByTokenHash: async (h) => {
      apagadas.push(h);
    },
  });
  assert.deepEqual(apagadas, ["hash-da-sessao"]);
});

test("logout sem sessao valida nao falha (idempotente)", async () => {
  const apagadas: string[] = [];
  const deps = {
    deleteSessionByTokenHash: async (h: string) => {
      apagadas.push(h);
    },
  };
  await assert.doesNotReject(() => revokeSession(null, deps));
  assert.deepEqual(apagadas, [], "sem hash, nada a apagar");
});

// ------------------------------------------------------------------ auxiliares

test("normalizeEmail e a mesma funcao para escrita e leitura", () => {
  assert.equal(normalizeEmail("  Fulano@Example.COM "), "fulano@example.com");
  assert.equal(normalizeEmail("ja@minusculo.com"), "ja@minusculo.com");
  // Idempotente: aplicar duas vezes nao muda o resultado.
  assert.equal(normalizeEmail(normalizeEmail(" A@B.com ")), normalizeEmail(" A@B.com "));
});
