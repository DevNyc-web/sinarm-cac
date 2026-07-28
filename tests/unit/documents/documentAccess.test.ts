/**
 * Acesso ao arquivo do documento — autorizacao, Content-Type e Content-Disposition.
 *
 * A rota e fina de proposito: a regra testavel vive no helper puro, entao estes
 * testes cobrem a decisao sem banco, sem storage e sem HTTP.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DOCUMENT_FILE_PERMISSION,
  FALLBACK_MIME_TYPE,
  SERVABLE_MIME_TYPES,
  asciiDownloadFileName,
  buildDocumentFileHeaders,
  decideDocumentAccess,
  documentFileHref,
  safeContentType,
  safeDownloadFileName,
} from "../../../src/server/documents/documentAccess";
import { roleHasPermission } from "../../../src/server/auth/permissions";
import { INTERNAL_ROLES } from "../../../src/server/auth/roles";

const DONO = "user-dono";
const OUTRO = "user-outro";

/* ---------------------------------------------------------- autorizacao --- */

test("o dono do processo acessa o proprio documento", () => {
  const decision = decideDocumentAccess({
    actorId: DONO,
    actorRole: "USER",
    ownerUserId: DONO,
  });
  assert.deepEqual(decision, { allowed: true, as: "DONO" });
});

test("cliente NAO acessa documento de outro cliente", () => {
  const decision = decideDocumentAccess({
    actorId: OUTRO,
    actorRole: "USER",
    ownerUserId: DONO,
  });
  assert.deepEqual(decision, { allowed: false });
});

test("revisor autorizado acessa documento de qualquer processo", () => {
  const decision = decideDocumentAccess({
    actorId: "admin-1",
    actorRole: "ADMIN",
    ownerUserId: DONO,
  });
  assert.deepEqual(decision, { allowed: true, as: "REVISOR" });
});

test("perfil interno SEM a permissao de revisao nao acessa", () => {
  const semPermissao = INTERNAL_ROLES.filter(
    (role) => !roleHasPermission(role, DOCUMENT_FILE_PERMISSION),
  );
  assert.ok(semPermissao.length > 0, "o cenario precisa existir para o teste valer");
  for (const role of semPermissao) {
    assert.deepEqual(
      decideDocumentAccess({ actorId: "interno", actorRole: role, ownerUserId: DONO }),
      { allowed: false },
      `perfil ${role} nao deveria acessar`,
    );
  }
});

test("a permissao do arquivo e a MESMA de revisar o documento", () => {
  // Se divergirem, aparece botao que responde 404 (ou acesso sem direito a decidir).
  assert.equal(DOCUMENT_FILE_PERMISSION, "document.review");
});

/* ------------------------------------------------------------ Content-Type --- */

test("serve apenas os tipos da allowlist do upload", () => {
  for (const mime of SERVABLE_MIME_TYPES) {
    assert.equal(safeContentType(mime), mime);
  }
});

test("tipo inesperado vira octet-stream em vez de ser servido como veio", () => {
  for (const perigoso of ["text/html", "image/svg+xml", "application/javascript", ""]) {
    assert.equal(safeContentType(perigoso), FALLBACK_MIME_TYPE, `nao servir ${perigoso}`);
  }
});

/* --------------------------------------------------------------- filename --- */

test("remove CR/LF e controles do nome (header injection)", () => {
  const nome = safeDownloadFileName("doc\r\nSet-Cookie: a=b\u0000.pdf");
  assert.ok(!nome.includes("\r"), "sem CR");
  assert.ok(!nome.includes("\n"), "sem LF");
  assert.ok(!nome.includes("\u0000"), "sem NUL");
});

test("descarta diretorio e path traversal do nome", () => {
  assert.equal(safeDownloadFileName("../../etc/passwd"), "passwd");
  assert.equal(safeDownloadFileName("C:\\Users\\a\\segredo.pdf"), "segredo.pdf");
});

test("remove aspas e barra invertida que quebrariam o header", () => {
  const nome = safeDownloadFileName('a"b\\c.pdf');
  assert.ok(!nome.includes('"'), "sem aspas");
  assert.ok(!nome.includes("\\"), "sem barra invertida");
});

test("nome vazio ou so lixo vira um nome padrao", () => {
  assert.equal(safeDownloadFileName(""), "documento");
  assert.equal(safeDownloadFileName("///"), "documento");
  assert.equal(safeDownloadFileName("\r\n"), "documento");
});

test("nome muito longo e truncado", () => {
  assert.ok(safeDownloadFileName(`${"a".repeat(500)}.pdf`).length <= 100);
});

test("a versao ASCII troca acentos sem deixar aspas", () => {
  const ascii = asciiDownloadFileName("identificação.pdf");
  assert.ok(!/[^\u0020-\u007e]/.test(ascii), "so ASCII imprimivel");
  assert.ok(!ascii.includes('"'));
});

/* ---------------------------------------------------------------- headers --- */

function headers(over: Partial<Parameters<typeof buildDocumentFileHeaders>[0]> = {}) {
  return buildDocumentFileHeaders({
    mimeType: "application/pdf",
    originalFileName: "identificacao.pdf",
    byteLength: 1234,
    ...over,
  });
}

test("forca download e bloqueia sniffing/execucao", () => {
  const h = headers();
  assert.match(h["Content-Disposition"], /^attachment;/);
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.match(h["Content-Security-Policy"], /sandbox/);
});

