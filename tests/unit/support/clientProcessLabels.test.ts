/**
 * Nomes amigaveis dos processos — travas do bloco C (docs/61 §4.C).
 *
 * O valor destes testes e impedir regressao de VOCABULARIO: codigo tecnico
 * virando rotulo do cliente, `Process.code` sendo confundido com
 * `ProcessType.code`, e nome de registro operacional voltando para a tela.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CLIENT_PROCESS_LABELS,
  clientProcessChoices,
  clientProcessName,
} from "../../../src/server/support/clientProcessChoices";
import {
  LAUNCH_PROCESS_CODES,
  getProcessDefinition,
} from "../../../src/server/processes/processCatalog";
import {
  PERSISTED_PROCESS_TYPE_CODES,
  catalogCodeFromPersistedProcessTypeCode,
} from "../../../src/server/processes/processTypeMapping";

/** Todo o texto que o cliente le a partir deste modulo. */
function allClientText(): string {
  return Object.values(CLIENT_PROCESS_LABELS)
    .flatMap((entry) => [entry.label, entry.name, entry.blurb])
    .join("\n");
}

test("todo processo do catalogo tem nome de cliente", () => {
  for (const code of LAUNCH_PROCESS_CODES) {
    const entry = CLIENT_PROCESS_LABELS[code];
    assert.ok(entry, `sem nome de cliente: ${code}`);
    assert.ok(entry.label.length > 0, `label vazio: ${code}`);
    assert.ok(entry.name.length > 0, `name vazio: ${code}`);
  }
  assert.equal(Object.keys(CLIENT_PROCESS_LABELS).length, LAUNCH_PROCESS_CODES.length);
});

test("nenhum codigo tecnico vira rotulo do cliente", () => {
  const texto = allClientText();
  for (const code of LAUNCH_PROCESS_CODES) {
    assert.ok(!texto.includes(code), `codigo de catalogo exposto: ${code}`);
  }
  for (const code of PERSISTED_PROCESS_TYPE_CODES) {
    assert.ok(!texto.includes(code), `codigo persistido exposto: ${code}`);
  }
  // Marca de banco/dev: nenhum rotulo pode carregar SNAKE_CASE.
  assert.doesNotMatch(texto, /[A-Z]{3,}_[A-Z]/, "rotulo com codigo em SNAKE_CASE");
});

test("acao e substantivo sao registros diferentes", () => {
  // "Emitir Guia de Tráfego" (escolher) vs "Guia de Tráfego" (acompanhar).
  for (const code of LAUNCH_PROCESS_CODES) {
    const { label, name } = CLIENT_PROCESS_LABELS[code];
    assert.notEqual(label, name, `${code}: acao e substantivo iguais`);
  }
});

test("clientProcessName aceita o codigo PERSISTIDO", () => {
  for (const persisted of PERSISTED_PROCESS_TYPE_CODES) {
    const catalogCode = catalogCodeFromPersistedProcessTypeCode(persisted);
    assert.ok(catalogCode, `mapeamento ausente: ${persisted}`);
    assert.equal(
      clientProcessName(persisted, "NAO DEVE USAR O FALLBACK"),
      CLIENT_PROCESS_LABELS[catalogCode].name,
    );
  }
});

test("clientProcessName aceita o codigo do CATALOGO", () => {
  for (const code of LAUNCH_PROCESS_CODES) {
    assert.equal(
      clientProcessName(code, "NAO DEVE USAR O FALLBACK"),
      CLIENT_PROCESS_LABELS[code].name,
    );
  }
});

test("tipo fora do catalogo cai no nome do banco, nao em vazio", () => {
  assert.equal(clientProcessName("TIPO_QUE_NAO_EXISTE", "Nome do banco"), "Nome do banco");
  assert.equal(clientProcessName("", "Nome do banco"), "Nome do banco");
});

