/**
 * Separacao de entrada CLIENTE x EQUIPE — bloco D do docs/61.
 *
 * Cobre os cinco criterios como COMPORTAMENTO OBSERVAVEL, sem subir Next, sem
 * DOM, sem banco:
 *  D.1 entradas distintas          -> rotas e roteamento por perfil
 *  D.2 cliente sem nav/linguagem interna -> copy do `/login` e do Header
 *  D.3 equipe nao passa pela jornada do cliente -> destino e porta de saida
 *  D.4 separacao visual NAO substitui permissao -> RBAC intacto
 *  D.5 sem regressao              -> o que ja valia continua valendo
 *
 * As paginas sao Server Components async: em vez de renderiza-las, o teste le o
 * FONTE e checa as marcas de copy/estrutura. E o mesmo criterio usado em
 * `helpSections.test.ts` para o que nao da para montar sem runtime do Next.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  destinationFor,
  entryPathFor,
  originEntryPath,
} from "../../../src/server/auth/entryPaths";
import { INTERNAL_ROLES, USER_ROLE, isInternalRole } from "../../../src/server/auth/roles";
import { MOCK_USERS } from "../../../src/server/auth/mockUsers";
import { ROLE_PERMISSIONS } from "../../../src/server/auth/permissions";

const loginSource = readFileSync("src/app/(public)/login/page.tsx", "utf8");
const equipeSource = readFileSync("src/app/(public)/equipe/page.tsx", "utf8");
const headerSource = readFileSync("src/components/Header.tsx", "utf8");
const actionsSource = readFileSync("src/app/(public)/login/actions.ts", "utf8");

/**
 * Fonte SEM comentarios, para as asserções de AUSENCIA.
 *
 * Sem isto o teste castiga comentario bom: explicar "o `/admin` continua barrado
 * por `requireAdminRole`" faria falhar um "esta pagina nao chama
 * `requireAdminRole`". Ausencia se afirma sobre CODIGO, nao sobre prosa.
 *
 * `//` so vira comentario quando nao esta precedido de `:` — preserva `https://`.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const loginCode = codeOf(loginSource);
const equipeCode = codeOf(equipeSource);
const actionsCode = codeOf(actionsSource);

// ---------------------------------------------------------------- D.1
test("D.1: existe uma entrada propria da equipe, separada da do cliente", () => {
  assert.ok(equipeSource.includes("Acesso da equipe"));
  // Nao e a mesma tela com outro titulo: a do cliente fala de conta do cliente.
  assert.ok(loginSource.includes("Entrar na sua conta"));
  assert.ok(!equipeSource.includes("Entrar na sua conta</h1>"));
});

test("D.1: cada perfil vai para o seu destino depois de entrar", () => {
  assert.equal(destinationFor(USER_ROLE), "/dashboard");
  for (const role of INTERNAL_ROLES) {
    assert.equal(destinationFor(role), "/admin");
  }
});

test("D.1: a entrada da equipe reusa a Server Action do login (sem auth paralela)", () => {
  assert.ok(equipeSource.includes("signInWithPasswordAction"));
  assert.ok(equipeSource.includes('from "../login/actions"'));
});

// ---------------------------------------------------------------- D.2
test("D.2: a entrada do cliente nao usa vocabulario interno", () => {
  for (const termo of ["Admin", "admin", "painel interno", "gestor", "Financeiro", "Operador"]) {
    assert.ok(
      !loginCode.includes(`>${termo}`),
      `"${termo}" nao deve aparecer como texto na entrada do cliente`,
    );
  }
});

test("D.2: o atalho de dev do cliente lista SO perfil de cliente", () => {
  assert.ok(loginCode.includes("CLIENT_MOCK_USERS"));
  assert.ok(!loginCode.includes("{MOCK_USERS.map"));
  const clientes = MOCK_USERS.filter((u) => !isInternalRole(u.role));
  assert.equal(clientes.length, 1);
  assert.equal(clientes[0]?.role, USER_ROLE);
});

test("D.2: o atalho de dev da equipe lista SO perfis internos", () => {
  assert.ok(equipeSource.includes("INTERNAL_MOCK_USERS"));
  const internos = MOCK_USERS.filter((u) => isInternalRole(u.role));
  assert.equal(internos.length, INTERNAL_ROLES.length);
});

test("D.2: o Header so mostra o link admin para perfil interno", () => {
  assert.ok(headerSource.includes("isInternalRole(user.role)"));
  // O link /admin fica atras da checagem, nao solto no JSX.
  const idx = headerSource.indexOf('href="/admin"');
  assert.ok(idx > 0);
  assert.ok(headerSource.lastIndexOf("isInternalRole(user.role)", idx) > 0);
});

// ---------------------------------------------------------------- D.3
test("D.3: a equipe nao entra pela jornada do cliente — sem cadastro na tela dela", () => {
  assert.ok(!equipeCode.includes("/cadastro"));
  assert.ok(!equipeCode.includes("Criar minha conta"));
  // E o cliente continua tendo o caminho dele.
  assert.ok(loginCode.includes("/cadastro"));
});

test("D.3: logout devolve cada perfil a sua propria porta", () => {
  assert.equal(entryPathFor(USER_ROLE), "/login");
  for (const role of INTERNAL_ROLES) {
    assert.equal(entryPathFor(role), "/equipe");
  }
  // A action le o perfil ANTES de encerrar a sessao.
  assert.ok(actionsCode.includes("getCurrentUser()"));
  assert.ok(actionsCode.indexOf("getCurrentUser()") < actionsCode.indexOf("await signOut()"));
});

test("D.3: erro de login volta para a MESMA porta de origem", () => {
  assert.equal(originEntryPath("equipe"), "/equipe");
  assert.equal(originEntryPath(undefined), "/login");
  assert.equal(originEntryPath(""), "/login");
  assert.ok(equipeSource.includes('name="origem"'));
});

test("D.3: `origem` e allowlist — nao vira open redirect", () => {
  for (const hostil of ["https://evil.example", "//evil.example", "/admin", "../../etc", 42, null]) {
    assert.equal(originEntryPath(hostil), "/login", `origem hostil: ${String(hostil)}`);
  }
});

// ---------------------------------------------------------------- D.4
test("D.4: a separacao e visual — o cliente continua sem permissao interna", () => {
  assert.deepEqual(ROLE_PERMISSIONS[USER_ROLE], []);
});

test("D.4: a entrada da equipe nao concede nada por si", () => {
  // A pagina nao chama guard que promova perfil, e nao abre sessao sozinha.
  assert.ok(!equipeCode.includes("requireAdminRole"));
  assert.ok(!equipeCode.includes("requirePermission"));
  assert.ok(!equipeCode.includes("startRealSession"));
  // E deixa registrado, no proprio arquivo, que autorizacao continua server-side.
  assert.ok(/autoriza[cç][aã]o segue server-side/i.test(equipeSource));
});

test("D.4: entryPaths e roteamento, nao autorizacao", () => {
  const source = readFileSync("src/server/auth/entryPaths.ts", "utf8");
  assert.ok(/N[AÃ]O AUTORIZA[CÇ][AÃ]O/i.test(source));
});

// ---------------------------------------------------------------- D.5
test("D.5: nenhuma regra de perfil ficou duplicada por id de usuario", () => {
  // O destino sai da regra de perfil, nao de comparacao com id literal.
  assert.ok(!actionsCode.includes('userId === "mock-user"'));
  assert.ok(actionsCode.includes("destinationFor("));
});

test("D.5: o aviso permanente sobre o Gov.br continua na entrada do cliente", () => {
  assert.ok(loginSource.includes("não é o Gov.br"));
  assert.ok(loginSource.includes("/ajuda#gov-br"));
});

test("D.5: a entrada do cliente mantem a ajuda e o cadastro", () => {
  assert.ok(loginSource.includes("/ajuda"));
  assert.ok(loginSource.includes("Criar minha conta"));
});

test("D.5: o link para a equipe existe e e discreto na tela do cliente", () => {
  assert.ok(loginSource.includes('href="/equipe"'));
  assert.ok(loginSource.includes("Acesso da equipe"));
});