test("nao deixa o documento em cache compartilhado", () => {
  assert.match(headers()["Cache-Control"], /no-store/);
  assert.equal(headers()["Referrer-Policy"], "no-referrer");
});

test("Content-Length usa o tamanho real dos bytes lidos", () => {
  assert.equal(headers({ byteLength: 42 })["Content-Length"], "42");
});

test("nenhum header contem CR/LF, mesmo com nome hostil", () => {
  const h = headers({ originalFileName: "x\r\nX-Injetado: 1.pdf" });
  for (const [nome, valor] of Object.entries(h)) {
    assert.ok(!/[\r\n]/.test(valor), `header ${nome} com quebra de linha`);
  }
});

test("nome com acento vai no filename* e o ASCII no filename legado", () => {
  const disposition = headers({ originalFileName: "identificação.pdf" })["Content-Disposition"];
  assert.match(disposition, /filename="[\u0020-\u007e]+"/, "filename legado so-ASCII");
  assert.match(disposition, /filename\*=UTF-8''/, "filename* presente");
  assert.ok(disposition.includes(encodeURIComponent("identificação.pdf")));
});

/* ------------------------------------------------------------------- href --- */

test("o href do arquivo e montado por uma fonte unica e escapa o id", () => {
  assert.equal(documentFileHref("abc-123"), "/api/documents/abc-123/file");
  assert.ok(!documentFileHref("a/b").includes("a/b"), "id e escapado");
});

/* ------------------------------------------------- travas estaticas da rota --- */

const ROUTE = "src/app/api/documents/[documentId]/file/route.ts";

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Codigo sem os `import` — ordem de chamada so faz sentido dentro do handler. */
function bodyOnly(source: string): string {
  return codeOnly(source).replace(/^import[\s\S]*?;$/gm, "");
}

test("a rota exige sessao antes de qualquer leitura", () => {
  const code = bodyOnly(readFileSync(ROUTE, "utf8"));
  assert.match(code, /getCurrentUser\(\)/, "a rota precisa ler a sessao");
  const sessao = code.indexOf("getCurrentUser()");
  const busca = code.indexOf("findDocumentById(");
  assert.ok(sessao !== -1 && busca > sessao, "a sessao e checada antes de buscar o documento");
  assert.match(code, /status:\s*401/, "sem sessao responde 401");
});

test("o storage so e tocado DEPOIS da decisao de autorizacao", () => {
  const code = bodyOnly(readFileSync(ROUTE, "utf8"));
  const decisao = code.indexOf("decideDocumentAccess(");
  const negativa = code.indexOf("decision.allowed");
  const storage = code.indexOf("getStorageAdapter()");
  assert.ok(decisao !== -1 && negativa > decisao, "a decisao precede a negativa");
  assert.ok(storage > negativa, "getStorageAdapter so apos autorizar");
});

test("nao autorizado e inexistente respondem a MESMA coisa (sem oraculo)", () => {
  const code = codeOnly(readFileSync(ROUTE, "utf8"));
  assert.match(code, /status:\s*404/, "usa 404");
  assert.ok(!/status:\s*403/.test(code), "403 revelaria que o documento existe");
});

test("a rota nao devolve storageKey nem caminho local", () => {
  const code = codeOnly(readFileSync(ROUTE, "utf8"));
  // storageKey so pode aparecer como argumento da leitura no storage.
  const usos = code.match(/storageKey/g) ?? [];
  assert.equal(usos.length, 1, "storageKey usado uma unica vez");
  assert.match(code, /get\(document\.storageKey\)/, "e apenas para ler os bytes");
  assert.doesNotMatch(code, /storage-local|process\.cwd|__dirname/, "sem caminho local");
});

test("a rota nao faz rede, OCR/IA, automacao, Fase 9 nem Gov.br/SINARM", () => {
  const code = codeOnly(readFileSync(ROUTE, "utf8"));
  assert.doesNotMatch(code, /\bfetch\(|https?:\/\//, "sem rede");
  assert.doesNotMatch(code, /phase9|PHASE9/i, "sem Fase 9");
  assert.doesNotMatch(code, /gov\.?br|sinarm/i, "sem Gov.br/SINARM");
  assert.doesNotMatch(code, /ocr|openai|anthropic/i, "sem OCR/IA");
});

test("as telas linkam pela fonte unica, sem montar URL na mao", () => {
  for (const tela of [
    "src/app/(admin)/admin/processos/[id]/page.tsx",
    "src/app/(user)/processos/[id]/page.tsx",
  ]) {
    const source = readFileSync(tela, "utf8");
    assert.ok(source.includes("documentFileHref("), `${tela} deve usar o helper`);
    assert.ok(!source.includes("storageKey"), `${tela} nao pode citar storageKey`);
    assert.ok(!/"\/api\/documents\//.test(source), `${tela} nao deve montar a URL na mao`);
  }
});

test("o link admin usa a MESMA permissao da rota", () => {
  const admin = readFileSync("src/app/(admin)/admin/processos/[id]/page.tsx", "utf8");
  assert.ok(
    admin.includes("hasPermission(admin, DOCUMENT_FILE_PERMISSION)"),
    "o link deve ser gated pela constante compartilhada, nao por string solta",
  );
});
