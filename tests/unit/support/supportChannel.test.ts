/**
 * Canal de suporte — resolucao da env `SUPPORT_WHATSAPP_URL`.
 *
 * O comportamento sob teste e FAIL-SOFT e restritivo: sem env, ou com env
 * suspeita, o botao fica desabilitado. Nunca cai em link arbitrario.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  resolveWhatsAppSupport,
  SUPPORT_SAFETY_NOTE,
  SUPPORT_UNAVAILABLE_TEXT,
} from "../../../src/server/support/supportChannel";

test("sem env: canal indisponivel por 'nao-configurado'", () => {
  assert.deepEqual(resolveWhatsAppSupport(undefined), {
    available: false,
    reason: "nao-configurado",
  });
});

test("env vazia ou so espacos conta como nao configurada", () => {
  for (const value of ["", "   ", "\n"]) {
    assert.deepEqual(resolveWhatsAppSupport(value), {
      available: false,
      reason: "nao-configurado",
    });
  }
});

test("aceita os hosts de WhatsApp conhecidos em https", () => {
  const validos = [
    "https://wa.me/5500000000000",
    "https://api.whatsapp.com/send?phone=5500000000000",
    "https://web.whatsapp.com/send?phone=5500000000000",
  ];
  for (const url of validos) {
    const channel = resolveWhatsAppSupport(url);
    assert.equal(channel.available, true, `deveria aceitar: ${url}`);
  }
});

test("normaliza host em maiuscula", () => {
  const channel = resolveWhatsAppSupport("https://WA.ME/5500000000000");
  assert.equal(channel.available, true);
});

test("recusa http (sem TLS)", () => {
  assert.deepEqual(resolveWhatsAppSupport("http://wa.me/5500000000000"), {
    available: false,
    reason: "url-invalida",
  });
});

test("recusa host fora da lista, inclusive subdominio parecido", () => {
  const recusados = [
    "https://exemplo.com/suporte",
    "https://wa.me.exemplo.com/5500000000000",
    "https://gov.br",
    "https://evil-wa.me/123",
  ];
  for (const url of recusados) {
    assert.deepEqual(
      resolveWhatsAppSupport(url),
      { available: false, reason: "url-invalida" },
      `deveria recusar: ${url}`,
    );
  }
});

test("recusa numero cru e texto solto (nao e URL)", () => {
  for (const value of ["5500000000000", "+55 (00) 00000-0000", "wa.me/5500000000000"]) {
    assert.deepEqual(resolveWhatsAppSupport(value), {
      available: false,
      reason: "url-invalida",
    });
  }
});

test("recusa esquemas perigosos", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd"]) {
    assert.deepEqual(resolveWhatsAppSupport(value), {
      available: false,
      reason: "url-invalida",
    });
  }
});

test("ha texto de indisponibilidade para cada motivo", () => {
  assert.ok(SUPPORT_UNAVAILABLE_TEXT["nao-configurado"].length > 0);
  assert.ok(SUPPORT_UNAVAILABLE_TEXT["url-invalida"].length > 0);
});

test("o aviso de seguranca nega pedido de credencial Gov.br", () => {
  assert.match(SUPPORT_SAFETY_NOTE.toLowerCase(), /nunca pede senha, código ou token do gov\.br/);
});

test("nenhum numero de telefone real esta chumbado no codigo", () => {
  const code = readFileSync("src/server/support/supportChannel.ts", "utf8");
  assert.doesNotMatch(code, /\+?55\d{10,}/, "sem numero brasileiro chumbado");
  assert.doesNotMatch(code, /wa\.me\/\d/, "sem link wa.me com numero");
});
