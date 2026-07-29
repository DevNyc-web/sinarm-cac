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
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
} from "../../../src/server/auth/permissions";
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

test("extraction.run existe na matriz e tem rotulo", () => {
  assert.ok(
    (PERMISSIONS as readonly string[]).includes("extraction.run"),
    "acionar extracao e permissao propria, nao carona de outra",
  );
  assert.ok(PERMISSION_LABELS["extraction.run"], "permissao sem rotulo nao aparece no painel");
});

test("so ADMIN e OPERADOR podem acionar extracao", () => {
  // Quem opera a fila aciona o lote. FINANCEIRO cuida de dinheiro e SUPORTE le —
  // dar execucao a eles quebraria a mesma segregacao do teste acima.
  assert.equal(ROLE_PERMISSIONS.ADMIN.includes("extraction.run"), true);
  assert.equal(ROLE_PERMISSIONS.OPERADOR.includes("extraction.run"), true);
  assert.equal(ROLE_PERMISSIONS.FINANCEIRO.includes("extraction.run"), false);
  assert.equal(ROLE_PERMISSIONS.SUPORTE.includes("extraction.run"), false);
  assert.equal(ROLE_PERMISSIONS.USER.includes("extraction.run"), false);
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

const SESSION_SOURCE = () => readFileSync("src/server/auth/session.ts", "utf8");

/** Isola o corpo de uma funcao de `session.ts` pelo nome. */
function corpoDaFuncao(nome: string): string {
  const source = SESSION_SOURCE();
  const start = source.indexOf(`async function ${nome}`);
  assert.ok(start >= 0, `${nome} nao encontrada em session.ts`);
  const end = source.indexOf("\n}", start);
  assert.ok(end > start, `nao consegui delimitar o corpo de ${nome}`);
  return source.slice(start, end);
}

/**
 * Testes ESTRUTURAIS, nao comportamentais: estas funcoes nao sao exportadas e
 * dependem de banco + contexto de request, entao nao ha como exercita-las sem
 * Postgres. O que se trava e a FORMA do controle — suficiente para pegar as
 * regressoes especificas que estes testes existem para impedir.
 */
test("o fallback estatico so vale quando o BANCO FALHA, nunca quando responde null", () => {
  const corpo = corpoDaFuncao("resolveMockUser");
  const split = corpo.indexOf("} catch");
  assert.ok(split > 0, "resolveMockUser precisa ter try/catch");
  const tryBlock = corpo.slice(0, split);
  const catchBlock = corpo.slice(split);

  // O caminho feliz devolve o resultado do banco DIRETO. Um `if (user) return user`
  // seguido de fallback fora do catch faria `null` (usuario inexistente ou
  // active=false) cair na lista estatica — ressuscitando quem foi desativado.
  assert.match(tryBlock, /return\s+await\s+findUserById/, "o try deve retornar o banco direto");
  assert.doesNotMatch(
    tryBlock,
    /findMockUser/,
    "findMockUser no try faria o banco responder null virar acesso concedido",
  );
  assert.match(catchBlock, /findMockUser/, "o catch deve ter o fallback de indisponibilidade");
});

test("o caminho do modo REAL nao encosta no fallback mock", () => {
  // A regressao mais grave possivel aqui: modo real caindo em usuario ficticio.
  const real = corpoDaFuncao("resolveRealUser");
  assert.doesNotMatch(real, /findMockUser|MOCK_USERS/, "modo real nao pode usar lista estatica");
  assert.match(real, /parseSessionCookie/, "modo real valida o HMAC antes de tudo");

  const inicio = corpoDaFuncao("startRealSession");
  assert.doesNotMatch(inicio, /findMockUser|MOCK_USERS/);
  assert.match(inicio, /assertSessionSecret/, "sem segredo, o modo real nao inicia sessao");
});

test("signInAsMockUser recusa em modo real", () => {
  // O atalho sem senha nao pode existir quando o produto esta em modo real.
  const corpo = corpoDaFuncao("signInAsMockUser");
  assert.match(corpo, /isMockAuth\(\)/, "precisa checar o modo");
  assert.match(corpo, /if\s*\(!isMockAuth\(\)\)\s*return false/, "e recusar cedo");
});

test("os dois modos usam cookies de nomes diferentes", () => {
  // Nome compartilhado permitiria um cookie de um modo ser lido pelo outro.
  const source = SESSION_SOURCE();
  assert.match(source, /SESSION_COOKIE = "cac_mock_session"/);
  assert.match(source, /REAL_SESSION_COOKIE = "cac_session"/);
});

test("o cookie de sessao e httpOnly, sameSite=lax e secure em producao", () => {
  const source = SESSION_SOURCE();
  assert.match(source, /httpOnly:\s*true/);
  assert.match(source, /sameSite:\s*"lax"/);
  assert.match(source, /secure:\s*process\.env\.NODE_ENV === "production"/);
});

test("logout revoga a sessao no banco antes de limpar o cookie", () => {
  const corpo = corpoDaFuncao("signOut");
  assert.match(corpo, /revokeSession/, "logout sem revogacao deixaria o token valido");
  assert.match(corpo, /store\.delete\(REAL_SESSION_COOKIE\)/);
  assert.match(corpo, /store\.delete\(SESSION_COOKIE\)/);
});

test("session.ts nao tem fallback estatico fora do catch do modo mock", () => {
  // Rede mais ampla: qualquer uso de findMockUser fora daquele catch reabre o
  // mesmo buraco por outro caminho — inclusive no modo real.
  const usos = SESSION_SOURCE()
    .split(/\r?\n/)
    .filter((line) => /findMockUser\s*\(/.test(line));
  assert.equal(usos.length, 1, `findMockUser deveria ser chamada 1x, encontrei ${usos.length}`);

  const corpo = corpoDaFuncao("resolveMockUser");
  const catchBlock = corpo.slice(corpo.indexOf("} catch"));
  assert.ok(
    catchBlock.includes(usos[0]?.trim() ?? ""),
    "a unica chamada deve estar no catch de resolveMockUser",
  );
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

});

test("o hash mora no BANCO, nunca no tipo que o app enxerga", () => {
  // O `User` do banco TEM `password_hash` (senha do produto). O que nao pode e
  // esse campo atravessar a fronteira: `AuthUser` e o DTO de saida.
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const userModel = schema.match(/model\s+User\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(userModel, /passwordHash\s+String\?/, "o hash e nullable no banco");

  const types = readFileSync("src/server/auth/types.ts", "utf8");
  const authUser = types.match(/export type AuthUser = \{([\s\S]*?)\}/)?.[1] ?? "";
  assert.ok(authUser.length > 0, "AuthUser nao encontrado em types.ts");
  assert.doesNotMatch(
    authUser,
    /password|senha|hash|token|secret/i,
    "AuthUser nao pode carregar credencial",
  );
});

test("nenhuma credencial de Gov.br/SINARM e modelada", () => {
  // Regra permanente (docs/00 §8). A senha deste produto e nossa; a do orgao
  // nao pode nem existir como campo.
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  for (const proibido of [/govbr[a-z]*password/i, /govbr[a-z]*token/i, /otp/i, /sinarm[a-z]*senha/i]) {
    assert.doesNotMatch(schema, proibido, `o schema nao pode ter ${proibido}`);
  }
});
