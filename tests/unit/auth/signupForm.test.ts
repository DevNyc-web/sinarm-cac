/**
 * Confirmacao de senha do cadastro — validacao de FORMULARIO.
 *
 * Cobre o caso que motivou o campo (erro de digitacao) e as bordas que uma
 * comparacao ingenua erraria: espaco, acento, caixa e tipo nao-string.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  checkPasswordConfirmation,
  PASSWORD_MISMATCH_MESSAGE,
} from "../../../src/server/auth/signupForm";

test("senhas iguais passam", () => {
  assert.deepEqual(checkPasswordConfirmation("senha-longa-123", "senha-longa-123"), {
    ok: true,
  });
});

test("senhas diferentes sao recusadas com a mensagem unica", () => {
  assert.deepEqual(checkPasswordConfirmation("senha-longa-123", "senha-longa-124"), {
    ok: false,
    message: PASSWORD_MISMATCH_MESSAGE,
  });
});

test("confirmacao vazia e recusada quando ha senha", () => {
  assert.equal(checkPasswordConfirmation("senha-longa-123", "").ok, false);
});

test("comparacao e EXATA — espaco no fim conta como diferenca", () => {
  // `password.ts` nao apara a senha antes do hash; aparar aqui aceitaria um par
  // que viraria hash de outra coisa.
  assert.equal(checkPasswordConfirmation("senha-longa-123", "senha-longa-123 ").ok, false);
  assert.equal(checkPasswordConfirmation(" senha-longa-123", "senha-longa-123").ok, false);
});

test("comparacao diferencia caixa e acento", () => {
  assert.equal(checkPasswordConfirmation("Senha-Longa", "senha-longa").ok, false);
  assert.equal(checkPasswordConfirmation("senha-comum", "senha-comúm").ok, false);
});

test("senha com espaco proposital e aceita quando as duas batem", () => {
  assert.equal(checkPasswordConfirmation("frase com espaco", "frase com espaco").ok, true);
});

test("ambas vazias passam aqui — tamanho minimo e da politica de auth", () => {
  // Este modulo so evita erro de digitacao; `register()` recusa por tamanho.
  assert.equal(checkPasswordConfirmation("", "").ok, true);
});

test("entrada nao-string e recusada, sem lancar", () => {
  const naoString = undefined as unknown as string;
  assert.equal(checkPasswordConfirmation(naoString, "x").ok, false);
  assert.equal(checkPasswordConfirmation("x", naoString).ok, false);
});

test("a mensagem nao revela qual campo esta errado nem ecoa a senha", () => {
  const texto = PASSWORD_MISMATCH_MESSAGE.toLowerCase();
  assert.ok(!texto.includes("primeiro"), "nao aponta campo");
  assert.ok(!texto.includes("segundo"), "nao aponta campo");
  assert.ok(texto.includes("não são iguais"));
});

/** Trava estatica: validacao de formulario nao pode virar politica de auth. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("signupForm nao toca banco, hash, sessao nem rede", () => {
  const code = codeOnly(readFileSync("src/server/auth/signupForm.ts", "utf8"));
  assert.doesNotMatch(code, /@prisma\/client|getPrisma|Repository/, "sem banco");
  assert.doesNotMatch(code, /hashPassword|verifyPassword|scrypt/, "sem hash");
  assert.doesNotMatch(code, /startRealSession|cookies\(/, "sem sessao");
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
});

test("a Action valida a confirmacao ANTES de registerClient e nao ecoa a senha", () => {
  const code = readFileSync("src/app/(public)/cadastro/actions.ts", "utf8");
  const posCheck = code.indexOf("checkPasswordConfirmation");
  const posRegister = code.indexOf("registerClient(");
  assert.ok(posCheck >= 0, "a Action deve chamar checkPasswordConfirmation");
  assert.ok(posCheck < posRegister, "confirmacao vem antes do cadastro");
  // A senha nunca pode voltar na querystring de erro.
  assert.doesNotMatch(code, /senha=|password=\$\{|encodeURIComponent\(password\)/);
});
