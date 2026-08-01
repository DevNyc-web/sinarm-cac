/**
 * InternalStatus — estados adicionados ao enum SEM consumidor.
 *
 * Cobre os da Fase 2 (`AGUARDANDO_CONFIRMACAO_HUMANA`, `AGUARDANDO_CAPTCHA`,
 * docs/44 §6) e `BLOQUEADO_OPERACIONAL` (docs/48), que seguem o mesmo padrao:
 * o PR adiciona capacidade ao enum, nao comportamento. Os estados da Fase 5d
 * ja tem consumidor real e sao cobertos por `documentInternalStatuses.test.ts`.
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

/** docs/48 — decidido, migrado no enum, mas ainda sem nenhum fluxo escrevendo. */
const BLOQUEIO_HUMANO = "BLOQUEADO_OPERACIONAL" as const;

/** Todos os que este arquivo cobre: enum sim, consumidor nao. */
const SEM_CONSUMIDOR = [...NOVOS_ESTADOS, BLOQUEIO_HUMANO] as const;

const MIGRATION_BLOQUEIO =
  "prisma/migrations/20260801000000_add_blocked_operational_status/migration.sql";

/** Remove comentarios `--`: aviso em comentario nao e instrucao SQL. */
function sqlOnly(source: string): string {
  return source
    .split("\n")
    .filter((linha) => !linha.trimStart().startsWith("--"))
    .join("\n");
}

/** Remove comentarios: mencao em comentario e documentacao, nao uso. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * `includes` cru NAO serve para estes nomes: `BLOQUEADO_OPERACIONAL`
 * (`InternalStatus`, docs/48) e PREFIXO de `BLOQUEADO_OPERACIONALMENTE`
 * (`ManualExecutionStatus`, Fase 7), entao `manualExecution.ts` acusaria uso de
 * um estado que ele nao conhece. Exigir limite dos dois lados distingue os
 * dois enums — e pega tambem qualquer futuro nome que estenda um destes.
 */
function usaEstado(code: string, estado: string): boolean {
  return new RegExp(`(?<![A-Z0-9_])${estado}(?![A-Z0-9_])`).test(code);
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
    for (const estado of SEM_CONSUMIDOR) {
      assert.ok(
        !usaEstado(code, estado),
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
    for (const estado of SEM_CONSUMIDOR) {
      assert.ok(!usaEstado(code, estado), `${caminho} usa ${estado}`);
    }
  }
});

// ------------------------------------------- BLOQUEADO_OPERACIONAL (docs/48)

test("BLOQUEADO_OPERACIONAL existe no enum e tem rotulo proprio", () => {
  assert.ok(BLOQUEIO_HUMANO in InternalStatus, "BLOQUEADO_OPERACIONAL ausente do enum");
  assert.equal(INTERNAL_STATUS_LABELS.BLOQUEADO_OPERACIONAL, "Bloqueado");
});

test("o rotulo distingue das duas fontes de confusao vizinhas", () => {
  const rotulo = INTERNAL_STATUS_LABELS.BLOQUEADO_OPERACIONAL;
  // `BLOQUEADO_INSTABILIDADE` esta na MESMA lista e e pausa da automacao;
  // `ManualExecutionStatus.BLOQUEADO_OPERACIONALMENTE` esta em outra e descreve
  // trabalho manual da equipe fora do app. Rotulo igual a qualquer um dos dois
  // faria o diagnostico do admin mentir por ambiguidade.
  assert.notEqual(rotulo, INTERNAL_STATUS_LABELS.BLOQUEADO_INSTABILIDADE);
  assert.notEqual(rotulo, "Bloqueado operacionalmente");
  assert.doesNotMatch(rotulo, /instabilidade/i, "nao e pausa por instabilidade do portal");
});

test("BLOQUEADO_OPERACIONAL nao e escrito por reviewProcessDocument — rejeicao continua legada", () => {
  const code = codeOnly(readFileSync("src/server/services/reviewProcessDocument.ts", "utf8"));
  assert.ok(!usaEstado(code, BLOQUEIO_HUMANO),"a Fase 5f (lado rejeicao) nao e este PR");
  // O caminho legado tem que continuar exatamente onde estava.
  assert.match(
    code,
    /updateProcessOperations\s*\(\s*document\.processId,\s*\{\s*operationalStatus:\s*"BLOQUEADO"/,
    "rejeicao deveria continuar escrevendo BLOQUEADO direto, sem porta canonica",
  );
});

test("BLOQUEADO_OPERACIONAL nao e escrito por updateProcessOperations — dropdown continua legado", () => {
  const code = codeOnly(readFileSync("src/server/services/updateProcessOperations.ts", "utf8"));
  assert.ok(!usaEstado(code, BLOQUEIO_HUMANO),"a Fase 5g de BLOQUEADO nao e este PR");
  // Os 3 migrados na 5g continuam sendo os unicos com porta canonica; BLOQUEADO
  // nao ganhou bloco proprio de carona.
  assert.doesNotMatch(code, /toStatus:\s*"BLOQUEADO/);
});

test("nenhum estado de excecao AUTOMATICA foi reusado para o bloqueio humano", () => {
  // A regra 2 (docs/46 §3.4, docs/48 §9): reusar um destes afirmaria causa que
  // ninguem apurou. Vale para os dois writers de BLOQUEADO.
  const proibidos = [
    "BLOQUEADO_INSTABILIDADE",
    "EXCECAO_DOC_INVALIDO",
    "EXCECAO_ARMA_DIVERGENTE",
    "EXCECAO_DESTINO_INCOMPLETO",
  ];
  for (const file of [
    "src/server/services/reviewProcessDocument.ts",
    "src/server/services/updateProcessOperations.ts",
  ]) {
    const code = codeOnly(readFileSync(file, "utf8"));
    for (const estado of proibidos) {
      assert.ok(!code.includes(estado), `${file} usa ${estado}`);
    }
  }
});

test("a migration de BLOQUEADO_OPERACIONAL e aditiva e nao faz backfill", () => {
  const sql = readFileSync(MIGRATION_BLOQUEIO, "utf8");
  const instrucoes = sqlOnly(sql);

  assert.match(
    instrucoes,
    /ALTER TYPE "internal_status" ADD VALUE IF NOT EXISTS 'BLOQUEADO_OPERACIONAL';/,
    "a instrucao precisa ser idempotente",
  );
  // Uma unica instrucao SQL: nada mais entra de carona.
  assert.equal(
    instrucoes.split(";").filter((parte) => parte.trim().length > 0).length,
    1,
    "a migration deveria ter exatamente uma instrucao",
  );
  for (const proibido of [/\bUPDATE\b/i, /\bINSERT\b/i, /\bDELETE\b/i, /\bDROP\b/i, /\bALTER TABLE\b/i]) {
    assert.doesNotMatch(instrucoes, proibido, `migration aditiva nao deveria conter ${proibido}`);
  }
  // A tabela Process nao e tocada — nem o default de internalStatus.
  assert.doesNotMatch(instrucoes, /processes/i);
  assert.doesNotMatch(instrucoes, /operational_status/i);
});

test("a migration avisa sobre db:push e sobre a ausencia de backfill", () => {
  const sql = readFileSync(MIGRATION_BLOQUEIO, "utf8");
  assert.match(sql, /db push|db:push/, "o aviso precisa estar onde alguem le");
  assert.match(sql, /db:migrate|db:deploy/, "aponta o caminho correto");
  assert.match(sql, /SEM BACKFILL/);
  assert.match(sql, /docs\/48/);
});
