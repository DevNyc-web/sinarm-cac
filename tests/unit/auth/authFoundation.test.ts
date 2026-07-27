/**
 * Fundacao de auth — travas que NAO precisam de banco.
 *
 * Cobrem os tres pontos onde a fundacao pode quebrar em silencio:
 * (1) um perfil de cliente ganhar permissao interna por acidente;
 * (2) o enum `Role` do Prisma divergir de `roles.ts`;
 * (3) o seed deixar de criar algum id que a FK `processes.user_id` espera.
 *
 * Teste de ISOLAMENTO entre clientes (o caso negativo do IDOR) exige banco e
 * fica para o PR de auth real — registrado de proposito, para nao passar a
 * impressao de que autorizacao esta coberta por estes tres.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MOCK_USERS, SEEDED_USER_IDS } from "../../../src/server/auth/mockUsers";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../../../src/server/auth/permissions";
import { ROLES, USER_ROLE, INTERNAL_ROLES } from "../../../src/server/auth/roles";

// ------------------------------------------------------------------- 1. RBAC

test("USER (cliente) nao tem NENHUMA permissao interna", () => {
  assert.deepEqual(
    ROLE_PERMISSIONS[USER_ROLE],
    [],
    "cliente com permissao interna daria acesso a fila/PII de terceiros",
  );
});

test("todo perfil interno tem ao menos uma permissao, e nenhuma inventada", () => {
  for (const role of INTERNAL_ROLES) {
    const granted = ROLE_PERMISSIONS[role];
    assert.ok(granted.length > 0, `${role} sem permissao nenhuma nao consegue operar`);
    for (const permission of granted) {
      assert.ok(
        (PERMISSIONS as readonly string[]).includes(permission),
        `${role} tem permissao desconhecida: ${permission}`,
      );
    }
  }
});

test("segregacao de funcoes: quem executa nao libera pagamento, e vice-versa", () => {
  // docs/11 §3 — a matriz existe para impedir que um perfil feche o ciclo sozinho.
  assert.equal(ROLE_PERMISSIONS.OPERADOR.includes("payment.pix.confirm"), false);
  assert.equal(ROLE_PERMISSIONS.OPERADOR.includes("refund.approve"), false);
  assert.equal(ROLE_PERMISSIONS.FINANCEIRO.includes("sinarm.execute"), false);
  assert.equal(ROLE_PERMISSIONS.FINANCEIRO.includes("gru.generate"), false);
});

// -------------------------------------------------- 2. paridade Prisma x app

/** Le o enum `Role` direto do schema — sem depender do client gerado. */
function prismaRoleEnumValues(): string[] {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const match = schema.match(/enum\s+Role\s*\{([^}]*)\}/);
  assert.ok(match, "enum Role nao encontrado em prisma/schema.prisma");
  return (match[1] ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z_]+$/.test(line));
}

test("enum Role do Prisma e roles.ts declaram exatamente os mesmos perfis", () => {
  // Divergencia aqui e insidiosa: o app aceitaria um papel que o banco recusa
  // (erro em runtime) ou o banco aceitaria um papel sem permissao mapeada.
  assert.deepEqual([...prismaRoleEnumValues()].sort(), [...ROLES].sort());
});

test("todo perfil do enum tem entrada na matriz de permissoes", () => {
  for (const role of prismaRoleEnumValues()) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role),
      `${role} existe no banco mas nao tem permissoes mapeadas`,
    );
  }
});

// -------------------------------------------------------------- 3. ids do seed

test("o seed declara exatamente os cinco ids esperados", () => {
  assert.deepEqual([...SEEDED_USER_IDS].sort(), [
    "mock-admin",
    "mock-financeiro",
    "mock-operador",
    "mock-suporte",
    "mock-user",
  ]);
});

test("prisma/seed.ts semeia usuarios ANTES do processo de demo", () => {
  // Ordem importa: `processes.user_id` tem FK para `users`. Semear o processo
  // primeiro quebra a restricao e derruba o seed inteiro.
  const seed = readFileSync("prisma/seed.ts", "utf8");
  const userUpsert = seed.indexOf("prisma.user.upsert");
  const processUpsert = seed.indexOf("prisma.process.upsert");

  assert.ok(userUpsert >= 0, "o seed precisa criar usuarios");
  assert.ok(processUpsert >= 0, "o seed precisa criar o processo de demo");
  assert.ok(userUpsert < processUpsert, "usuarios devem ser semeados antes dos processos");
});

