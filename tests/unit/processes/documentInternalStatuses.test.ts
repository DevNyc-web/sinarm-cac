/**
 * `DOCUMENTO_RECEBIDO_PARA_ANALISE` / `DOCUMENTO_VALIDADO` — candidatos
 * aprovados pela Fase 5d (`docs/47-decisao-estados-workflow-humano.md`) no
 * enum `InternalStatus`, adicionados pela migration
 * `20260731010000_add_document_internal_statuses`.
 *
 * O que estes testes protegem — mesmo espirito de `internalStatusStates.test.ts`
 * (Fase 2), aplicado aos dois estados desta fase:
 *
 * 1. Os dois valores existem no enum e tem rotulo util (nao vazio, nao
 *    placeholder, nao o proprio nome cru).
 * 2. `docs/47` aprovou a DIRECAO, nao migrou o fluxo: nenhum service ainda
 *    escreve estes valores. Se algum comecar a escreve-los sem migration de
 *    fluxo dedicada (Fase 5e/5f, PR proprio), o teste falha.
 * 3. Os rotulos nunca alimentam tela do cliente — `internalStatus` nao e fonte
 *    visual (docs/45); os rotulos existem so para admin/diagnostico tecnico.
 * 4. O diagnostico da Fase 5c (`statusDivergence.ts`) trata os dois de forma
 *    conservadora: `needs_decision`, nunca `none`, mesmo pareados com o
 *    `operationalStatus` que `docs/47` aprovou como candidato.
 *
 * Sem banco, sem rede: le o enum gerado pelo Prisma e os arquivos de fonte.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { InternalStatus } from "@prisma/client";

import { INTERNAL_STATUS_LABELS } from "../../../src/server/processes/statusLabels";
import { diagnoseStatusDivergence } from "../../../src/server/processes/statusDivergence";

const NOVOS_ESTADOS = ["DOCUMENTO_RECEBIDO_PARA_ANALISE", "DOCUMENTO_VALIDADO"] as const;

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

// -------------------------------------------------------- 1. enum e rotulos

test("os dois estados aprovados pela Fase 5d existem no enum", () => {
  for (const estado of NOVOS_ESTADOS) {
    assert.ok(estado in InternalStatus, `${estado} ausente do enum`);
  }
});

test("rotulos dos estados novos: nao vazio, nao placeholder, nao o nome cru", () => {
  for (const estado of NOVOS_ESTADOS) {
    const rotulo = INTERNAL_STATUS_LABELS[estado];
    assert.equal(typeof rotulo, "string", `${estado}: rotulo ausente`);
    assert.notEqual(rotulo.trim(), "", `${estado}: rotulo vazio`);
    assert.notEqual(rotulo, estado, `${estado}: rotulo e o proprio nome do enum`);
    assert.doesNotMatch(rotulo, /TODO|FIXME|placeholder|\bXXX\b/i, `${estado}: placeholder`);
  }
});

test("rotulos exatos aprovados por docs/47", () => {
  assert.equal(
    INTERNAL_STATUS_LABELS.DOCUMENTO_RECEBIDO_PARA_ANALISE,
    "Documento recebido para analise",
  );
  assert.equal(INTERNAL_STATUS_LABELS.DOCUMENTO_VALIDADO, "Documento validado");
});

test("todo InternalStatus continua com rotulo apos a migration (Record exaustivo)", () => {
  // O compilador ja garante isto (INTERNAL_STATUS_LABELS e
  // Record<InternalStatus, string>) — este teste prova em runtime que o enum
  // gerado pelo Prisma bate com o Record, sem depender so do typecheck.
  const estados = Object.values(InternalStatus);
  assert.ok(estados.length >= 19, `enum com ${estados.length} valores — esperado >= 19`);
  for (const estado of estados) {
    assert.equal(typeof INTERNAL_STATUS_LABELS[estado], "string", `${estado}: sem rotulo`);
  }
});

// ---------------------------------------------- 2. sem consumidor real ainda

test("estados novos ainda NAO sao usados por nenhum fluxo", () => {
  const fluxos = [...arquivosDeFluxo("src/server/services"), ...arquivosDeFluxo("src/app")];
  assert.ok(fluxos.length > 0, "varredura nao encontrou arquivo — caminho errado");

  for (const caminho of fluxos) {
    const code = codeOnly(readFileSync(caminho, "utf8"));
    for (const estado of NOVOS_ESTADOS) {
      assert.ok(
        !code.includes(estado),
        `${caminho} usa ${estado} — Fase 5d aprovou a direcao, nao migrou o fluxo (5e/5f ficam para PR proprio)`,
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

test("uploadProcessDocument e reviewProcessDocument nao foram migrados", () => {
  // Chamada explicita dos dois arquivos que a Fase 5e/5f vao migrar — a
  // varredura acima ja cobre, mas o pedido desta fase nomeia os dois services
  // por extenso, entao o teste fica explicito tambem.
  for (const arquivo of [
    "src/server/services/uploadProcessDocument.ts",
    "src/server/services/reviewProcessDocument.ts",
  ]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    for (const estado of NOVOS_ESTADOS) {
      assert.ok(!code.includes(estado), `${arquivo} usa ${estado} — migracao de fluxo nao aprovada aqui`);
    }
    assert.doesNotMatch(code, /transitionInternalStatus/, `${arquivo} nao deveria chamar a porta canonica`);
  }
});

test("transitionInternalStatus nao ganhou novo chamador", () => {
  // A porta canonica continua com o mesmo unico chamador real (docs/46 §5):
  // confirmPixPayment. Nenhum arquivo novo deveria importa-la por causa desta
  // migration — ela so adiciona capacidade ao enum, nao muda quem escreve.
  const chamadores = [
    ...arquivosDeFluxo("src/server/services"),
    ...arquivosDeFluxo("src/app"),
  ].filter((caminho) => {
    const code = codeOnly(readFileSync(caminho, "utf8"));
    return /\btransitionInternalStatus\s*\(/.test(code);
  });
  const relativos = chamadores.map((c) => c.split("\\").join("/"));
  assert.deepEqual(
    relativos.filter((c) => !c.endsWith("transitionInternalStatus.ts")),
    ["src/server/services/confirmPixPayment.ts"],
    "chamador real de transitionInternalStatus mudou — deveria continuar sendo so confirmPixPayment",
  );
});

// -------------------------------------------- 3. nunca fonte visual do cliente

test("rotulos dos estados novos nao aparecem em nenhuma tela do cliente", () => {
  const telasCliente = arquivosDeFluxo("src/app/(user)");
  assert.ok(telasCliente.length > 0, "varredura nao encontrou tela do cliente — caminho errado");

  for (const caminho of telasCliente) {
    const code = codeOnly(readFileSync(caminho, "utf8"));
    assert.doesNotMatch(
      code,
      /INTERNAL_STATUS_LABELS/,
      `${caminho} nao deveria ler INTERNAL_STATUS_LABELS — internalStatus nao e fonte visual (docs/45)`,
    );
    for (const estado of NOVOS_ESTADOS) {
      assert.ok(!code.includes(estado), `${caminho} menciona ${estado}`);
    }
  }
});

// -------------------------------------- 4. diagnostico da 5c trata como needs_decision

test("diagnoseStatusDivergence trata os dois estados como needs_decision, nunca none", () => {
  const operacionais = [
    "RASCUNHO",
    "DOCUMENTO_ENVIADO",
    "DOCUMENTO_APROVADO",
    "AGUARDANDO_PAGAMENTO",
    "PAGO_EM_FILA",
    "EM_REVISAO_OPERACIONAL",
    "PRONTO_PARA_PROTOCOLO_MANUAL",
    "BLOQUEADO",
    "CANCELADO_DEV",
  ] as const;

  for (const internalStatus of NOVOS_ESTADOS) {
    for (const operationalStatus of operacionais) {
      const result = diagnoseStatusDivergence({ internalStatus, operationalStatus });
      assert.equal(
        result.severity,
        "needs_decision",
        `${internalStatus} + ${operationalStatus} deveria ser needs_decision (candidato aprovado, sem consumidor)`,
      );
      assert.equal(result.hasDivergence, true, `${internalStatus} + ${operationalStatus}`);
    }
  }
});

test("o candidato aprovado por docs/47 aparece em expectedOperationalStatus, mas severity continua needs_decision", () => {
  // Diferenca do caso "sem candidato documentado" (docs/46 §6): aqui HA
  // candidato aprovado — mas aprovar a direcao nao e o mesmo que migrar o
  // fluxo. severity so vira `none` quando existir write real produzindo a
  // combinacao (Fase 5e/5f), nao so porque o enum tem o valor.
  const recebido = diagnoseStatusDivergence({
    internalStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE",
    operationalStatus: "DOCUMENTO_ENVIADO",
  });
  assert.equal(recebido.expectedOperationalStatus, "DOCUMENTO_ENVIADO");
  assert.equal(recebido.severity, "needs_decision");

  const validado = diagnoseStatusDivergence({
    internalStatus: "DOCUMENTO_VALIDADO",
    operationalStatus: "DOCUMENTO_APROVADO",
  });
  assert.equal(validado.expectedOperationalStatus, "DOCUMENTO_APROVADO");
  assert.equal(validado.severity, "needs_decision");
});

test("a razao cita docs/47 e a fase de migracao pendente", () => {
  const recebido = diagnoseStatusDivergence({
    internalStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE",
    operationalStatus: "RASCUNHO",
  });
  assert.match(recebido.reason, /docs\/47/);
  assert.match(recebido.reason, /5e/);

  const validado = diagnoseStatusDivergence({
    internalStatus: "DOCUMENTO_VALIDADO",
    operationalStatus: "RASCUNHO",
  });
  assert.match(validado.reason, /docs\/47/);
  assert.match(validado.reason, /5f/);
});
