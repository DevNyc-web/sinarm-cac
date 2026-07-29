/**
 * Acionamento MANUAL de extracao pelo painel admin (PR #47D-3A).
 *
 * LIMITE HONESTO: estes testes sao ESTATICOS, e isso e deliberado. Server
 * actions do Next dependem de `redirect()` (que funciona lancando),
 * `revalidatePath` e de uma sessao real — exercita-las de verdade exigiria subir
 * o framework, que e o territorio do e2e. O que se prova aqui e a FORMA: que a
 * permissao e exigida antes de qualquer trabalho, que a acao nao alcanca o que
 * nao deve, que o log respeita a allowlist e que o `redirect` esta fora do
 * `try`. E o mesmo criterio de `automationQueueSubmission.test.ts`.
 *
 * Sem OCR, sem rede, sem agendamento, sem Fase 9.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
} from "../../../src/server/auth/permissions";

const ACTION = "src/app/(admin)/admin/extracao/actions.ts";
const PAGE = "src/app/(admin)/admin/extracao/page.tsx";

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const actionSource = readFileSync(ACTION, "utf8");
const actionCode = codeOnly(actionSource);
const pageSource = readFileSync(PAGE, "utf8");
const pageCode = codeOnly(pageSource);

/** Corpo de uma das duas actions, isolado. */
function corpoDaAction(nome: string): string {
  return actionCode.match(new RegExp(`export async function ${nome}[\\s\\S]*?\\n}`))?.[0] ?? "";
}

const BATCH = corpoDaAction("runExtractionBatchAction");
const REAP = corpoDaAction("runExtractionReapAction");
const ENQUEUE = corpoDaAction("enqueueExtractionsAction");

/* ------------------------------------------------------------ existencia --- */

test("os dois arquivos do painel existem", () => {
  assert.ok(existsSync(ACTION));
  assert.ok(existsSync(PAGE));
  assert.ok(BATCH, "runExtractionBatchAction precisa existir");
  assert.ok(REAP, "runExtractionReapAction precisa existir");
  assert.ok(ENQUEUE, "enqueueExtractionsAction precisa existir");
});

/* ------------------------------------------------------------------ RBAC --- */

test("extraction.run existe na matriz e tem rotulo", () => {
  assert.ok((PERMISSIONS as readonly string[]).includes("extraction.run"));
  assert.ok(PERMISSION_LABELS["extraction.run"]);
});

test("ADMIN e OPERADOR podem acionar; FINANCEIRO, SUPORTE e USER nao", () => {
  assert.equal(ROLE_PERMISSIONS.ADMIN.includes("extraction.run"), true);
  assert.equal(ROLE_PERMISSIONS.OPERADOR.includes("extraction.run"), true);
  assert.equal(ROLE_PERMISSIONS.FINANCEIRO.includes("extraction.run"), false);
  assert.equal(ROLE_PERMISSIONS.SUPORTE.includes("extraction.run"), false);
  assert.equal(ROLE_PERMISSIONS.USER.includes("extraction.run"), false);
});

test("as duas actions exigem extraction.run", () => {
  for (const [nome, corpo] of [
    ["batch", BATCH],
    ["reap", REAP],
    ["enqueue", ENQUEUE],
  ] as const) {
    assert.match(corpo, /requirePermission\("extraction\.run"\)/, `${nome}: guard ausente`);
  }
});

test("a permissao e exigida ANTES de acionar qualquer coisa", () => {
  // Ordem importa: um guard depois do trabalho autorizaria a execucao e so
  // depois recusaria a resposta — o efeito ja teria acontecido.
  for (const [nome, corpo, runner] of [
    ["batch", BATCH, "runExtractionWorkerOnce"],
    ["reap", REAP, "runExtractionReaperOnce"],
    ["enqueue", ENQUEUE, "enqueueDocumentExtractions"],
  ] as const) {
    const guard = corpo.indexOf("requirePermission");
    const trabalho = corpo.indexOf(runner);
    assert.ok(guard >= 0 && trabalho >= 0, `${nome}: guard e runner precisam existir`);
    assert.ok(guard < trabalho, `${nome}: a permissao tem de vir antes da execucao`);
  }
});

