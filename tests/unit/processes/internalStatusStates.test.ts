/**
 * InternalStatus — estados adicionados ao enum SEM consumidor (Fase 2) e dois
 * que ja ganharam consumidor depois: `BLOQUEADO_OPERACIONAL` (docs/48) e
 * `CANCELADO_OPERACIONAL` (docs/51 — `cancelProcess`). Os tres seguem o mesmo
 * padrao de origem: o PR que criou o enum adicionou capacidade, nao
 * comportamento; o comportamento veio depois, em PR proprio. Os estados da
 * Fase 5d ja tem consumidor real e sao cobertos por
 * `documentInternalStatuses.test.ts`.
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

/** docs/48 — ja TEM consumidor: a rejeicao de `reviewProcessDocument`. */
const BLOQUEIO_HUMANO = "BLOQUEADO_OPERACIONAL" as const;

/** docs/51 — ja TEM consumidor: `cancelProcess`. */
const CANCELAMENTO_REAL = "CANCELADO_OPERACIONAL" as const;

/**
 * Os que este arquivo cobre como "enum sim, consumidor nao" — hoje so os da
 * Fase 2. `BLOQUEADO_OPERACIONAL` saiu desta lista quando a rejeicao migrou
 * (docs/48); `CANCELADO_OPERACIONAL` saiu quando `cancelProcess` chegou
 * (docs/51). O que sobra deles aqui e a trava de que NENHUM outro fluxo os
 * escreve, logo abaixo.
 */
const SEM_CONSUMIDOR = NOVOS_ESTADOS;

const MIGRATION_BLOQUEIO =
  "prisma/migrations/20260801000000_add_blocked_operational_status/migration.sql";

const MIGRATION_CANCELAMENTO =
  "prisma/migrations/20260802000000_add_real_cancellation_status/migration.sql";

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

test("BLOQUEADO_OPERACIONAL aparece em EXATAMENTE tres arquivos: os dois writers + uma allowlist", () => {
  // Os dois caminhos que produzem `operationalStatus = BLOQUEADO` (docs/46
  // §3.4 e §3.5) usam a MESMA categoria canonica — e mais ninguem a ESCREVE.
  //
  // `cancelProcess` (docs/51) NAO escreve este valor — so o CITA como chave
  // `true` de um `Record<InternalStatus, boolean>` exaustivo (allowlist de
  // estados cancelaveis: um processo bloqueado operacionalmente pode ser
  // cancelado de verdade). E MENCAO, nao escrita: nunca aparece como
  // `toStatus` de `transitionInternalStatus` neste arquivo.
  const fluxos = [...arquivosDeFluxo("src/server/services"), ...arquivosDeFluxo("src/app")];
  assert.ok(fluxos.length > 0, "varredura nao encontrou arquivo — caminho errado");

  const consumidores = fluxos
    .filter((caminho) => usaEstado(codeOnly(readFileSync(caminho, "utf8")), BLOQUEIO_HUMANO))
    .map((c) => c.split("\\").join("/"))
    .sort();

  assert.deepEqual(consumidores, [
    "src/server/services/cancelProcess.ts",
    "src/server/services/reviewProcessDocument.ts",
    "src/server/services/updateProcessOperations.ts",
  ]);
});

