/**
 * InternalStatus — estados de pausa assistida (docs/44 §6, Fase 2).
 *
 * O que estes testes protegem:
 *
 * 1. Todo estado do enum tem rotulo. `INTERNAL_STATUS_LABELS` e
 *    `Record<InternalStatus, string>`, entao o compilador ja exige a chave — o
 *    que ele NAO exige e que o valor seja util. Rotulo vazio ou placeholder
 *    passa no typecheck e aparece em tela.
 * 2. O rotulo do captcha nao promete resolucao automatica. Burlar captcha e
 *    proibido de forma permanente (docs/00 §8); texto de tela e onde uma
 *    promessa dessas vaza primeiro.
 * 3. Os estados novos NAO tem consumidor. Este PR adiciona capacidade, nao
 *    comportamento — se um fluxo comecar a escreve-los sem uma decisao explicita,
 *    o teste falha. Varredura de fonte, mesmo idioma de `helpContent.test.ts`.
 *
 * Sem banco, sem rede: le o enum gerado pelo Prisma e o arquivo de rotulos.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { InternalStatus } from "@prisma/client";

import { INTERNAL_STATUS_LABELS } from "../../../src/server/processes/statusLabels";

const NOVOS_ESTADOS = ["AGUARDANDO_CONFIRMACAO_HUMANA", "AGUARDANDO_CAPTCHA"] as const;

/** Remove comentarios: mencao em comentario e documentacao, nao uso. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function arquivosDeFluxo(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) arquivosDeFluxo(caminho, acc);
    else if (/\.tsx?$/.test(entrada)) acc.push(caminho);
  }
  return acc;
}

test("todo InternalStatus tem rotulo nao vazio e sem placeholder", () => {
  const estados = Object.values(InternalStatus);
  assert.ok(estados.length > 0, "enum vazio — import do Prisma quebrou");

  for (const estado of estados) {
    const rotulo = INTERNAL_STATUS_LABELS[estado];
    assert.equal(typeof rotulo, "string", `${estado}: rotulo ausente`);
    assert.notEqual(rotulo.trim(), "", `${estado}: rotulo vazio`);
    // Um rotulo igual ao proprio nome do enum e placeholder disfarcado: passa no
    // typecheck e entrega "AGUARDANDO_CAPTCHA" cru para quem le a tela.
    assert.notEqual(rotulo, estado, `${estado}: rotulo e o proprio nome do enum`);
    assert.doesNotMatch(rotulo, /TODO|FIXME|placeholder|\bXXX\b/i, `${estado}: placeholder`);
  }
});

test("os dois estados da Fase 2 existem no enum", () => {
  for (const estado of NOVOS_ESTADOS) {
    assert.ok(estado in InternalStatus, `${estado} ausente do enum`);
  }
});

test("estados adiados NAO foram adicionados", () => {
  // docs/44 §6: `AGUARDANDO_PAGAMENTO_GRU` colide com `ManualExecutionStatus` e
  // `EXCECAO_BAIXA_CONFIANCA` provavelmente e motivo, nao estado. Ambos exigem
  // decisao propria — este teste falha se alguem os adicionar de carona.
  assert.ok(!("AGUARDANDO_PAGAMENTO_GRU" in InternalStatus));
  assert.ok(!("EXCECAO_BAIXA_CONFIANCA" in InternalStatus));
});

test("rotulos dos estados novos", () => {
  assert.equal(
    INTERNAL_STATUS_LABELS.AGUARDANDO_CONFIRMACAO_HUMANA,
    "Aguardando confirmacao humana",
  );
  assert.equal(INTERNAL_STATUS_LABELS.AGUARDANDO_CAPTCHA, "Aguardando validacao humana");
});

test("o rotulo do captcha nao promete resolucao automatica", () => {
  const rotulo = INTERNAL_STATUS_LABELS.AGUARDANDO_CAPTCHA;
  // Nao nomeia o mecanismo nem sugere que o sistema o resolve.
  assert.doesNotMatch(rotulo, /captcha/i, "rotulo nao deve nomear o mecanismo");
  assert.doesNotMatch(rotulo, /resolv|automat|bypass|burl/i, "rotulo nao deve sugerir bypass");
  assert.match(rotulo, /human/i, "rotulo deve deixar claro que espera uma pessoa");
});

test("estados novos ainda NAO sao usados por nenhum fluxo", () => {
  const fluxos = [...arquivosDeFluxo("src/server/services"), ...arquivosDeFluxo("src/app")];
  assert.ok(fluxos.length > 0, "varredura nao encontrou arquivo — caminho errado");

  for (const caminho of fluxos) {
    const code = codeOnly(readFileSync(caminho, "utf8"));
    for (const estado of NOVOS_ESTADOS) {
      assert.ok(
        !code.includes(estado),
        `${caminho} usa ${estado} — este PR adiciona capacidade, nao comportamento`,
      );
    }
  }
});

test("estados novos nao aparecem em workers, repositorios nem automacao", () => {
  const outros = [
    ...arquivosDeFluxo("src/server/workers"),
    ...arquivosDeFluxo("src/server/repositories"),
    ...arquivosDeFluxo("src/server/automation"),
  ];

  for (const caminho of outros) {
    const code = codeOnly(readFileSync(caminho, "utf8"));
    for (const estado of NOVOS_ESTADOS) {
      assert.ok(!code.includes(estado), `${caminho} usa ${estado}`);
    }
  }
});
