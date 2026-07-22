/**
 * Contrato do upload por tipo — verificacao ESTATICA do codigo-fonte.
 *
 * O service depende de Prisma e do storage adapter, que este suite nao sobe.
 * Em vez de simular a infra, garantimos as propriedades que nao podem regredir:
 * o tipo escolhido no card chega ao banco, e o modulo continua sem OCR/IA e sem
 * enviar o documento para fora. Falha se alguem reintroduzir esse comportamento.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const SERVICE = readFileSync("src/server/services/uploadProcessDocument.ts", "utf8");
const ACTION = readFileSync("src/app/(user)/processos/[id]/actions.ts", "utf8");
const PANEL = readFileSync("src/components/documents/DocumentIntakePanel.tsx", "utf8");
const REPOSITORY = readFileSync("src/server/repositories/processDocumentRepository.ts", "utf8");

/**
 * Remove comentarios: os arquivos DECLARAM "sem OCR/IA, sem Gov.br" em prosa, e
 * so o codigo executavel interessa para esta garantia.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o service aceita o tipo e o grava no documento", () => {
  assert.match(SERVICE, /kind: DocumentKind/, "assinatura recebe o tipo do documento");
  assert.match(SERVICE, /type: toPrismaDocumentType\(kind\)/, "o tipo vai para o createDocument");
});

test("o repositório aceita o tipo em vez de forçar o default", () => {
  assert.match(REPOSITORY, /type\?: DocumentType/);
  assert.doesNotMatch(
    REPOSITORY,
    /type usa o default/,
    "o tipo nao pode mais ser fixado em IDENTIFICACAO_PESSOAL",
  );
});

test("a action valida o tipo recebido do formulário", () => {
  assert.match(ACTION, /formData\.get\("documentKind"\)/);
  assert.match(ACTION, /isDocumentKind/, "valor de formulario nunca vai cru para o service");
});

test("cada card envia o próprio tipo, sem upload paralelo", () => {
  assert.match(PANEL, /name="documentKind"/, "o card envia o tipo junto do arquivo");
  assert.match(PANEL, /uploadAction/, "reutiliza a action existente, nao cria outra");
});

test("nenhum envio externo, OCR ou IA no caminho do upload", () => {
  for (const [name, source] of Object.entries({ SERVICE, ACTION, PANEL })) {
    const code = codeOnly(source);
    assert.doesNotMatch(code, /\bfetch\(/, `${name} nao faz requisicao externa`);
    assert.doesNotMatch(code, /gov\.br|sinarm/i, `${name} nao acessa Gov.br/SINARM`);
    assert.doesNotMatch(code, /\bocr\b|openai|anthropic/i, `${name} nao faz OCR/IA real`);
  }
});