test("o nome do BANCO da Guia nao chega mais ao cliente por este caminho", () => {
  // Semeado como "Guia de Trafego (Pessoa Fisica - CAC)" — registro, nao produto.
  const exibido = clientProcessName("GUIA_TRAFEGO_PF_CAC", "Guia de Trafego (Pessoa Fisica - CAC)");
  assert.equal(exibido, "Guia de Tráfego");
  assert.ok(!exibido.includes("Pessoa Fisica"), "jargao de registro exposto");
});

/*
  Process.code x ProcessType.code — sao coisas diferentes e nao podem se cruzar:
   - `Process.code`     = numero interno do pedido, `CAC-YYYY-NNNNNN` (docs/62);
   - `ProcessType.code` = codigo tecnico do tipo, `GUIA_TRAFEGO_PF_CAC`.
*/
test("numero interno do pedido NAO e tratado como tipo de processo", () => {
  const numeroInterno = "CAC-2026-000001";
  assert.equal(clientProcessName(numeroInterno, "Nome do banco"), "Nome do banco");
});

test("o modulo de nomes nao conhece o gerador do numero interno", () => {
  const code = readFileSync("src/server/support/clientProcessChoices.ts", "utf8");
  assert.doesNotMatch(code, /generateProcessCode|process_code_seq|nextval/, "sem Process.code");
  assert.doesNotMatch(code, /@prisma\/client|getPrisma|Repository/, "sem Prisma");
});

test("as escolhas usam a ACAO, e o acompanhamento usa o SUBSTANTIVO", () => {
  for (const choice of clientProcessChoices()) {
    assert.equal(choice.label, CLIENT_PROCESS_LABELS[choice.code].label);
    assert.notEqual(choice.label, CLIENT_PROCESS_LABELS[choice.code].name);
  }
});

test("o nome regulatorio do catalogo continua existindo para uso interno", () => {
  // C.3: renomear para o cliente NAO apaga o vocabulario tecnico.
  for (const code of LAUNCH_PROCESS_CODES) {
    const definition = getProcessDefinition(code);
    assert.ok(definition, `definicao ausente: ${code}`);
    assert.ok(definition.name.length > 0, `nome de catalogo vazio: ${code}`);
  }
  assert.equal(getProcessDefinition("EMISSAO_CRAF")?.name, "Emissão de CRAF");
});

test("os nomes NAO prometem automacao, aprovacao, deferimento nem prazo", () => {
  const texto = allClientText().toLowerCase();
  for (const termo of [
    "automaticamente",
    "garantimos",
    "será aprovado",
    "será deferido",
    "aprovação garantida",
    "em até",
    "prazo de",
  ]) {
    assert.ok(!texto.includes(termo), `texto proibido encontrado: "${termo}"`);
  }
});

/* Travas de FONTE: as paginas exigem auth+banco e nao renderizam aqui. */

const CLIENT_PAGES = [
  "src/app/(user)/dashboard/page.tsx",
  "src/app/(user)/processos/[id]/page.tsx",
  "src/app/(user)/processos/novo/sucesso/page.tsx",
];

test("nenhuma tela do cliente exibe processType.name cru", () => {
  for (const page of CLIENT_PAGES) {
    const src = readFileSync(page, "utf8");
    assert.ok(
      src.includes("clientProcessName("),
      `${page}: deveria traduzir o nome do tipo`,
    );
    assert.doesNotMatch(
      src,
      /\{\s*process\.processType\.name\s*\}/,
      `${page}: nome do banco renderizado direto`,
    );
  }
});

test("o admin PRESERVA o nome e o codigo tecnicos", () => {
  const src = readFileSync("src/app/(admin)/admin/processos/[id]/page.tsx", "utf8");
  assert.ok(src.includes("detail.processTypeName"), "admin perdeu o nome operacional");
  assert.ok(src.includes("detail.processTypeCode"), "admin perdeu o codigo tecnico");
});
