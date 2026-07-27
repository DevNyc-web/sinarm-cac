/**
 * Token de sessao opaco + HMAC. Sem banco, sem rede.
 *
 * Este arquivo cobre a rejeicao de cookie ADULTERADO — o teste que so e possivel
 * sem Postgres justamente porque o HMAC e verificado antes do banco.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SESSION_SECRET_MIN_LENGTH,
  SESSION_TTL_MS,
  assertSessionSecret,
  hashSessionToken,
  isSessionExpired,
  issueSessionToken,
  parseSessionCookie,
  sessionExpiryFrom,
} from "../../../src/server/auth/sessionToken";

const SEGREDO = "segredo-ficticio-de-teste-com-mais-de-32-chars";
const OUTRO_SEGREDO = "outro-segredo-ficticio-tambem-com-32-chars-ok";

test("o cookie emitido e aceito de volta", () => {
  const { cookieValue, tokenHash } = issueSessionToken(SEGREDO);
  const parsed = parseSessionCookie(cookieValue, SEGREDO);
  assert.ok(parsed);
  assert.equal(parsed.tokenHash, tokenHash, "o hash conferido deve bater com o gravado");
});

test("cada emissao gera token novo (sem fixacao de sessao)", () => {
  const a = issueSessionToken(SEGREDO);
  const b = issueSessionToken(SEGREDO);
  assert.notEqual(a.cookieValue, b.cookieValue);
  assert.notEqual(a.tokenHash, b.tokenHash);
});

test("o token em claro NAO e o que vai para o banco", () => {
  const { cookieValue, tokenHash } = issueSessionToken(SEGREDO);
  const token = cookieValue.split(".")[0] ?? "";
  assert.ok(token.length > 0);
  assert.notEqual(tokenHash, token, "o banco nao pode guardar o token em claro");
  assert.equal(cookieValue.includes(tokenHash), false, "o cookie nao carrega o hash");
  assert.equal(hashSessionToken(token), tokenHash);
});

test("cookie ADULTERADO nao autentica", () => {
  const { cookieValue } = issueSessionToken(SEGREDO);
  const [token, assinatura] = cookieValue.split(".");

  const forjados = [
    `${token}x.${assinatura}`, // token mexido
    `${token}.${assinatura}x`, // assinatura mexida
    `${token}.`, // assinatura vazia
    `.${assinatura}`, // token vazio
    token ?? "", // sem assinatura
    `${token}.${assinatura}.extra`, // parte a mais
    `outrotoken.${assinatura}`, // troca de token mantendo assinatura
    "", // vazio
  ];

  for (const forjado of forjados) {
    assert.equal(parseSessionCookie(forjado, SEGREDO), null, `aceitou cookie forjado: ${forjado}`);
  }
});

test("cookie assinado com OUTRO segredo nao autentica", () => {
  const { cookieValue } = issueSessionToken(OUTRO_SEGREDO);
  assert.equal(parseSessionCookie(cookieValue, SEGREDO), null);
});

test("sem segredo utilizavel, nada e emitido nem aceito (falha fechada)", () => {
  const curto = "curto-demais";
  assert.throws(() => issueSessionToken(curto), /AUTH_SESSION_SECRET/);
  assert.throws(() => assertSessionSecret(undefined), /AUTH_SESSION_SECRET/);
  assert.throws(() => assertSessionSecret(curto), /AUTH_SESSION_SECRET/);

  const { cookieValue } = issueSessionToken(SEGREDO);
  assert.equal(parseSessionCookie(cookieValue, curto), null, "segredo curto nao valida");
  assert.equal(parseSessionCookie(cookieValue, undefined), null, "sem segredo nao valida");
});

test("o segredo minimo declarado bate com o exigido", () => {
  assert.equal(SESSION_SECRET_MIN_LENGTH, 32);
  assert.ok(SEGREDO.length >= SESSION_SECRET_MIN_LENGTH);
});

test("sessao expirada e reconhecida", () => {
  const agora = new Date("2026-07-27T12:00:00.000Z");
  const expira = sessionExpiryFrom(agora);

  assert.equal(expira.getTime() - agora.getTime(), SESSION_TTL_MS);
  assert.equal(isSessionExpired(expira, agora), false, "recem-criada nao expirou");

  const depois = new Date(expira.getTime() + 1);
  assert.equal(isSessionExpired(expira, depois), true);
  // Limite exato conta como expirada — na duvida, nega.
  assert.equal(isSessionExpired(expira, expira), true);
});

test("parseSessionCookie nunca lanca, mesmo com entrada hostil", () => {
  for (const hostil of ["....", " ", "\u0000", "a".repeat(10_000), "$$$", "token.assinatura"]) {
    assert.doesNotThrow(() => parseSessionCookie(hostil, SEGREDO));
    assert.equal(parseSessionCookie(hostil, SEGREDO), null);
  }
});
