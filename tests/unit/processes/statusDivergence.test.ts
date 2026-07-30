/**
 * `diagnoseStatusDivergence` — Fase 5c (docs/46-inventario-operational-status.md
 * §9): diagnostico de divergencia internalStatus x operationalStatus, sem mudar
 * comportamento nenhum.
 *
 * Estes testes cobrem tres coisas:
 *  (1) as regras de severidade, uma a uma, contra o que docs/46 §6/§7 documenta;
 *  (2) que o modulo e realmente PURO - nao muta o processo, nao le
 *      userFacingStatus, nao acessa banco/rede/arquivo;
 *  (3) que os estados da Fase 2 nunca sao tratados como validos.
 *
 * O que este arquivo NAO faz: nao testa fila, permissao, readiness ou UI - o
 * diagnostico nao toca nenhum deles (docs/46 §9 5c, "sem mudar comportamento").
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DIVERGENCE_SEVERITIES,
  diagnoseStatusDivergence,
  type DivergenceSeverity,
} from "../../../src/server/processes/statusDivergence";

const MODULE_PATH = "src/server/processes/statusDivergence.ts";
const MODULE_SOURCE = readFileSync(MODULE_PATH, "utf8");

/**
 * Remove comentarios. Mesmo helper de operationalStatusWrites.test.ts: os
 * testes estruturais abaixo checam CODIGO, nao prosa — o cabecalho deste
 * modulo cita `userFacingStatus` de proposito, para explicar por que ele NAO e
 * usado (mesmo padrao de `clientVisibleStatusLabel` em statusLabels.ts). Banir
 * a palavra em qualquer lugar do arquivo puniria a propria documentacao da
 * exclusao.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const MODULE_CODE = codeOnly(MODULE_SOURCE);

// ------------------------------------------------------- 1. zona segura (§6)

test("RASCUNHO + RASCUNHO: sem divergencia", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: "RASCUNHO",
    operationalStatus: "RASCUNHO",
  });
  assert.equal(result.hasDivergence, false);
  assert.equal(result.severity, "none");
  assert.equal(result.expectedOperationalStatus, "RASCUNHO");
});

test("PAGO_EM_FILA + PAGO_EM_FILA: sem divergencia", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: "PAGO_EM_FILA",
    operationalStatus: "PAGO_EM_FILA",
  });
  assert.equal(result.hasDivergence, false);
  assert.equal(result.severity, "none");
});

test("AGUARDANDO_PAGAMENTO + AGUARDANDO_PAGAMENTO: sem divergencia, mesmo pouco alcancavel", () => {
  // docs/46 §5: nenhum fluxo real escreve internalStatus = AGUARDANDO_PAGAMENTO
  // hoje (so confirmPixPayment escreve, e so produz PAGO_EM_FILA). A regra vale
  // por definicao estrutural (docs/46 §6), nao por observacao em producao.
  const result = diagnoseStatusDivergence({
    internalStatus: "AGUARDANDO_PAGAMENTO",
    operationalStatus: "AGUARDANDO_PAGAMENTO",
  });
  assert.equal(result.hasDivergence, false);
  assert.equal(result.severity, "none");
});

test("zona segura com valores DIFERENTES entre si: needs_decision, nao none", () => {
  // internalStatus RASCUNHO mas operationalStatus PAGO_EM_FILA — ambos estao
  // nos 3 valores seguros, mas nao no MESMO. Indica escrita fora da porta
  // atomica (docs/44 Fase 3a) ou dado anterior a ela.
  const result = diagnoseStatusDivergence({
    internalStatus: "RASCUNHO",
    operationalStatus: "PAGO_EM_FILA",
  });
  assert.equal(result.hasDivergence, true);
  assert.equal(result.severity, "needs_decision");
  assert.equal(result.expectedOperationalStatus, "RASCUNHO");
});

test("DOCUMENTO_RECEBIDO_PARA_ANALISE + DOCUMENTO_ENVIADO: par migrado, sem divergencia (Fase 5e)", () => {
  // uploadProcessDocument passou a escrever pela porta canonica (docs/47 §6.1):
  // esta combinacao e agora o resultado ESPERADO de um upload novo, nao mais
  // needs_decision. Nomes diferentes nos dois campos, de proposito
  // (docs/47 §6.2) — o teste confirma que o diagnostico nao exige nome igual
  // para reconhecer "seguro".
  const result = diagnoseStatusDivergence({
    internalStatus: "DOCUMENTO_RECEBIDO_PARA_ANALISE",
    operationalStatus: "DOCUMENTO_ENVIADO",
  });
  assert.equal(result.hasDivergence, false);
  assert.equal(result.severity, "none");
  assert.equal(result.expectedOperationalStatus, "DOCUMENTO_ENVIADO");
});

test("DOCUMENTO_VALIDADO + DOCUMENTO_APROVADO: par migrado, sem divergencia (Fase 5f)", () => {
  // reviewProcessDocument (lado aprovacao) passou a escrever pela porta
  // canonica (docs/47 §6.2): esta combinacao e agora o resultado ESPERADO de
  // uma aprovacao nova, nao mais needs_decision.
  const result = diagnoseStatusDivergence({
    internalStatus: "DOCUMENTO_VALIDADO",
    operationalStatus: "DOCUMENTO_APROVADO",
  });
  assert.equal(result.hasDivergence, false);
  assert.equal(result.severity, "none");
  assert.equal(result.expectedOperationalStatus, "DOCUMENTO_APROVADO");
});

test("DOCUMENTO_VALIDADO com operationalStatus DIFERENTE de DOCUMENTO_APROVADO ainda diverge", () => {
  // Migrado nao significa "sempre none" — so a combinacao ESPERADA e segura.
  // Qualquer outra continua sinalizando divergencia real.
  const operacionais = [
    "RASCUNHO",
    "DOCUMENTO_ENVIADO",
    "AGUARDANDO_PAGAMENTO",
    "PAGO_EM_FILA",
    "EM_REVISAO_OPERACIONAL",
    "PRONTO_PARA_PROTOCOLO_MANUAL",
    "BLOQUEADO",
    "CANCELADO_DEV",
  ] as const;
  for (const operationalStatus of operacionais) {
    const result = diagnoseStatusDivergence({
      internalStatus: "DOCUMENTO_VALIDADO",
      operationalStatus,
    });
    assert.notEqual(result.severity, "none", `DOCUMENTO_VALIDADO + ${operationalStatus}`);
    assert.equal(result.hasDivergence, true, `DOCUMENTO_VALIDADO + ${operationalStatus}`);
  }
});

test("RASCUNHO + DOCUMENTO_ENVIADO continua expected_legacy — dado anterior a Fase 5e", () => {
  // A combinacao antiga (internalStatus preso em RASCUNHO enquanto
  // operationalStatus ja avancou) nao desaparece: processos criados ANTES
  // desta migracao podem estar assim, e nao ha backfill. Severidade
  // inalterada; so a razao passou a explicar que e caso historico.
  const result = diagnoseStatusDivergence({
    internalStatus: "RASCUNHO",
    operationalStatus: "DOCUMENTO_ENVIADO",
  });
  assert.equal(result.severity, "expected_legacy");
  assert.match(result.reason, /ANTERIOR a Fase 5e/);
});

test("RASCUNHO + DOCUMENTO_APROVADO virou expected_legacy — dado anterior a Fase 5f", () => {
  // Mesmo raciocinio da linha acima, agora para o lado aprovacao: a decisao
  // (docs/47) foi tomada E implementada (5f) — a divergencia remanescente e
  // so idade do dado, nao mais "decisao pendente". needs_decision mentiria
  // aqui: nao ha mais nada para decidir sobre este write especifico.
  const result = diagnoseStatusDivergence({
    internalStatus: "RASCUNHO",
    operationalStatus: "DOCUMENTO_APROVADO",
  });
  assert.equal(result.severity, "expected_legacy");
  assert.match(result.reason, /ANTERIOR a Fase 5f/);
});

// --------------------------------------- 2. writes legados (docs/46 §3/§7)

test("legado esperado: internalStatus RASCUNHO, operationalStatus DOCUMENTO_ENVIADO", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: "RASCUNHO",
    operationalStatus: "DOCUMENTO_ENVIADO",
  });
  assert.equal(result.hasDivergence, true);
  assert.equal(result.severity, "expected_legacy");
  assert.match(result.reason, /uploadProcessDocument/);
});

test("expected_legacy: internalStatus RASCUNHO, operationalStatus DOCUMENTO_APROVADO (migrado na 5f)", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: "RASCUNHO",
    operationalStatus: "DOCUMENTO_APROVADO",
  });
  assert.equal(result.hasDivergence, true);
  assert.equal(result.severity, "expected_legacy");
  assert.match(result.reason, /reviewProcessDocument/);
});

test("needs_decision: internalStatus RASCUNHO, operationalStatus BLOQUEADO", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: "RASCUNHO",
    operationalStatus: "BLOQUEADO",
  });
  assert.equal(result.hasDivergence, true);
  assert.equal(result.severity, "needs_decision");
  // docs/46 §3.4: mapear BLOQUEADO de volta para um InternalStatus especifico
  // sem decisao propria e PROIBIDO — a razao precisa citar isso, nao so dizer
  // "precisa decidir".
  assert.match(result.reason, /PROIBIDO/);
});

test("os 6 estados sem equivalente canonico (docs/46 §7) tem severidade coerente", () => {
  // EM_REVISAO_OPERACIONAL, PRONTO_PARA_PROTOCOLO_MANUAL e CANCELADO_DEV nao
  // tem teste obrigatorio individual no pedido, mas fecham a cobertura dos 6.
  // DOCUMENTO_ENVIADO e DOCUMENTO_APROVADO sao expected_legacy — os dois ja
  // tem par migrado (Fases 5e/5f); o resto continua needs_decision porque
  // NENHUM deles tem fluxo migrado ou decisao fechada (BLOQUEADO exige
  // decisao propria, docs/47 §6.5).
  const casos: [import("@prisma/client").OperationalStatus, DivergenceSeverity][] = [
    ["DOCUMENTO_ENVIADO", "expected_legacy"],
    ["DOCUMENTO_APROVADO", "expected_legacy"],
    ["EM_REVISAO_OPERACIONAL", "needs_decision"],
    ["PRONTO_PARA_PROTOCOLO_MANUAL", "needs_decision"],
    ["BLOQUEADO", "needs_decision"],
    ["CANCELADO_DEV", "needs_decision"],
  ];
  for (const [operationalStatus, severity] of casos) {
    const result = diagnoseStatusDivergence({ internalStatus: "RASCUNHO", operationalStatus });
    assert.equal(result.severity, severity, `RASCUNHO + ${operationalStatus}`);
    assert.equal(result.hasDivergence, true);
  }
});

// -------------------------------------- 3. internalStatus avancado (§6)

test("invalid_projection: internalStatus CONCLUIDO nao tem operationalStatus equivalente", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: "CONCLUIDO",
    operationalStatus: "RASCUNHO",
  });
  assert.equal(result.hasDivergence, true);
  assert.equal(result.severity, "invalid_projection");
  // Sem candidato: docs/46 §6 diz explicitamente "sem equivalente", nao so
  // "arriscado". Sugerir um valor aqui seria inventar o que o documento recusa
  // a inventar.
  assert.equal(result.expectedOperationalStatus, undefined);
});

test("invalid_projection: internalStatus CANCELADO_REEMBOLSADO projetaria para CANCELADO_DEV, o que e falso", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: "CANCELADO_REEMBOLSADO",
    operationalStatus: "RASCUNHO",
  });
  assert.equal(result.hasDivergence, true);
  assert.equal(result.severity, "invalid_projection");
  // Aqui HA candidato documentado (docs/46 §6) — mas ele e o proprio motivo do
  // invalid_projection: projetar afirmaria "cancelamento de dev" onde houve
  // reembolso real.
  assert.equal(result.expectedOperationalStatus, "CANCELADO_DEV");
});

test("BLOQUEADO_INSTABILIDADE e as 3 EXCECAO_* projetam para BLOQUEADO como candidato arriscado", () => {
  const estados: import("@prisma/client").InternalStatus[] = [
    "BLOQUEADO_INSTABILIDADE",
    "EXCECAO_DOC_INVALIDO",
    "EXCECAO_ARMA_DIVERGENTE",
    "EXCECAO_DESTINO_INCOMPLETO",
  ];
  for (const internalStatus of estados) {
    const result = diagnoseStatusDivergence({ internalStatus, operationalStatus: "RASCUNHO" });
    assert.equal(result.severity, "needs_decision", internalStatus);
    assert.equal(result.expectedOperationalStatus, "BLOQUEADO", internalStatus);
    assert.match(result.reason, /causa especifica/, internalStatus);
  }
});

test("PROTOCOLADO_GRU_GERADA: candidato documentado, mas inverte o tempo", () => {
  const result = diagnoseStatusDivergence({
    internalStatus: "PROTOCOLADO_GRU_GERADA",
    operationalStatus: "RASCUNHO",
  });
  assert.equal(result.severity, "invalid_projection");
  assert.equal(result.expectedOperationalStatus, "PRONTO_PARA_PROTOCOLO_MANUAL");
  assert.match(result.reason, /inverte o tempo/);
});

test("internalStatus avancado sem candidato documentado: needs_decision, sem inventar valor", () => {
  const semCandidato: import("@prisma/client").InternalStatus[] = [
    "AGUARDANDO_LOGIN_GOVBR",
    "SESSAO_GOVBR_EXPIRADA",
    "EM_PREENCHIMENTO_SINARM",
    "EM_REVISAO_HUMANA",
    "GRU_PAGA_EMPRESA",
  ];
  for (const internalStatus of semCandidato) {
    const result = diagnoseStatusDivergence({ internalStatus, operationalStatus: "RASCUNHO" });
    assert.equal(result.severity, "needs_decision", internalStatus);
    assert.equal(result.expectedOperationalStatus, undefined, internalStatus);
  }
});

// ----------------------------------------------- 4. estados da Fase 2 (docs/44 §6)

test("estados da Fase 2 nunca sao tratados como validos, mesmo com operationalStatus 'combinando'", () => {
  // O caso mais perigoso de testar: operationalStatus = RASCUNHO e o valor que,
  // para um internalStatus seguro, daria "none". Para a Fase 2 tem que
  // continuar acusando divergencia — nunca fingir que a combinacao esta bem.
  const fase2: import("@prisma/client").InternalStatus[] = [
    "AGUARDANDO_CONFIRMACAO_HUMANA",
    "AGUARDANDO_CAPTCHA",
  ];
  for (const internalStatus of fase2) {
    const result = diagnoseStatusDivergence({ internalStatus, operationalStatus: "RASCUNHO" });
    assert.equal(result.hasDivergence, true, internalStatus);
    assert.notEqual(result.severity, "none", internalStatus);
    assert.equal(result.expectedOperationalStatus, undefined, internalStatus);
  }
});

test("estados da Fase 2 nao aparecem em nenhum fluxo consumidor (docs/44 §6)", () => {
  // Mesma trava que internalStatusStates.test.ts ja aplica aos writers reais;
  // aqui garante que o diagnostico NOVO tambem nao vira consumidor.
  const consumidores = [
    "src/server/services/uploadProcessDocument.ts",
    "src/server/services/reviewProcessDocument.ts",
    "src/server/services/updateProcessOperations.ts",
    "src/server/services/confirmPixPayment.ts",
    "src/server/services/transitionInternalStatus.ts",
  ];
  for (const file of consumidores) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /AGUARDANDO_CONFIRMACAO_HUMANA|AGUARDANDO_CAPTCHA/,
      `${file} nao deveria mencionar estados da Fase 2`,
    );
  }
});

// --------------------------------------------------- 5. pureza estrutural

test("userFacingStatus nao entra no diagnostico", () => {
  // Type-level: StatusDivergenceInput nem aceita a coluna. Em CODIGO (sem
  // comentarios), o nome nao pode aparecer em tipo, destructuring nem leitura —
  // so em prosa explicando a exclusao, o que MODULE_CODE ja removeu.
  assert.doesNotMatch(MODULE_CODE, /\buserFacingStatus\b/);
});

test("o modulo e puro: sem Prisma runtime, sem fs, sem rede, sem Next", () => {
  // So o TYPE `@prisma/client` e importado (InternalStatus/OperationalStatus/
  // ManualExecutionStatus) — nunca `getPrisma`, nunca um client de verdade.
  assert.doesNotMatch(MODULE_CODE, /getPrisma|\$transaction|\.findUnique|\.update\(/);
  assert.doesNotMatch(MODULE_CODE, /\bfetch\(|XMLHttpRequest|WebSocket/);
  assert.doesNotMatch(MODULE_CODE, /node:fs|node:http|next\/(navigation|server)/);
  assert.match(
    MODULE_CODE,
    /import \{ type InternalStatus, type ManualExecutionStatus, type OperationalStatus \} from "@prisma\/client"/,
    "so tipos do Prisma, nunca o client",
  );
});

test("diagnoseStatusDivergence nao muta o input", () => {
  const input = Object.freeze({
    internalStatus: "RASCUNHO" as const,
    operationalStatus: "DOCUMENTO_ENVIADO" as const,
  });
  // Object.freeze faz qualquer escrita silenciosa (modo nao-strict) ou lancar
  // (modo strict, que e o padrao em modulo ESM/TS) — ambos provam ausencia de
  // mutacao se a chamada nao lancar.
  assert.doesNotThrow(() => diagnoseStatusDivergence(input));
  assert.deepEqual(input, { internalStatus: "RASCUNHO", operationalStatus: "DOCUMENTO_ENVIADO" });
});

test("diagnoseStatusDivergence e deterministico: mesma entrada, mesma saida", () => {
  const input = { internalStatus: "RASCUNHO", operationalStatus: "BLOQUEADO" } as const;
  const first = diagnoseStatusDivergence(input);
  const second = diagnoseStatusDivergence(input);
  assert.deepEqual(first, second);
});

// -------------------------------------------------- 6. cobertura exaustiva

test("severity sempre e um dos 4 valores declarados", () => {
  const internos = [
    "RASCUNHO",
    "AGUARDANDO_PAGAMENTO",
    "PAGO_EM_FILA",
    "AGUARDANDO_LOGIN_GOVBR",
    "SESSAO_GOVBR_EXPIRADA",
    "EM_PREENCHIMENTO_SINARM",
    "EM_REVISAO_HUMANA",
    "BLOQUEADO_INSTABILIDADE",
    "EXCECAO_DOC_INVALIDO",
    "EXCECAO_ARMA_DIVERGENTE",
    "EXCECAO_DESTINO_INCOMPLETO",
    "PROTOCOLADO_GRU_GERADA",
    "GRU_PAGA_EMPRESA",
    "CONCLUIDO",
    "CANCELADO_REEMBOLSADO",
    "AGUARDANDO_CONFIRMACAO_HUMANA",
    "AGUARDANDO_CAPTCHA",
    "DOCUMENTO_RECEBIDO_PARA_ANALISE",
    "DOCUMENTO_VALIDADO",
  ] as const;
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
  assert.equal(
    internos.length,
    19,
    "17 de docs/46 §2 + 2 aprovados pela Fase 5d (docs/47): DOCUMENTO_RECEBIDO_PARA_ANALISE, DOCUMENTO_VALIDADO",
  );
  assert.equal(operacionais.length, 9, "os 9 valores de OperationalStatus, docs/46 §2");

  for (const internalStatus of internos) {
    for (const operationalStatus of operacionais) {
      const result = diagnoseStatusDivergence({ internalStatus, operationalStatus });
      assert.ok(
        (DIVERGENCE_SEVERITIES as readonly string[]).includes(result.severity),
        `${internalStatus} + ${operationalStatus} produziu severity invalida: ${result.severity}`,
      );
      assert.equal(typeof result.hasDivergence, "boolean", `${internalStatus} + ${operationalStatus}`);
      assert.equal(typeof result.reason, "string", `${internalStatus} + ${operationalStatus}`);
      assert.ok(result.reason.length > 0, `${internalStatus} + ${operationalStatus} sem reason`);
    }
  }
});

test("apenas os pares seguros produzem severity 'none'", () => {
  const internos = [
    "RASCUNHO",
    "AGUARDANDO_PAGAMENTO",
    "PAGO_EM_FILA",
    "AGUARDANDO_LOGIN_GOVBR",
    "SESSAO_GOVBR_EXPIRADA",
    "EM_PREENCHIMENTO_SINARM",
    "EM_REVISAO_HUMANA",
    "BLOQUEADO_INSTABILIDADE",
    "EXCECAO_DOC_INVALIDO",
    "EXCECAO_ARMA_DIVERGENTE",
    "EXCECAO_DESTINO_INCOMPLETO",
    "PROTOCOLADO_GRU_GERADA",
    "GRU_PAGA_EMPRESA",
    "CONCLUIDO",
    "CANCELADO_REEMBOLSADO",
    "AGUARDANDO_CONFIRMACAO_HUMANA",
    "AGUARDANDO_CAPTCHA",
    "DOCUMENTO_RECEBIDO_PARA_ANALISE",
    "DOCUMENTO_VALIDADO",
  ] as const;
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

  // Independente da tabela interna do modulo, de proposito: os pares
  // DOCUMENTO_RECEBIDO_PARA_ANALISE/DOCUMENTO_ENVIADO (Fase 5e) e
  // DOCUMENTO_VALIDADO/DOCUMENTO_APROVADO (Fase 5f, docs/47) sao os seguros
  // com NOMES DIFERENTES nos dois campos — os 3 originais (docs/46 §6) tem o
  // mesmo nome nos dois lados.
  const PARES_SEGUROS: Record<string, string> = {
    RASCUNHO: "RASCUNHO",
    AGUARDANDO_PAGAMENTO: "AGUARDANDO_PAGAMENTO",
    PAGO_EM_FILA: "PAGO_EM_FILA",
    DOCUMENTO_RECEBIDO_PARA_ANALISE: "DOCUMENTO_ENVIADO",
    DOCUMENTO_VALIDADO: "DOCUMENTO_APROVADO",
  };

  let semDivergencia = 0;
  for (const internalStatus of internos) {
    for (const operationalStatus of operacionais) {
      const result = diagnoseStatusDivergence({ internalStatus, operationalStatus });
      if (result.severity === "none") {
        semDivergencia++;
        assert.equal(result.hasDivergence, false, `${internalStatus} + ${operationalStatus}`);
        assert.equal(
          PARES_SEGUROS[internalStatus],
          operationalStatus,
          `${internalStatus} + ${operationalStatus} nao e um par seguro conhecido`,
        );
      } else {
        assert.equal(result.hasDivergence, true, `${internalStatus} + ${operationalStatus}`);
      }
    }
  }
  assert.equal(
    semDivergencia,
    5,
    "RASCUNHO/idem, AGUARDANDO_PAGAMENTO/idem, PAGO_EM_FILA/idem, " +
      "DOCUMENTO_RECEBIDO_PARA_ANALISE+DOCUMENTO_ENVIADO, DOCUMENTO_VALIDADO+DOCUMENTO_APROVADO",
  );
});

test("os 9 valores de OperationalStatus vem do schema, nao de copia", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const bloco = /enum OperationalStatus \{([\s\S]*?)\}/.exec(schema);
  assert.ok(bloco, "enum OperationalStatus nao encontrado em prisma/schema.prisma");
  const valores = bloco![1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
  assert.equal(valores.length, 9);
});

// ----------------------------------------- 7. exposicao no admin (so leitura)

test("o diagnostico aparece no admin detail como leitura, fora de qualquer form", () => {
  const ADMIN_DETAIL_PAGE = "src/app/(admin)/admin/processos/[id]/page.tsx";
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");

  assert.match(
    source,
    /diagnoseStatusDivergence\(\{/,
    "admin detail deveria importar/usar diagnoseStatusDivergence",
  );

  // A linha que renderiza o diagnostico nao pode estar dentro de um <form> —
  // senao vira campo de formulario/acao, nao leitura.
  const diagnosticoIndex = source.indexOf("Diagnostico de status");
  assert.ok(diagnosticoIndex > -1, "texto do diagnostico nao encontrado na pagina");
  const beforeDiagnostico = source.slice(0, diagnosticoIndex);
  const lastFormOpen = beforeDiagnostico.lastIndexOf("<form");
  const lastFormClose = beforeDiagnostico.lastIndexOf("</form>");
  // Sem <form nenhum antes (lastFormOpen === -1) tambem prova que esta fora —
  // so e problema se um <form abriu e ainda nao fechou quando o diagnostico
  // aparece.
  assert.ok(
    lastFormOpen === -1 || lastFormClose > lastFormOpen,
    "o diagnostico esta dentro de um <form> — deveria ser so leitura",
  );
});

test("o dropdown e a acao de mudar operationalStatus continuam intactos", () => {
  // Regressao: a Fase 5c e so leitura. Se este teste falhar, a exposicao no
  // admin mexeu em algo que decide comportamento — nao era para acontecer.
  const ADMIN_DETAIL_PAGE = "src/app/(admin)/admin/processos/[id]/page.tsx";
  const source = readFileSync(ADMIN_DETAIL_PAGE, "utf8");

  assert.match(source, /action=\{changeOperationalStatusAction\}/);
  assert.match(source, /name="operationalStatus"/);
  assert.match(source, /defaultValue=\{detail\.operationalStatus\}/);
  assert.match(
    source,
    /Object\.entries\(OPERATIONAL_STATUS_LABELS\)\.map/,
    "dropdown continua oferecendo os 9 valores via OPERATIONAL_STATUS_LABELS",
  );
});

test("os 19 valores de InternalStatus vem do schema, nao de copia", () => {
  // 17 de docs/46 §2 + 2 aprovados pela Fase 5d (docs/47, migration
  // 20260731010000_add_document_internal_statuses).
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const bloco = /enum InternalStatus \{([\s\S]*?)\n\}/.exec(schema);
  assert.ok(bloco, "enum InternalStatus nao encontrado em prisma/schema.prisma");
  const valores = bloco![1]
    .split("\n")
    .map((line) => line.replace(/\/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
  assert.equal(valores.length, 19);
  assert.ok(valores.includes("DOCUMENTO_RECEBIDO_PARA_ANALISE"));
  assert.ok(valores.includes("DOCUMENTO_VALIDADO"));
});