test("os dois consumidores usam a porta canonica, nunca uma excecao AUTOMATICA", () => {
  for (const file of [
    "src/server/services/reviewProcessDocument.ts",
    "src/server/services/updateProcessOperations.ts",
  ]) {
    const code = codeOnly(readFileSync(file, "utf8"));
    assert.match(code, /toStatus:\s*"BLOQUEADO_OPERACIONAL"/, `${file} deveria usar a categoria propria`);
    for (const proibido of [
      "BLOQUEADO_INSTABILIDADE",
      "EXCECAO_DOC_INVALIDO",
      "EXCECAO_ARMA_DIVERGENTE",
      "EXCECAO_DESTINO_INCOMPLETO",
    ]) {
      assert.ok(!code.includes(proibido), `${file} usa ${proibido}`);
    }
  }
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

// ------------------------------------------- CANCELADO_OPERACIONAL (docs/51)

test("CANCELADO_OPERACIONAL existe no enum e tem rotulo proprio", () => {
  assert.ok(CANCELAMENTO_REAL in InternalStatus, "CANCELADO_OPERACIONAL ausente do enum");
  assert.equal(INTERNAL_STATUS_LABELS.CANCELADO_OPERACIONAL, "Cancelado (operacional)");
});

test("o rotulo distingue de CANCELADO_DEV e de CANCELADO_REEMBOLSADO", () => {
  const rotulo = INTERNAL_STATUS_LABELS.CANCELADO_OPERACIONAL;
  // `CANCELADO_REEMBOLSADO` esta na MESMA lista (InternalStatus) e AFIRMA
  // reembolso — docs/51 decidiu que cancelamento real generico nao reusa esse
  // rotulo nem esse valor.
  assert.notEqual(rotulo, INTERNAL_STATUS_LABELS.CANCELADO_REEMBOLSADO);
  // `OperationalStatus.CANCELADO_DEV` ("Cancelado (dev)") e outro enum, mas o
  // rotulo nao pode ficar identico ao ponto de confundir tela de diagnostico.
  assert.notEqual(rotulo, "Cancelado (dev)");
  assert.doesNotMatch(rotulo, /reembols/i, "nao afirma reembolso — isso e decisao futura, docs/51 §4 item 11");
});

test("CANCELADO_OPERACIONAL aparece EXATAMENTE em quatro arquivos: um escritor + tres leituras (docs/52)", () => {
  // `cancelProcess` (docs/51) continua o UNICO escritor — nenhuma UI escreve
  // o valor, so o LE para exibir (docs/52, visualizacao admin read-only):
  //  - o detalhe admin mostra um callout quando internalStatus bate;
  //  - a fila admin (pagina + `getAdminQueue.ts`) mostra um rotulo por linha.
  // Nenhum dos tres cria form/botao/action nova — testes proprios abaixo e em
  // `adminRealCancellationView.test.ts` provam isso.
  const fluxos = [...arquivosDeFluxo("src/server/services"), ...arquivosDeFluxo("src/app")];
  assert.ok(fluxos.length > 0, "varredura nao encontrou arquivo — caminho errado");

  const consumidores = fluxos
    .filter((caminho) => usaEstado(codeOnly(readFileSync(caminho, "utf8")), CANCELAMENTO_REAL))
    .map((c) => c.split("\\").join("/"))
    .sort();

  assert.deepEqual(consumidores, [
    "src/app/(admin)/admin/processos/[id]/page.tsx",
    "src/app/(admin)/admin/processos/page.tsx",
    "src/server/services/cancelProcess.ts",
    "src/server/services/getAdminQueue.ts",
  ]);
});

test("cancelProcess usa a porta canonica para CANCELADO_OPERACIONAL, sem alsoSet", () => {
  const code = codeOnly(readFileSync("src/server/services/cancelProcess.ts", "utf8"));
  assert.match(code, /\btransitionInternalStatus\s*\(/, "deveria chamar transitionInternalStatus");
  assert.match(code, /toStatus:\s*"CANCELADO_OPERACIONAL"/);
  // docs/51: operationalStatus fica de fora de proposito — sem candidato
  // documentado, `alsoSet` aqui inventaria uma equivalencia que ninguem
  // decidiu (ver operationalProjectionEquivalence.test.ts).
  assert.doesNotMatch(code, /alsoSet\s*:/);
  assert.doesNotMatch(code, /updateProcessOperations\s*\(/);
});

test("a migration de CANCELADO_OPERACIONAL e aditiva e nao faz backfill", () => {
  const sql = readFileSync(MIGRATION_CANCELAMENTO, "utf8");
  const instrucoes = sqlOnly(sql);

  assert.match(
    instrucoes,
    /ALTER TYPE "internal_status" ADD VALUE IF NOT EXISTS 'CANCELADO_OPERACIONAL';/,
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

test("a migration de CANCELADO_OPERACIONAL avisa sobre db:push e sobre a ausencia de backfill", () => {
  const sql = readFileSync(MIGRATION_CANCELAMENTO, "utf8");
  assert.match(sql, /db push|db:push/, "o aviso precisa estar onde alguem le");
  assert.match(sql, /db:migrate|db:deploy/, "aponta o caminho correto");
  assert.match(sql, /SEM BACKFILL/);
  assert.match(sql, /docs\/51/);
});
