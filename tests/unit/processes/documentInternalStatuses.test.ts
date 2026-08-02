/**
 * `DOCUMENTO_RECEBIDO_PARA_ANALISE` / `DOCUMENTO_VALIDADO` — candidatos
 * aprovados pela Fase 5d (`docs/47-decisao-estados-workflow-humano.md`) no
 * enum `InternalStatus`, adicionados pela migration
 * `20260731010000_add_document_internal_statuses`.
 *
 * ATUALIZADO na Fase 5f (docs/47 §6.2): o lado aprovacao de
 * `reviewProcessDocument` passou a escrever `DOCUMENTO_VALIDADO` pela porta
 * canonica — mesmo caminho que a Fase 5e ja tinha aberto para
 * `DOCUMENTO_RECEBIDO_PARA_ANALISE` (`uploadProcessDocument`). Os DOIS
 * estados estao MIGRADOS agora:
 *
 *  - `DOCUMENTO_RECEBIDO_PARA_ANALISE` — consumidor: `uploadProcessDocument`
 *    (Fase 5e). Par seguro com `DOCUMENTO_ENVIADO`.
 *  - `DOCUMENTO_VALIDADO` — consumidor: `reviewProcessDocument`, so o lado
 *    APROVACAO (Fase 5f). Par seguro com `DOCUMENTO_APROVADO`.
 *
 * O lado REJEICAO de `reviewProcessDocument` (→ `BLOQUEADO`) continua
 * LEGADO: `BLOQUEADO` exige decisao propria (docs/47 §6.5) antes de ganhar
 * porta canonica — mapear para `BLOQUEADO_INSTABILIDADE`/`EXCECAO_*` sem essa
 * decisao e PROIBIDO (docs/46 §3.4).
 *
 * O que estes testes protegem, mesmo espirito de `internalStatusStates.test.ts`
 * (Fase 2):
 *
 * 1. Os dois valores existem no enum e tem rotulo util (nao vazio, nao
 *    placeholder, nao o proprio nome cru).
 * 2. Cada um dos dois tem EXATAMENTE um consumidor real, e nenhum outro
 *    arquivo os escreve.
 * 3. O lado rejeicao de `reviewProcessDocument` continua sem usar nenhum dos
 *    dois estados, nem chamar a porta canonica. `updateProcessOperations`
 *    passou a chamar a porta canonica na Fase 5g (para RASCUNHO/
 *    AGUARDANDO_PAGAMENTO/PAGO_EM_FILA), mas continua sem usar nenhum dos
 *    DOIS estados desta fase — DOCUMENTO_ENVIADO/DOCUMENTO_APROVADO
 *    continuam legado ali, decisao explicita fora do escopo da 5g.
 * 4. Os rotulos nunca alimentam tela do cliente — `internalStatus` nao e fonte
 *    visual (docs/45); os rotulos existem so para admin/diagnostico tecnico.
 * 5. O diagnostico da Fase 5c (`statusDivergence.ts`) reflete os dois pares
 *    migrados como `none`; qualquer outra combinacao continua divergindo.
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
const RECEBIDO = "DOCUMENTO_RECEBIDO_PARA_ANALISE" as const;
const VALIDADO = "DOCUMENTO_VALIDADO" as const;

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

// ------------------------------------------------- 2. consumidor real de cada estado

test("DOCUMENTO_RECEBIDO_PARA_ANALISE aparece EXATAMENTE em tres arquivos: dois escritores + uma allowlist", () => {
  // `uploadProcessDocument` (Fase 5e) o produz pela primeira vez;
  // `reopenDocumentReview` (docs/50 §5) o produz de novo ao DESFAZER uma
  // revisao. Os dois chegam ao mesmo par seguro de proposito: reaberto e
  // recem-enviado devem ficar indistinguiveis.
  //
  // `cancelProcess` (docs/51) NAO escreve este valor — so o CITA como chave
  // de um `Record<InternalStatus, boolean>` exaustivo (allowlist de estados
  // cancelaveis). E MENCAO, nao escrita: nunca aparece como `toStatus` de
  // `transitionInternalStatus` neste arquivo (teste proprio abaixo prova
  // isso). A varredura por substring nao distingue os dois casos, por isso
  // ele entra aqui em vez de sumir da lista.
  const fluxos = [...arquivosDeFluxo("src/server/services"), ...arquivosDeFluxo("src/app")];
  assert.ok(fluxos.length > 0, "varredura nao encontrou arquivo — caminho errado");

  const consumidores = fluxos
    .filter((caminho) => codeOnly(readFileSync(caminho, "utf8")).includes(RECEBIDO))
    .map((c) => c.split("\\").join("/"))
    .sort();

  assert.deepEqual(consumidores, [
    "src/server/services/cancelProcess.ts",
    "src/server/services/reopenDocumentReview.ts",
    "src/server/services/uploadProcessDocument.ts",
  ]);
});

test("DOCUMENTO_VALIDADO aparece EXATAMENTE em tres arquivos: dois escritores + uma allowlist", () => {
  // `reviewProcessDocument` (Fase 5f, lado aprovacao) o produz pela primeira
  // vez; `approveDocumentOutOfFlow` (docs/50 §6) o produz de novo ao
  // REGISTRAR uma aprovacao feita fora do formulario. Os dois chegam ao mesmo
  // par seguro de proposito: aprovado pelo formulario e aprovado fora do fluxo
  // devem ficar indistinguiveis para a fila.
  //
  // `cancelProcess` (docs/51) NAO escreve este valor pelo mesmo motivo do
  // teste acima — so o cita como chave da allowlist de cancelamento.
  const fluxos = [...arquivosDeFluxo("src/server/services"), ...arquivosDeFluxo("src/app")];

  const consumidores = fluxos
    .filter((caminho) => codeOnly(readFileSync(caminho, "utf8")).includes(VALIDADO))
    .map((c) => c.split("\\").join("/"))
    .sort();

  assert.deepEqual(consumidores, [
    "src/server/services/approveDocumentOutOfFlow.ts",
    "src/server/services/cancelProcess.ts",
    "src/server/services/reviewProcessDocument.ts",
  ]);
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
  assert.doesNotMatch(code, /updateProcessOperations\s*\(/);
});

test("reviewProcessDocument usa a porta canonica no lado aprovacao, com alsoSet", () => {
  const code = codeOnly(readFileSync("src/server/services/reviewProcessDocument.ts", "utf8"));
  assert.match(code, /\btransitionInternalStatus\s*\(/, "deveria chamar transitionInternalStatus");
  assert.match(code, /toStatus:\s*"DOCUMENTO_VALIDADO"/);
  assert.match(
    code,
    /alsoSet:\s*\{\s*operationalStatus:\s*"DOCUMENTO_APROVADO"\s*\}/,
    "operationalStatus deveria continuar indo para DOCUMENTO_APROVADO, via alsoSet",
  );
  // O lado rejeicao tambem migrou (docs/48), entao a porta LEGADA nao pode mais
  // aparecer em ramo nenhum deste arquivo.
  assert.doesNotMatch(
    code,
    /updateProcessOperations\s*\(/,
    "nenhum ramo deveria mais escrever pela porta legada",
  );
});

test("o bloco de rejeicao usa a porta canonica, e nunca uma excecao AUTOMATICA", () => {
  const code = codeOnly(readFileSync("src/server/services/reviewProcessDocument.ts", "utf8"));
  const ancora = 'document.process.operationalStatus !== "CANCELADO_DEV"';
  assert.ok(code.includes(ancora), "bloco de rejeicao nao encontrado — ancora desatualizada");
  const ladoRejeicao = code.slice(code.indexOf(ancora));
  assert.match(ladoRejeicao, /transitionInternalStatus/, "rejeicao migrou na Fase 5f completa");
  assert.match(ladoRejeicao, /toStatus:\s*"BLOQUEADO_OPERACIONAL"/);
  // A regra 2 continua valendo: categoria NOVA, nunca reuso de excecao que a
  // automacao decide (docs/46 §3.4, docs/48 §4).
  assert.doesNotMatch(
    ladoRejeicao,
    /BLOQUEADO_INSTABILIDADE|EXCECAO_DOC_INVALIDO|EXCECAO_ARMA_DIVERGENTE|EXCECAO_DESTINO_INCOMPLETO/,
    "rejeicao nao pode mapear BLOQUEADO para excecao automatica",
  );
  // E os dois estados da Fase 5d continuam fora do lado rejeicao.
  for (const estado of NOVOS_ESTADOS) {
    assert.ok(!ladoRejeicao.includes(estado), `rejeicao nao deveria usar ${estado}`);
  }
});

// ------------------------------------------------- 3. o que continua nao migrado

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

test("updateProcessOperations chama a porta canonica (Fase 5g), mas nunca com os dois estados desta fase", () => {
  // Fase 5g migrou RASCUNHO/AGUARDANDO_PAGAMENTO/PAGO_EM_FILA para
  // `transitionInternalStatus` — nenhum dos dois com nome proprio (`DOCUMENTO_
  // RECEBIDO_PARA_ANALISE`/`DOCUMENTO_VALIDADO`, Fase 5d) porque esses tem
  // candidato so nos fluxos NATURAIS (upload/review); migrar aqui, na porta
  // MANUAL/admin sem validacao de maquina de transicoes, ficou fora desta
  // fase por decisao explicita.
  const code = codeOnly(readFileSync("src/server/services/updateProcessOperations.ts", "utf8"));
  for (const estado of NOVOS_ESTADOS) {
    assert.ok(!code.includes(estado), `updateProcessOperations.ts usa ${estado}`);
  }
  assert.match(
    code,
    /\btransitionInternalStatus\s*\(/,
    "a Fase 5g deveria ter introduzido a porta canonica em updateProcessOperations.ts",
  );
});

test("transitionInternalStatus tem exatamente 7 chamadores reais", () => {
  // A porta canonica tinha 1 chamador (docs/46 §5); a Fase 5e somou o
  // segundo (uploadProcessDocument); a Fase 5f somou o terceiro
  // (reviewProcessDocument, os dois lados); a Fase 5g soma o quarto
  // (updateProcessOperations); o docs/50 §5 soma o quinto
  // (reopenDocumentReview, a acao de desfazer conferencia); o docs/50 §6
  // soma o sexto (approveDocumentOutOfFlow, a acao de registrar aprovacao
  // feita fora do fluxo); e o docs/51 soma o setimo (cancelProcess, o
  // cancelamento real). Nenhum outro arquivo deveria importa-la.
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
    [
      "src/server/services/approveDocumentOutOfFlow.ts",
      "src/server/services/cancelProcess.ts",
      "src/server/services/confirmPixPayment.ts",
      "src/server/services/reopenDocumentReview.ts",
      "src/server/services/reviewProcessDocument.ts",
      "src/server/services/updateProcessOperations.ts",
      "src/server/services/uploadProcessDocument.ts",
    ],
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

// -------------------------------------- 5. diagnostico da 5c reflete os pares migrados

test("DOCUMENTO_RECEBIDO_PARA_ANALISE + DOCUMENTO_ENVIADO: none — combinacao migrada (Fase 5e)", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: RECEBIDO,
    operationalStatus: "DOCUMENTO_ENVIADO",
  });
  assert.equal(result.hasDivergence, false);
  assert.equal(result.severity, "none");
  assert.equal(result.expectedOperationalStatus, "DOCUMENTO_ENVIADO");
});

test("DOCUMENTO_VALIDADO + DOCUMENTO_APROVADO: none — combinacao migrada (Fase 5f)", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: VALIDADO,
    operationalStatus: "DOCUMENTO_APROVADO",
  });
  assert.equal(result.hasDivergence, false);
  assert.equal(result.severity, "none");
  assert.equal(result.expectedOperationalStatus, "DOCUMENTO_APROVADO");
});

test("nenhum dos dois pares migrados vira none com operationalStatus DIFERENTE do esperado", () => {
  // Migrado nao significa "sempre none" — so a combinacao ESPERADA e segura.
  // Qualquer outra continua sinalizando divergencia real.
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
  const esperado: Record<string, string> = {
    [RECEBIDO]: "DOCUMENTO_ENVIADO",
    [VALIDADO]: "DOCUMENTO_APROVADO",
  };
  for (const internalStatus of NOVOS_ESTADOS) {
    for (const operationalStatus of operacionais) {
      if (operationalStatus === esperado[internalStatus]) continue;
      const result = diagnoseStatusDivergence({ internalStatus, operationalStatus });
      assert.notEqual(result.severity, "none", `${internalStatus} + ${operationalStatus}`);
      assert.equal(result.hasDivergence, true, `${internalStatus} + ${operationalStatus}`);
    }
  }
});

test("BLOQUEADO virou expected_legacy — os dois writers migraram (docs/48)", () => {
  // Era `needs_decision` enquanto a rejeicao de reviewProcessDocument e o
  // dropdown de updateProcessOperations escreviam BLOQUEADO sem tocar
  // internalStatus. Com os dois migrados, so DADO ANTIGO produz a combinacao —
  // continua divergencia, mas conhecida, como DOCUMENTO_ENVIADO/APROVADO.
  const result = diagnoseStatusDivergence({
    internalStatus: "RASCUNHO",
    operationalStatus: "BLOQUEADO",
  });
  assert.equal(result.severity, "expected_legacy");
  assert.equal(result.hasDivergence, true);
});