test("a pagina tambem protege a rota, nao so a acao", () => {
  // Sem isto, um perfil sem permissao veria a tela e os botoes, e so descobriria
  // a recusa ao clicar.
  assert.match(pageCode, /requirePermission\("extraction\.run"\)/);
});

/* -------------------------------------------------- o que a action aciona --- */

test("a action do lote chama runExtractionWorkerOnce", () => {
  assert.match(BATCH, /runExtractionWorkerOnce\(\)/);
});

test("a action da limpeza chama runExtractionReaperOnce", () => {
  assert.match(REAP, /runExtractionReaperOnce\(\)/);
});

test("nenhuma action alcanca a execucao, a reserva ou a engine direto", () => {
  // Quem decide a reserva continua sendo quem executa, dentro do lote. Chamar
  // qualquer um destes aqui criaria um segundo dono da mesma regra.
  for (const proibido of [
    "runDocumentExtraction",
    "claimPendingExtraction",
    "getExtractionEngine",
    "mockExtractionEngine",
    "requestDocumentExtraction",
    "failStaleProcessingExtractions",
  ]) {
    assert.doesNotMatch(actionCode, new RegExp(proibido), `action nao pode usar ${proibido}`);
  }
});

test("nenhuma action le documentId — nem do formData", () => {
  assert.doesNotMatch(actionCode, /documentId/, "a acao e global; documento nao entra aqui");
  assert.doesNotMatch(
    actionCode,
    /formData\.get|_formData\.get/,
    "o formulario nao carrega parametro: recebe-lo e ignora-lo e a garantia",
  );
});

test("a action nao cria tentativas PENDENTE", () => {
  // Criar fila e o #47D-3B. Aqui so se processa o que ja existe.
  assert.doesNotMatch(actionCode, /createPendingExtraction|PENDENTE/);
});

/* ------------------------------------------------- redirect e query string --- */

