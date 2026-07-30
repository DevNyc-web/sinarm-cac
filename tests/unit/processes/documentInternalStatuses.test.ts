/**
 * `DOCUMENTO_RECEBIDO_PARA_ANALISE` / `DOCUMENTO_VALIDADO` — candidatos
 * aprovados pela Fase 5d (`docs/47-decisao-estados-workflow-humano.md`) no
 * enum `InternalStatus`, adicionados pela migration
 * `20260731010000_add_document_internal_statuses`.
 *
 * ATUALIZADO na Fase 5e (docs/47 §6.1): `uploadProcessDocument` passou a
 * escrever `DOCUMENTO_RECEBIDO_PARA_ANALISE` pela porta canonica. Os dois
 * estados NAO tem mais o mesmo status:
 *
 *  - `DOCUMENTO_RECEBIDO_PARA_ANALISE` — MIGRADO. Tem consumidor real
 *    (`uploadProcessDocument`), e a combinacao com `DOCUMENTO_ENVIADO` e
 *    "none" no diagnostico da 5c.
 *  - `DOCUMENTO_VALIDADO` — AINDA SEM CONSUMIDOR. Fica para a Fase 5f (lado
 *    aprovacao de `reviewProcessDocument`); continua `needs_decision`.
 *
 * O que estes testes protegem, mesmo espirito de `internalStatusStates.test.ts`
 * (Fase 2):
 *
 * 1. Os dois valores existem no enum e tem rotulo util (nao vazio, nao
 *    placeholder, nao o proprio nome cru).
 * 2. `DOCUMENTO_RECEBIDO_PARA_ANALISE` tem EXATAMENTE um consumidor
 *    (`uploadProcessDocument`, via `transitionInternalStatus`); nenhum outro
 *    arquivo o escreve.
 * 3. `DOCUMENTO_VALIDADO` continua sem nenhum consumidor — se algum comecar a
 *    escreve-lo sem a migration de fluxo dedicada (Fase 5f, PR proprio), o
 *    teste falha.
 * 4. `reviewProcessDocument` e `updateProcessOperations` continuam nao
 *    migrados — nenhum dos dois estados aparece neles.
 * 5. Os rotulos nunca alimentam tela do cliente — `internalStatus` nao e fonte
 *    visual (docs/45); os rotulos existem so para admin/diagnostico tecnico.
 * 6. O diagnostico da Fase 5c (`statusDivergence.ts`) reflete a divergencia:
 *    `DOCUMENTO_RECEBIDO_PARA_ANALISE` + `DOCUMENTO_ENVIADO` e `none`;
 *    `DOCUMENTO_VALIDADO` continua `needs_decision`, nunca `none`.
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
const MIGRADO = "DOCUMENTO_RECEBIDO_PARA_ANALISE" as const;
const NAO_MIGRADO = "DOCUMENTO_VALIDADO" as const;

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

// ------------------------------------------- 2. DOCUMENTO_RECEBIDO_PARA_ANALISE (migrado)

test("DOCUMENTO_RECEBIDO_PARA_ANALISE tem EXATAMENTE um consumidor: uploadProcessDocument", () => {
  const fluxos = [...arquivosDeFluxo("src/server/services"), ...arquivosDeFluxo("src/app")];
  assert.ok(fluxos.length > 0, "varredura nao encontrou arquivo — caminho errado");

  const consumidores = fluxos
    .filter((caminho) => codeOnly(readFileSync(caminho, "utf8")).includes(MIGRADO))
    .map((c) => c.split("\\").join("/"));

  assert.deepEqual(
    consumidores,
    ["src/server/services/uploadProcessDocument.ts"],
    "DOCUMENTO_RECEBIDO_PARA_ANALISE deveria aparecer so em uploadProcessDocument.ts (Fase 5e)",
  );
});

test("uploadProcessDocument usa a porta canonica, com o novo estado e alsoSet", () => {
  const code = codeOnly(readFileSync("src/server/services/uploadProcessDocument.ts", "utf8"));
  assert.match(code, /\btransitionInternalStatus\s*\(/, "deveria chamar transitionInternalStatus");
  assert.match(code, /toStatus:\s*"DOCUMENTO_RECEBIDO_PARA_ANALISE"/);
  assert.match(
    code,
    /alsoSet:\s*\{\s*operationalStatus:\s*"DOCUMENTO_ENVIADO"\s*\}/,
    "operationalStatus deveria continuar indo para DOCUMENTO_ENVIADO, via alsoSet",
  );
  // Nao pode mais escrever operationalStatus fora do alsoSet (updateProcessOperations
  // direto seria o write solto que a Fase 5e removeu).
  assert.doesNotMatch(code, /updateProcessOperations\s*\(/);
});

// ------------------------------------------------- 3. DOCUMENTO_VALIDADO (nao migrado)

test("DOCUMENTO_VALIDADO continua sem nenhum consumidor", () => {
  const fluxos = [...arquivosDeFluxo("src/server/services"), ...arquivosDeFluxo("src/app")];
  for (const caminho of fluxos) {
    const code = codeOnly(readFileSync(caminho, "utf8"));
    assert.ok(
      !code.includes(NAO_MIGRADO),
      `${caminho} usa ${NAO_MIGRADO} — Fase 5d aprovou a direcao, a Fase 5f (PR proprio) ainda nao migrou`,
    );
  }
});

test("os dois estados nao aparecem em workers, repositorios nem automacao", () => {
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

test("reviewProcessDocument e updateProcessOperations continuam nao migrados", () => {
  // reviewProcessDocument: nenhum dos dois estados novos, e ainda nao chama a
  // porta canonica (Fase 5f, fora do escopo desta fase).
  // updateProcessOperations: mesma coisa (Fase 5g).
  for (const arquivo of [
    "src/server/services/reviewProcessDocument.ts",
    "src/server/services/updateProcessOperations.ts",
  ]) {
    const code = codeOnly(readFileSync(arquivo, "utf8"));
    for (const estado of NOVOS_ESTADOS) {
      assert.ok(!code.includes(estado), `${arquivo} usa ${estado} — migracao de fluxo nao aprovada aqui`);
    }
    assert.doesNotMatch(
      code,
      /\btransitionInternalStatus\s*\(/,
      `${arquivo} nao deveria chamar a porta canonica ainda`,
    );
  }
});

test("transitionInternalStatus tem exatamente 2 chamadores reais: confirmPixPayment e uploadProcessDocument", () => {
  // A porta canonica tinha 1 chamador (docs/46 §5); a Fase 5e soma o segundo.
  // Nenhum outro arquivo deveria importa-la por causa desta migration.
  const chamadores = [
    ...arquivosDeFluxo("src/server/services"),
    ...arquivosDeFluxo("src/app"),
  ].filter((caminho) => {
    const code = codeOnly(readFileSync(caminho, "utf8"));
    return /\btransitionInternalStatus\s*\(/.test(code);
  });
  const relativos = chamadores.map((c) => c.split("\\").join("/")).sort();
  assert.deepEqual(
    relativos.filter((c) => !c.endsWith("transitionInternalStatus.ts")),
    ["src/server/services/confirmPixPayment.ts", "src/server/services/uploadProcessDocument.ts"],
    "os chamadores reais de transitionInternalStatus mudaram",
  );
});

// -------------------------------------------- 4. nunca fonte visual do cliente

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

// -------------------------------------- 5. diagnostico da 5c reflete a divergencia

test("DOCUMENTO_RECEBIDO_PARA_ANALISE + DOCUMENTO_ENVIADO: none — combinacao migrada (Fase 5e)", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: MIGRADO,
    operationalStatus: "DOCUMENTO_ENVIADO",
  });
  assert.equal(result.hasDivergence, false);
  assert.equal(result.severity, "none");
  assert.equal(result.expectedOperationalStatus, "DOCUMENTO_ENVIADO");
});

test("DOCUMENTO_RECEBIDO_PARA_ANALISE com operationalStatus DIFERENTE de DOCUMENTO_ENVIADO ainda diverge", () => {
  // Migrado nao significa "sempre none" — so a combinacao ESPERADA e segura.
  // Qualquer outra continua sinalizando divergencia real.
  const operacionais = [
    "RASCUNHO",
    "DOCUMENTO_APROVADO",
    "AGUARDANDO_PAGAMENTO",
    "PAGO_EM_FILA",
    "EM_REVISAO_OPERACIONAL",
    "PRONTO_PARA_PROTOCOLO_MANUAL",
    "BLOQUEADO",
    "CANCELADO_DEV",
  ] as const;
  for (const operationalStatus of operacionais) {
    const result = diagnoseStatusDivergence({ internalStatus: MIGRADO, operationalStatus });
    assert.notEqual(result.severity, "none", `${MIGRADO} + ${operationalStatus}`);
    assert.equal(result.hasDivergence, true, `${MIGRADO} + ${operationalStatus}`);
  }
});

test("DOCUMENTO_VALIDADO continua needs_decision, nunca none — Fase 5f nao migrou", () => {
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

  for (const operationalStatus of operacionais) {
    const result = diagnoseStatusDivergence({ internalStatus: NAO_MIGRADO, operationalStatus });
    assert.equal(
      result.severity,
      "needs_decision",
      `${NAO_MIGRADO} + ${operationalStatus} deveria ser needs_decision (candidato aprovado, sem consumidor)`,
    );
    assert.equal(result.hasDivergence, true, `${NAO_MIGRADO} + ${operationalStatus}`);
  }
});

test("o candidato aprovado por docs/47 aparece em expectedOperationalStatus mesmo para DOCUMENTO_VALIDADO", () => {
  // Diferenca do caso "sem candidato documentado" (docs/46 §6): aqui HA
  // candidato aprovado — mas aprovar a direcao nao e o mesmo que migrar o
  // fluxo. severity so vira `none` quando existir write real produzindo a
  // combinacao (Fase 5f), nao so porque o enum tem o valor.
  const validado = diagnoseStatusDivergence({
    internalStatus: NAO_MIGRADO,
    operationalStatus: "DOCUMENTO_APROVADO",
  });
  assert.equal(validado.expectedOperationalStatus, "DOCUMENTO_APROVADO");
  assert.equal(validado.severity, "needs_decision");
});

test("a razao de DOCUMENTO_VALIDADO cita docs/47 e a Fase 5f pendente", () => {
  const validado = diagnoseStatusDivergence({
    internalStatus: NAO_MIGRADO,
    operationalStatus: "RASCUNHO",
  });
  assert.match(validado.reason, /docs\/47/);
  assert.match(validado.reason, /5f/);
});
