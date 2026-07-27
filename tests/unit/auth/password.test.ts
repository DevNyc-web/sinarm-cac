/**
 * Hash de senha do PRODUTO (scrypt). Sem banco, sem rede.
 *
 * Todas as senhas aqui sao FICTICIAS. Nada neste arquivo tem relacao com
 * credencial de Gov.br/SINARM, que continua proibida (docs/00 §8).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PASSWORD_MAX_LENGTH,
  SCRYPT_PARAMS,
  hashPassword,
  needsRehash,
  parsePasswordHash,
  verifyPassword,
} from "../../../src/server/auth/password";

const SENHA = "SenhaFicticia123";

test("o hash nao contem a senha em claro", async () => {
  const hash = await hashPassword(SENHA);
  assert.equal(hash.includes(SENHA), false, "a senha aparece no hash");
  assert.equal(hash.toLowerCase().includes(SENHA.toLowerCase()), false);
});

test("o hash e versionado e carrega os parametros", async () => {
  const hash = await hashPassword(SENHA);
  const [algoritmo, N, r, p] = hash.split("$");

  assert.equal(algoritmo, "scrypt", "o algoritmo precisa estar no hash");
  assert.equal(Number(N), SCRYPT_PARAMS.N);
  assert.equal(Number(r), SCRYPT_PARAMS.r);
  assert.equal(Number(p), SCRYPT_PARAMS.p);
  assert.equal(hash.split("$").length, 6, "formato scrypt$N$r$p$salt$hash");
});

test("o mesmo texto gera hashes diferentes (salt aleatorio)", async () => {
  const [a, b] = await Promise.all([hashPassword(SENHA), hashPassword(SENHA)]);
  assert.notEqual(a, b, "salt repetido permitiria tabela arco-iris");
  assert.equal(await verifyPassword(SENHA, a), true);
  assert.equal(await verifyPassword(SENHA, b), true);
});

test("senha correta confere; senha errada nao", async () => {
  const hash = await hashPassword(SENHA);
  assert.equal(await verifyPassword(SENHA, hash), true);
  assert.equal(await verifyPassword("SenhaErradaFicticia", hash), false);
  assert.equal(await verifyPassword(SENHA.toUpperCase(), hash), false, "senha e case-sensitive");
  assert.equal(await verifyPassword("", hash), false);
});

test("hash nulo nao autentica — e nao lanca", async () => {
  // Usuario semeado nao tem senha: `passwordHash = null` precisa NEGAR, e nao
  // explodir com 500 (que seria distinguivel de "senha errada").
  assert.equal(await verifyPassword(SENHA, null), false);
});

test("hash corrompido nao autentica — e nao lanca", async () => {
  for (const ruim of [
    "",
    "scrypt",
    "scrypt$32768$8$1$soSalt",
    "argon2$32768$8$1$c2FsdA$aGFzaA",
    "scrypt$0$8$1$c2FsdA$aGFzaA",
    "scrypt$-1$8$1$c2FsdA$aGFzaA",
    "scrypt$abc$8$1$c2FsdA$aGFzaA",
    "scrypt$32768$8$1$$",
    "texto qualquer",
  ]) {
    assert.equal(await verifyPassword(SENHA, ruim), false, `"${ruim}" deveria falhar`);
    assert.equal(parsePasswordHash(ruim), null, `"${ruim}" deveria ser irreconhecivel`);
  }
});

test("hash com custo absurdo e recusado, nao executado", async () => {
  // Sem teto, um valor adulterado no banco viraria negacao de servico: o scrypt
  // tentaria alocar memoria proporcional a N.
  const absurdo = "scrypt$999999999$8$1$c2FsdGVzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaA";
  assert.equal(parsePasswordHash(absurdo), null);
  assert.equal(await verifyPassword(SENHA, absurdo), false);
});

test("senha acima do limite e recusada na escrita", async () => {
  const gigante = "a".repeat(PASSWORD_MAX_LENGTH + 1);
  await assert.rejects(() => hashPassword(gigante), /acima de/i);
  // Na LEITURA nao lanca: apenas nao confere.
  const hash = await hashPassword(SENHA);
  assert.equal(await verifyPassword(gigante, hash), false);
});

test("needsRehash aponta hash mais fraco que o custo atual", async () => {
  const atual = await hashPassword(SENHA);
  assert.equal(needsRehash(atual), false, "hash recem-criado nao precisa de rehash");

  const antigo = `scrypt$1024$8$1$${Buffer.from("saltsaltsaltsalt").toString("base64url")}$${Buffer.from(
    "x".repeat(32),
  ).toString("base64url")}`;
  assert.equal(needsRehash(antigo), true, "custo menor precisa ser regravado");

  // Algoritmo desconhecido tambem: e assim que a migracao para argon2id vai
  // funcionar sem resetar senha de ninguem.
  assert.equal(needsRehash("argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA"), true);
});

test("o modulo nao expoe a senha em nenhum retorno", async () => {
  const hash = await hashPassword(SENHA);
  const parsed = parsePasswordHash(hash);
  assert.ok(parsed);
  assert.equal(JSON.stringify(parsed).includes(SENHA), false);
});
