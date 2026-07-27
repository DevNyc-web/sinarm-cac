/**
 * Conteudo da central de ajuda — travas de CONFORMIDADE de texto.
 *
 * Estes testes existem menos para checar "funcionalidade" e mais para impedir
 * regressao de texto: promessa de prazo/deferimento, sugestao de vinculo com
 * orgao publico, ou pedido de credencial de Gov.br (docs/24 §14, docs/00 §8).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CLIENT_STATUS_CODES,
  CLIENT_STATUS_GUIDE,
  CLIENT_STATUS_GUIDE_NOTE,
  getClientStatusExplanation,
} from "../../../src/server/support/clientStatusGuide";
import {
  getHelpTopic,
  HELP_TOPICS,
  NEVER_ASK_GOVBR_CREDENTIALS,
} from "../../../src/server/support/helpTopics";
import {
  isTutorialAvailable,
  TUTORIALS_DISCLAIMER,
  TUTORIAL_VIDEOS,
} from "../../../src/server/support/tutorialVideos";

const REQUIRED_TOPIC_IDS = [
  "criar-conta",
  "enviar-documentos",
  "acompanhar-pedido",
  "gov-br",
  "status",
  "suporte",
];

/** Texto de UI de TODO o conteudo da ajuda, concatenado, para varredura. */
function allHelpText(): string {
  const topics = HELP_TOPICS.flatMap((topic) => [
    topic.question,
    topic.summary,
    ...(topic.steps ?? []),
    topic.note ?? "",
  ]);
  const statuses = CLIENT_STATUS_GUIDE.flatMap((status) => [
    status.label,
    status.description,
    status.whatYouDo,
  ]);
  const videos = TUTORIAL_VIDEOS.flatMap((video) => [video.title, video.description]);

  return [...topics, ...statuses, ...videos, CLIENT_STATUS_GUIDE_NOTE, TUTORIALS_DISCLAIMER]
    .join("\n")
    .toLowerCase();
}

test("cobre os 6 topicos pedidos, sem id duplicado", () => {
  for (const id of REQUIRED_TOPIC_IDS) {
    assert.ok(getHelpTopic(id), `topico ausente: ${id}`);
  }
  const ids = HELP_TOPICS.map((topic) => topic.id);
  assert.equal(new Set(ids).size, ids.length, "ids de topico devem ser unicos");
});

test("topico desconhecido retorna undefined (erro controlado)", () => {
  assert.equal(getHelpTopic("nao-existe"), undefined);
});

test("todo topico tem pergunta e resumo nao vazios", () => {
  for (const topic of HELP_TOPICS) {
    assert.ok(topic.question.trim().length > 0, `${topic.id}: pergunta vazia`);
    assert.ok(topic.summary.trim().length > 0, `${topic.id}: resumo vazio`);
  }
});

test("o topico de Gov.br deixa explicito que nunca pedimos credencial", () => {
  const topic = getHelpTopic("gov-br");
  assert.ok(topic);
  assert.ok(topic.note?.includes(NEVER_ASK_GOVBR_CREDENTIALS));
});

test("guia cobre exatamente os 12 status de produto, na ordem declarada", () => {
  assert.equal(CLIENT_STATUS_GUIDE.length, 12);
  assert.deepEqual(
    CLIENT_STATUS_GUIDE.map((status) => status.code),
    [...CLIENT_STATUS_CODES],
  );
});

test("cada status tem rotulo, descricao e orientacao ao cliente", () => {
  for (const status of CLIENT_STATUS_GUIDE) {
    assert.ok(status.label.trim().length > 0, `${status.code}: rotulo vazio`);
    assert.ok(status.description.trim().length > 0, `${status.code}: descricao vazia`);
    assert.ok(status.whatYouDo.trim().length > 0, `${status.code}: orientacao vazia`);
  }
});

test("status desconhecido retorna undefined", () => {
  assert.equal(getClientStatusExplanation("AGUARDANDO_LOGIN_GOVBR"), undefined);
});

test("nenhum video aponta para link ainda — estrutura pronta, sem placeholder navegavel", () => {
  for (const video of TUTORIAL_VIDEOS) {
    assert.equal(video.url, null, `${video.id}: nao deve ter URL nesta etapa`);
    assert.equal(isTutorialAvailable(video), false);
  }
});

test("isTutorialAvailable so vira true com URL preenchida", () => {
  assert.equal(isTutorialAvailable({ id: "x", title: "t", description: "d", url: "" }), false);
  assert.equal(
    isTutorialAvailable({ id: "x", title: "t", description: "d", url: "https://exemplo/1" }),
    true,
  );
});

test("o aviso dos videos nega ser material oficial", () => {
  assert.match(TUTORIALS_DISCLAIMER.toLowerCase(), /não são material oficial/);
});

test("o conteudo NAO promete prazo de analise nem deferimento", () => {
  const text = allHelpText();
  const proibidos = [
    "garantimos a aprovação",
    "garantia de aprovação",
    "aprovação garantida",
    "em até 30 dias",
    "prazo de aprovação",
    "seu pedido será aprovado",
  ];
  for (const termo of proibidos) {
    assert.ok(!text.includes(termo), `texto proibido encontrado: "${termo}"`);
  }
});

test("o conteudo NAO se apresenta como orgao/canal oficial", () => {
  const text = allHelpText();
  for (const termo of ["canal oficial", "site oficial do governo", "somos o órgão", "brasão"]) {
    assert.ok(!text.includes(termo), `texto proibido encontrado: "${termo}"`);
  }
});

test("o guia de status avisa que nao e o sistema do orgao", () => {
  assert.match(CLIENT_STATUS_GUIDE_NOTE.toLowerCase(), /não são o sistema do órgão/);
});

/** Trava estatica: modulos de ajuda sao conteudo puro, sem banco/rede/schema. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const PURE_MODULES = [
  "src/server/support/helpTopics.ts",
  "src/server/support/clientStatusGuide.ts",
  "src/server/support/tutorialVideos.ts",
];

test("os modulos de conteudo nao tocam Prisma, rede ou automacao", () => {
  for (const path of PURE_MODULES) {
    const code = codeOnly(readFileSync(path, "utf8"));
    assert.doesNotMatch(code, /@prisma\/client|getPrisma/, `${path}: sem Prisma`);
    assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, `${path}: sem rede/URL`);
    assert.doesNotMatch(code, /process\.env/, `${path}: sem env`);
    assert.doesNotMatch(code, /phase9|PHASE9|automation/i, `${path}: sem automacao/Fase 9`);
  }
});

test("o glossario de status nao reusa os enums persistidos (sem mudanca de schema)", () => {
  const code = codeOnly(readFileSync("src/server/support/clientStatusGuide.ts", "utf8"));
  assert.doesNotMatch(code, /InternalStatus|OperationalStatus|UserFacingStatus/);
});
