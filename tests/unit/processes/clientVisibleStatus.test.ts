/**
 * `clientVisibleStatusLabel` — fonte UNICA do status que o cliente ve (Fase 4a).
 *
 * POR QUE ESTE ARQUIVO EXISTE: o admin de detalhe do processo exibia
 * `userFacingStatus` sob o rotulo "Status visivel ao usuario", mas nenhuma tela
 * do cliente le aquela coluna — o cliente ve
 * `OPERATIONAL_STATUS_USER_LABELS[operationalStatus]`, com sobreposicao de
 * `MANUAL_EXECUTION_USER_LABELS` depois que a execucao manual comeca. As duas
 * visoes divergiam em 4 dos 9 estados operacionais, e o operador que confiasse na
 * tela admin informava o cliente errado.
 *
 * Estes testes travam (a) a regra de sobreposicao, (b) a divergencia historica,
 * para que ninguem "conserte" o admin voltando a `userFacingStatus`, e (c) o fato
 * de que a funcao NAO depende daquela coluna.
 *
 * Sem banco, sem rede, sem render: a funcao e pura.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  clientVisibleStatusLabel,
  MANUAL_EXECUTION_USER_LABELS,
  OPERATIONAL_STATUS_USER_LABELS,
} from "../../../src/server/processes/statusLabels";

const ADMIN_PAGE = "src/app/(admin)/admin/processos/[id]/page.tsx";
const CLIENT_PAGE = "src/app/(user)/processos/[id]/page.tsx";
const DASHBOARD_PAGE = "src/app/(user)/dashboard/page.tsx";

test("execucao manual NAO iniciada: usa o rotulo do status operacional", () => {
  const label = clientVisibleStatusLabel({
    operationalStatus: "DOCUMENTO_ENVIADO",
    manualExecutionStatus: "EXECUCAO_MANUAL_NAO_INICIADA",
  });

  assert.equal(label, "Documento em analise");
  assert.equal(label, OPERATIONAL_STATUS_USER_LABELS.DOCUMENTO_ENVIADO);
});

test("execucao manual em andamento sobrepoe o status operacional", () => {
  // O operacional continua `PAGO_EM_FILA`, mas a execucao manual e a visao mais
  // atual (docs/21 §11) — o cliente ve a etapa manual, nao a fila.
  const label = clientVisibleStatusLabel({
    operationalStatus: "PAGO_EM_FILA",
    manualExecutionStatus: "GOVBR_ABERTO_PELO_OPERADOR",
  });

  assert.equal(label, "Em execucao");
  assert.notEqual(label, OPERATIONAL_STATUS_USER_LABELS.PAGO_EM_FILA);
});

test("protocolo registrado: o cliente ve a etapa manual", () => {
  assert.equal(
    clientVisibleStatusLabel({
      operationalStatus: "PRONTO_PARA_PROTOCOLO_MANUAL",
      manualExecutionStatus: "PROTOCOLO_MANUAL_REGISTRADO",
    }),
    "Protocolo registrado",
  );
});

test("GRU paga: o cliente ve acompanhamento, nao o operacional", () => {
  assert.equal(
    clientVisibleStatusLabel({
      operationalStatus: "PRONTO_PARA_PROTOCOLO_MANUAL",
      manualExecutionStatus: "GRU_PAGA_MANUALMENTE_DEV",
    }),
    "Em acompanhamento",
  );
});

test("todo estado operacional tem rotulo quando a execucao manual nao comecou", () => {
  for (const operationalStatus of Object.keys(OPERATIONAL_STATUS_USER_LABELS) as Array<
    keyof typeof OPERATIONAL_STATUS_USER_LABELS
  >) {
    const label = clientVisibleStatusLabel({
      operationalStatus,
      manualExecutionStatus: "EXECUCAO_MANUAL_NAO_INICIADA",
    });
    assert.notEqual(label.trim(), "", `${operationalStatus}: rotulo vazio`);
  }
});

test("todo estado de execucao manual (exceto NAO_INICIADA) tem rotulo proprio", () => {
  for (const manualExecutionStatus of Object.keys(MANUAL_EXECUTION_USER_LABELS) as Array<
    keyof typeof MANUAL_EXECUTION_USER_LABELS
  >) {
    if (manualExecutionStatus === "EXECUCAO_MANUAL_NAO_INICIADA") continue;
    const label = clientVisibleStatusLabel({ operationalStatus: "RASCUNHO", manualExecutionStatus });
    assert.equal(label, MANUAL_EXECUTION_USER_LABELS[manualExecutionStatus]);
  }
});

test("a divergencia historica com userFacingStatus esta documentada em teste", () => {
  // Os 4 estados em que `USER_FACING_BY_OPERATIONAL` dizia uma coisa e o cliente
  // via outra. Se alguem reintroduzir a projecao antiga no admin, este teste
  // continua sendo a prova de que ela nao descreve a tela do cliente.
  const divergentes: Array<[keyof typeof OPERATIONAL_STATUS_USER_LABELS, string, string]> = [
    ["DOCUMENTO_ENVIADO", "Em andamento", "Documento em analise"],
    ["DOCUMENTO_APROVADO", "Em andamento", "Documento aprovado"],
    ["AGUARDANDO_PAGAMENTO", "Recebido", "Aguardando pagamento"],
    ["PAGO_EM_FILA", "Pagamento confirmado", "Pagamento confirmado — em fila"],
  ];

  for (const [operationalStatus, projecaoAntiga, oQueOClienteVe] of divergentes) {
    const real = clientVisibleStatusLabel({
      operationalStatus,
      manualExecutionStatus: "EXECUCAO_MANUAL_NAO_INICIADA",
    });
    assert.equal(real, oQueOClienteVe, `${operationalStatus}: o cliente ve isto`);
    assert.notEqual(real, projecaoAntiga, `${operationalStatus}: a projecao antiga divergia`);
  }
});

test("a funcao nao le userFacingStatus", () => {
  const source = readFileSync("src/server/processes/statusLabels.ts", "utf8");
  const inicio = source.indexOf("export function clientVisibleStatusLabel");
  assert.ok(inicio >= 0, "funcao nao encontrada — o teste precisa ser atualizado");
  // Delimita a FUNCAO, nao o resto do arquivo: `USER_FACING_STATUS_LABELS` e
  // definido depois e faria o assert falhar sem que a funcao o use.
  const fim = source.indexOf("\nexport ", inicio + 1);
  const corpo = source.slice(inicio, fim > 0 ? fim : undefined);
  const code = corpo.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

  assert.ok(!code.includes("userFacingStatus"), "a fonte do cliente nao e a coluna persistida");
  assert.ok(!code.includes("USER_FACING_STATUS_LABELS"), "nem os rotulos daquela coluna");
});

test("o admin usa a funcao compartilhada, nao userFacingStatus, para o status do cliente", () => {
  const source = readFileSync(ADMIN_PAGE, "utf8");
  const code = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

  assert.match(code, /clientVisibleStatusLabel\(detail\)/, "admin le da funcao compartilhada");
  // O rotulo antigo mentia; nao pode voltar.
  assert.ok(!code.includes("Status visivel ao usuario"), "rotulo enganoso removido");
  // A coluna persistida pode continuar exposta — mas rotulada pelo que e.
  assert.match(code, /userFacingStatus`? \(persistida/, "coluna rotulada com honestidade");
});

test("a tela do cliente usa a MESMA funcao — sem regra duplicada", () => {
  const source = readFileSync(CLIENT_PAGE, "utf8");
  const code = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

  assert.match(code, /clientVisibleStatusLabel\(process\)/, "cliente le da funcao compartilhada");
  // A escolha inline saiu: duas copias da regra foi exatamente o que gerou a
  // divergencia que este PR corrige.
  assert.ok(
    !code.includes("EXECUCAO_MANUAL_NAO_INICIADA\"\n              ?"),
    "sem ternario inline remanescente",
  );
});

test("o dashboard do cliente usa a MESMA funcao que o detalhe", () => {
  // A lista lia so `operationalStatus`: um processo em execucao manual aparecia
  // com um status na lista e outro ao abrir. Mesma pergunta, duas respostas.
  const code = readFileSync(DASHBOARD_PAGE, "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

  assert.match(code, /clientVisibleStatusLabel\(process\)/, "dashboard le da funcao compartilhada");
  assert.ok(
    !code.includes("OPERATIONAL_STATUS_USER_LABELS"),
    "a linha principal de status nao pode voltar a ler o mapa direto",
  );
});

test("dashboard e detalhe leem a MESMA funcao — nenhuma tela do cliente diverge", () => {
  // Guarda contra reintroduzir divergencia: as duas telas do cliente tem de
  // chamar `clientVisibleStatusLabel`, e nenhuma delas pode usar o mapa
  // operacional direto para o status principal.
  for (const pagina of [CLIENT_PAGE, DASHBOARD_PAGE]) {
    const code = readFileSync(pagina, "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
    assert.match(code, /clientVisibleStatusLabel\(/, `${pagina}: usa a funcao compartilhada`);
    assert.ok(!code.includes("OPERATIONAL_STATUS_USER_LABELS"), `${pagina}: sem mapa direto`);
    assert.ok(!code.includes("MANUAL_EXECUTION_USER_LABELS"), `${pagina}: sem mapa manual direto`);
  }
});

test("no dashboard, execucao manual ativa sobrescreve o status operacional", () => {
  // A regra e a mesma do detalhe — este teste existe para deixar explicito que o
  // dashboard passou a respeita-la, nao so que importa a funcao.
  const emFila = clientVisibleStatusLabel({
    operationalStatus: "PAGO_EM_FILA",
    manualExecutionStatus: "EXECUCAO_MANUAL_NAO_INICIADA",
  });
  const emExecucao = clientVisibleStatusLabel({
    operationalStatus: "PAGO_EM_FILA",
    manualExecutionStatus: "GOVBR_ABERTO_PELO_OPERADOR",
  });

  assert.equal(emFila, "Pagamento confirmado — em fila");
  assert.equal(emExecucao, "Em execucao");
  assert.notEqual(emFila, emExecucao, "era exatamente aqui que lista e detalhe divergiam");
});