test("o seed usa os ids literais dos mocks, e nao ids gerados", () => {
  // Se o seed passar a gerar uuid, o cookie de sessao existente e o
  // GT-DEMO-001 (userId: "mock-user") deixam de resolver.
  const seed = readFileSync("prisma/seed.ts", "utf8");
  assert.match(seed, /id:\s*user\.id/, "o upsert deve fixar o id vindo de MOCK_USERS");
  assert.match(seed, /userId:\s*"mock-user"/, "o processo de demo aponta para o id literal");
});

// ------------------------------------------- 4. fallback estatico da sessao

/** Isola o corpo de `resolveUser` em `session.ts`. */
function resolveUserSource(): { tryBlock: string; catchBlock: string } {
  const source = readFileSync("src/server/auth/session.ts", "utf8");
  const start = source.indexOf("async function resolveUser");
  assert.ok(start >= 0, "resolveUser nao encontrada em session.ts");

  // Da assinatura ate a primeira chave de fechamento na coluna 0.
  const end = source.indexOf("\n}", start);
  assert.ok(end > start, "nao consegui delimitar o corpo de resolveUser");
  const body = source.slice(start, end);

  const split = body.indexOf("} catch");
  assert.ok(split > 0, "resolveUser precisa ter try/catch");
  return { tryBlock: body.slice(0, split), catchBlock: body.slice(split) };
}

/**
 * Teste ESTRUTURAL, nao comportamental: `resolveUser` nao e exportada e depende
 * de banco + contexto de request, entao nao da para exercita-la sem Postgres.
 * O que se trava aqui e a FORMA do controle — suficiente para pegar a regressao
 * especifica que este teste existe para impedir.
 */
test("o fallback estatico so vale quando o BANCO FALHA, nunca quando responde null", () => {
  const { tryBlock, catchBlock } = resolveUserSource();

  // O caminho feliz devolve o resultado do banco DIRETO. Um `if (user) return user`
  // seguido de fallback fora do catch faria `null` (usuario inexistente ou
  // active=false) cair na lista estatica — ressuscitando quem foi desativado.
  assert.match(tryBlock, /return\s+await\s+findUserById/, "o try deve retornar o banco direto");
  assert.doesNotMatch(
    tryBlock,
    /findMockUser/,
    "findMockUser no try faria o banco responder null virar acesso concedido",
  );

  // O fallback existe, mas so no catch e so em modo mock.
  assert.match(catchBlock, /findMockUser/, "o catch deve ter o fallback de indisponibilidade");
  assert.match(catchBlock, /AUTH_MODE\s*===\s*"mock"/, "o fallback deve ser restrito ao modo mock");
});

test("session.ts nao tem fallback estatico fora do catch", () => {
  // Rede mais ampla: qualquer uso de findMockUser fora do bloco catch reabre o
  // mesmo buraco por outro caminho.
  const source = readFileSync("src/server/auth/session.ts", "utf8");
  const usos = source.split(/\r?\n/).filter((line) => /findMockUser\s*\(/.test(line));
  assert.equal(usos.length, 1, `findMockUser deveria ser chamada 1x, encontrei ${usos.length}`);

  const { catchBlock } = resolveUserSource();
  assert.ok(catchBlock.includes(usos[0]?.trim() ?? ""), "a unica chamada deve estar no catch");
});

test("nenhum usuario de seed carrega dado real ou campo de credencial", () => {
  // Regra permanente (docs/00 §8): sem PII real. E esta fase nao tem senha.
  for (const user of MOCK_USERS) {
    assert.match(user.email, /@example\.com$/, `${user.id} deve usar dominio de exemplo`);
    assert.equal(
      Object.prototype.hasOwnProperty.call(user, "password"),
      false,
      "AuthUser nao pode carregar senha",
    );
    assert.equal(Object.prototype.hasOwnProperty.call(user, "passwordHash"), false);
  }

  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const userModel = schema.match(/model\s+User\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(userModel, /password|senha|token|secret/i, "User nao tem campo de credencial");
});