test("redirect fica FORA do try — senao o catch o engoliria", () => {
  // `redirect()` funciona LANCANDO NEXT_REDIRECT. Dentro do bloco protegido, o
  // `catch` o capturaria e a acao terminaria sem navegar, em silencio.
  for (const [nome, corpo] of [
    ["batch", BATCH],
    ["reap", REAP],
    ["enqueue", ENQUEUE],
  ] as const) {
    const fimDoCatch = corpo.lastIndexOf("}");
    const redirectPos = corpo.indexOf("redirect(destino)");
    const catchPos = corpo.indexOf("} catch {");
    assert.ok(redirectPos > catchPos, `${nome}: redirect precisa vir depois do catch`);
    assert.ok(redirectPos < fimDoCatch, `${nome}: redirect dentro da funcao`);

    // E o `try` nao pode conter a chamada de redirect.
    const blocoTry = corpo.slice(corpo.indexOf("try {"), catchPos);
    assert.doesNotMatch(blocoTry, /redirect\(/, `${nome}: redirect dentro do try`);
  }
});

test("todo catch e SEM binding — erro bruto nao existe como variavel", () => {
  assert.doesNotMatch(actionCode, /catch\s*\(/);
  assert.equal((actionCode.match(/\} catch \{/g) ?? []).length, 3, "uma por action");
});

test("a query string carrega apenas contagens, duracao e literais fechados", () => {
  const chaves = [...actionCode.matchAll(/params\.set\("(\w+)"|acao=(\w+)|(\w+)=1/g)]
    .flatMap((m) => [m[1], m[2], m[3]])
    .filter(Boolean);

  const permitidas = ["acao", "lote", "limpeza", "fila", "erro"];
  for (const chave of chaves) {
    assert.ok(permitidas.includes(chave!), `literal inesperado na URL: ${chave}`);
  }

  // Os numeros entram por objeto, entao a trava e sobre o que NAO pode aparecer.
  for (const proibido of ["documentId", "extractionId", "filename", "storageKey", "email", "cpf"]) {
    assert.doesNotMatch(actionCode, new RegExp(`${proibido}[^\\w]*[:=]`, "i"), `URL/log com ${proibido}`);
  }
  assert.match(actionCode, /Math\.trunc/, "numeros da URL sao truncados, nunca texto livre");
});

/* --------------------------------------------------------------- log --- */

const EVENTOS = [
  "extraction_worker_manual_triggered",
  "extraction_worker_manual_failed",
  "extraction_reaper_manual_triggered",
  "extraction_reaper_manual_failed",
  "extraction_enqueue_manual_triggered",
  "extraction_enqueue_manual_failed",
] as const;

const PAYLOAD_PERMITIDO = [
  "event",
  "actorId",
  "actorRole",
  "candidates",
  "requested",
  "reused",
  "scanned",
  "processed",
  "skipped",
  "failed",
  "reaped",
  "reasonCode",
  "durationMs",
];

test("os quatro eventos aprovados existem, e nenhum a mais", () => {
  const encontrados = [...actionCode.matchAll(/event: "([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(encontrados)].sort(), [...EVENTOS].sort());
});

test("todo ponto de log passa por satisfies OpsLogPayload", () => {
  const sitios = (actionCode.match(/logger\.(info|warn)\(/g) ?? []).length;
  const tipados = (actionCode.match(/satisfies OpsLogPayload/g) ?? []).length;
  assert.equal(sitios, tipados, "log sem o tipo escaparia da allowlist do compilador");
  assert.equal(sitios, 6, "sucesso e falha, para lote, limpeza e fila");
});

test("o tipo do payload E a allowlist — nada fora dela", () => {
  const tipo = actionCode.match(/type OpsLogPayload = \{[\s\S]*?\n\};/)?.[0] ?? "";
  assert.ok(tipo, "OpsLogPayload precisa existir");

  const chaves = [...tipo.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
  assert.deepEqual(chaves.sort(), [...PAYLOAD_PERMITIDO].sort());
  assert.match(tipo, /reasonCode\?: ExtractionFailureReason/, "motivo vem do conjunto fechado");
  assert.match(tipo, /actorRole: Role/, "papel vem do enum, nao string livre");
});

test("todo evento registra autoria", () => {
  // Acionamento manual sem autor e acionamento sem responsavel.
  const blocos = [...actionCode.matchAll(/\{\s*event: "[a-z_]+",[\s\S]*?\} satisfies OpsLogPayload/g)];
  assert.equal(blocos.length, 6);
  for (const [bloco] of blocos) {
    assert.match(bloco, /actorId: actor\.id/, "actorId ausente");
    assert.match(bloco, /actorRole: actor\.role/, "actorRole ausente");
  }
});

test("nenhum log carrega PII ou identificador de cliente/documento", () => {
  for (const proibido of [
    "clientId",
    "documentId",
    "extractionId",
    "fields",
    "rawOcrText",
    "storageKey",
    "filename",
    "actor.email",
    "actor.name",
  ]) {
    assert.doesNotMatch(actionCode, new RegExp(proibido.replace(".", "\\.")), `log com ${proibido}`);
  }
});

/* ------------------------------------------------------------- a pagina --- */

test("a pagina NAO importa o lote nem a varredura — so as actions", () => {
  assert.doesNotMatch(pageSource, /documentExtractionWorker|runExtractionWorkerOnce/);
  assert.doesNotMatch(pageSource, /documentExtractionReaper|runExtractionReaperOnce/);
  assert.match(pageCode, /from "\.\/actions"/, "a pagina fala com a action");
});

test("a pagina nao mostra documento, tentativa nem conteudo", () => {
  for (const proibido of ["documentId", "extractionId", "fields", "storageKey", "filename"]) {
    assert.doesNotMatch(pageCode, new RegExp(proibido), `a tela nao pode exibir ${proibido}`);
  }
});

test("a pagina coage searchParams para numero — nunca renderiza texto da URL", () => {
  // A URL e controlavel por quem acessa e a pagina EXIBE o que vem dela.
  assert.match(pageCode, /Number\(/, "coercao explicita");
  assert.match(pageCode, /Number\.isFinite/, "NaN e descartado");
  assert.match(pageCode, /Math\.trunc/, "so inteiro chega ao render");
});

test("a pagina tem os TRES formularios e explica que enfileirar nao processa", () => {
  assert.equal((pageSource.match(/<form action=/g) ?? []).length, 3);
  assert.match(pageCode, /enqueueExtractionsAction/, "o form de fila aponta para a action");
  assert.match(pageSource, /N[aã]o processa automaticamente/i, "criar fila nao processa");
  assert.match(pageSource, /Processar fila de extra/i, "aponta o proximo passo");
});

test("a action de fila nao recebe limite do cliente", () => {
  // Limite vindo de formulario ou URL seria entrada nao validada num caminho que
  // CRIA linhas. A constante e de servidor.
  assert.match(ENQUEUE, /enqueueDocumentExtractions\(\)/, "chamada sem argumento");
  assert.doesNotMatch(ENQUEUE, /ENQUEUE_BATCH_SIZE|limit/, "a action nao decide o limite");
});

test("a action de fila nao alcanca repositorio, lote nem varredura", () => {
  for (const proibido of [
    "listDocumentsAwaitingExtraction",
    "listActiveExtractionDocumentIds",
    "runExtractionWorkerOnce",
    "runExtractionReaperOnce",
    "requestDocumentExtraction",
  ]) {
    assert.doesNotMatch(ENQUEUE, new RegExp(proibido), `enqueue nao pode usar ${proibido}`);
  }
});

test("a pagina avisa que e manual, mock, sem OCR e sem orgao publico", () => {
  // O texto e parte da garantia: sem ele, a tela sugere automacao que nao existe.
  assert.match(pageSource, /mock/i);
  assert.match(pageSource, /manual/i);
  assert.match(pageSource, /n[aã]o cria/i, "precisa dizer que nao enfileira nada");
  assert.match(pageSource, /0/, "precisa dizer que resultado zero e esperado");
});

test("nenhum arquivo novo e client component", () => {
  for (const source of [actionSource, pageSource]) {
    assert.doesNotMatch(source, /"use client"/);
  }
  assert.match(actionSource, /^"use server";/, "a action precisa ser server action");
});

/* -------------------------------------------------- escopo proibido --- */

test("os arquivos novos nao fazem rede, OCR real, storage nem Fase 9", () => {
  for (const [nome, code] of [
    ["action", actionCode],
    ["page", pageCode],
  ] as const) {
    assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, `${nome}: sem rede`);
    assert.doesNotMatch(code, /\b(tesseract|openai|anthropic|textract|rekognition)/i, `${nome}: sem OCR/IA`);
    assert.doesNotMatch(code, /phase9|PHASE9/i, `${nome}: sem Fase 9`);
    assert.doesNotMatch(code, /storageKey|getStorageAdapter|readFile/, `${nome}: sem storage/arquivo`);
    assert.doesNotMatch(code, /getEnv|process\.env/, `${nome}: sem variavel de ambiente`);
  }
});

test("nada no acionamento alcanca orgao publico — e a tela DIZ isso", () => {
  // A action nao tem texto de tela: ali o termo nao pode aparecer de forma
  // alguma.
  assert.doesNotMatch(actionCode, /gov\.?br|sinarm|policia federal/i, "action: sem orgao publico");

  // A PAGINA e o caso oposto, e a distincao importa: ela precisa AFIRMAR que
  // nada e consultado no Gov.br/SINARM/PF — essa frase e a transparencia exigida
  // do produto, nao uma violacao. Proibir o termo no arquivo apagaria justamente
  // o aviso. O que se trava aqui e o USO tecnico: nenhum import, modulo ou
  // identificador com esses nomes.
  const imports = pageCode.match(/^import .*$/gm) ?? [];
  for (const linha of imports) {
    assert.doesNotMatch(linha, /gov|sinarm|federal/i, `import suspeito: ${linha}`);
  }
  assert.doesNotMatch(pageCode, /(gov\.?br|sinarm)\s*[.(=]/i, "termo usado como codigo, nao como texto");
  assert.match(pageSource, /Gov\.br/, "a tela precisa declarar que nao consulta o orgao");
});

test("os arquivos novos nao agendam nada", () => {
  for (const code of [actionCode, pageCode]) {
    assert.doesNotMatch(code, /setInterval|setTimeout|cron|schedule/i);
  }
});

test("package.json roda este arquivo em test:documents:unit", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.match(
    pkg.scripts["test:documents:unit"],
    /tests\/unit\/documents\/extractionOpsAction\.test\.ts/,
  );
});
