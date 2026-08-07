/**
 * Fase 2 — lifecycle da sessao sintetica (docs/74) sobre o contrato (docs/73).
 *
 * O lifecycle precisa: aplicar so as 14 transicoes permitidas, emitir os 9
 * eventos com estado anterior e novo, nunca produzir protocolo em falha, nunca
 * deixar `BLOCKED` avancar, nunca reabrir terminal e nunca mutar a entrada.
 * Todos os dados aqui sao FICTICIOS.
 *
 * Sobre "CPF": os testes usam sequencias com FORMATO de CPF apenas para provar
 * que a trava dispara. Nenhuma delas e um CPF real — e o ponto do teste e
 * exatamente que o valor seja RECUSADO.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SYNTHETIC_HANDOFF_STATES,
  SYNTHETIC_TERMINAL_STATES,
  SYNTHETIC_TRANSITIONS,
  type SyntheticHandoffState,
} from "../../../src/server/automation/synthetic/sessionContract";
import {
  SYNTHETIC_FAILURE_KINDS,
  SYNTHETIC_LAB_EVENTS,
  applySyntheticTransition,
  createSyntheticSession,
  recordSyntheticStep,
  type SyntheticFailureKind,
  type SyntheticLifecycleResult,
} from "../../../src/server/automation/synthetic/sessionLifecycle";

const SOURCE_PATH = "src/server/automation/synthetic/sessionLifecycle.ts";

const EMITIDO = "2026-08-06T10:00:00.000Z";
const DURANTE = "2026-08-06T10:05:00.000Z";
const EXPIRA = "2026-08-06T10:10:00.000Z";
const DEPOIS = "2026-08-06T10:30:00.000Z";

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionHandle: "sh_lab_0001",
    processId: "proc-lab-0001",
    actorId: "actor-lab-0001",
    scope: ["LAB_GUIA_TRAFEGO_SYNTHETIC"],
    expiresAt: EXPIRA,
    issuedAt: EMITIDO,
    environment: "synthetic",
    consentMarker: "consent-sintetico-0001",
    handoffState: "CREATED",
    auditCorrelationId: "corr-lab-0001",
    allowedSyntheticProcessCode: "PROT-FICT-0001",
    ...overrides,
  };
}

/** Sessao num estado especifico, para exercitar transicoes isoladas. */
function at(state: SyntheticHandoffState): Record<string, unknown> {
  return session({ handoffState: state });
}

function codes(result: SyntheticLifecycleResult): string[] {
  return result.violations.map((v) => v.code);
}

/** Nome de etapa sintética reusado nos testes que entram em execução. */
const PRIMEIRA_ETAPA = "selecionar servico sintetico";

/** Argumento extra que cada destino exige para ser aceito. */
function extrasFor(to: SyntheticHandoffState): Record<string, unknown> {
  if (to === "FAILED") return { failure: "TIMEOUT" as SyntheticFailureKind };
  if (to === "EXPIRED") return { at: DEPOIS };
  // Entrar em execução exige a primeira etapa concreta, na mesma operação.
  if (to === "IN_PROGRESS") return { step: PRIMEIRA_ETAPA };
  return {};
}

// ------------------------------------------------------------------ criacao

test("createSyntheticSession emite synthetic_session_created com previousState null", () => {
  const result = createSyntheticSession(session(), "handoff sintético emitido");

  assert.equal(result.ok, true);
  assert.equal(result.previousState, null);
  assert.equal(result.nextState, "CREATED");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]?.event, "synthetic_session_created");
  assert.equal(result.events[0]?.previousState, null);
  assert.equal(result.events[0]?.nextState, "CREATED");
  // O instante da criacao E o issuedAt: nao ha relogio separado a injetar.
  assert.equal(result.events[0]?.timestamp, EMITIDO);
  assert.equal(result.syntheticProtocol, null);
});

test("createSyntheticSession recusa sessão que não nasce em CREATED", () => {
  assert.deepEqual(codes(createSyntheticSession(at("IN_PROGRESS"))), ["INVALID_STATE"]);
});

test("createSyntheticSession propaga as violações do contrato", () => {
  assert.deepEqual(codes(createSyntheticSession(session({ environment: "production" }))), [
    "INVALID_ENVIRONMENT",
  ]);
});

// --------------------------------------------- 1. cada transição permitida

/**
 * Percorre a tabela §7 do docs/74 a partir da fonte de verdade, e nao de uma
 * copia: se alguem adicionar uma transicao ao contrato sem pensar, ela aparece
 * aqui automaticamente.
 */
for (const [from, targets] of Object.entries(SYNTHETIC_TRANSITIONS)) {
  for (const to of targets) {
    test(`aplica a transição permitida ${from} -> ${to}`, () => {
      const extras = extrasFor(to);
      const result = applySyntheticTransition({
        session: at(from as SyntheticHandoffState),
        to,
        at: DURANTE,
        reason: "cenário sintético",
        ...extras,
      });

      assert.equal(result.ok, true, `esperava sucesso, veio ${codes(result).join(", ")}`);
      assert.equal(result.previousState, from);
      assert.equal(result.nextState, to);
      assert.equal(result.session?.handoffState, to);
      assert.equal(result.events.length, 1);
    });
  }
}

test("as 14 transições permitidas do docs/74 §7 estão todas cobertas", () => {
  const total = Object.values(SYNTHETIC_TRANSITIONS).reduce((sum, list) => sum + list.length, 0);
  assert.equal(total, 14);
});

// -------------------------------------------- 2. tabela completa de proibidas

test("toda transição fora da tabela §7 é rejeitada, sem exceção", () => {
  for (const from of SYNTHETIC_HANDOFF_STATES) {
    for (const to of SYNTHETIC_HANDOFF_STATES) {
      if (SYNTHETIC_TRANSITIONS[from].includes(to)) continue;

      const result = applySyntheticTransition({
        session: at(from),
        to,
        at: DURANTE,
        reason: "tentativa",
        ...extrasFor(to),
      });

      assert.equal(result.ok, false, `${from} -> ${to} deveria ser rejeitada`);
      assert.equal(result.events.length, 0, `${from} -> ${to} não pode emitir evento`);
      assert.equal(result.nextState, null);
    }
  }
});

test("estado de destino desconhecido é rejeitado", () => {
  const result = applySyntheticTransition({ session: at("CREATED"), to: "PAUSED", at: DURANTE });

  assert.deepEqual(codes(result), ["INVALID_STATE"]);
  assert.equal(result.events.length, 0);
});

// ------------------------------------------------ 3. estado anterior e novo

test("todo evento carrega o par estado anterior + estado novo", () => {
  const result = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "COMPLETED",
    at: DURANTE,
  });

  assert.equal(result.events[0]?.previousState, "IN_PROGRESS");
  assert.equal(result.events[0]?.nextState, "COMPLETED");
});

// ------------------------------------------------------ 4/5. eventos e ordem

test("cada estado alcançado emite o evento do docs/74 §12", () => {
  const esperado: Array<[SyntheticHandoffState, SyntheticHandoffState, string]> = [
    ["CREATED", "CLAIMED", "synthetic_session_claimed"],
    ["CLAIMED", "IN_PROGRESS", "synthetic_session_step_started"],
    ["IN_PROGRESS", "COMPLETED", "synthetic_session_completed"],
    ["IN_PROGRESS", "BLOCKED", "synthetic_session_blocked_by_captcha"],
    ["IN_PROGRESS", "CANCELLED", "synthetic_session_cancelled"],
  ];

  for (const [from, to, event] of esperado) {
    const result = applySyntheticTransition({
      session: at(from),
      to,
      at: DURANTE,
      ...extrasFor(to),
    });
    assert.equal(result.events[0]?.event, event, `${from} -> ${to}`);
  }

  assert.equal(
    applySyntheticTransition({
      session: at("IN_PROGRESS"),
      to: "FAILED",
      at: DURANTE,
      failure: "TIMEOUT",
    }).events[0]?.event,
    "synthetic_session_failed",
  );
  assert.equal(
    applySyntheticTransition({ session: at("IN_PROGRESS"), to: "EXPIRED", at: DEPOIS }).events[0]
      ?.event,
    "synthetic_session_expired",
  );
});

test("os 9 eventos do docs/73 §7 são exatamente estes — sem evento novo", () => {
  assert.equal(SYNTHETIC_LAB_EVENTS.length, 9);
  assert.deepEqual([...SYNTHETIC_LAB_EVENTS].sort(), [
    "synthetic_session_blocked_by_captcha",
    "synthetic_session_cancelled",
    "synthetic_session_claimed",
    "synthetic_session_completed",
    "synthetic_session_created",
    "synthetic_session_expired",
    "synthetic_session_failed",
    "synthetic_session_step_completed",
    "synthetic_session_step_started",
  ]);
});

test("a ordem dos eventos reproduz a jornada — mesma sequência, mesma trilha", () => {
  const criada = createSyntheticSession(session());
  const reivindicada = applySyntheticTransition({
    session: criada.session,
    to: "CLAIMED",
    at: EMITIDO,
  });
  const executando = applySyntheticTransition({
    session: reivindicada.session,
    to: "IN_PROGRESS",
    at: DURANTE,
    step: "selecionar servico",
  });
  const etapa = recordSyntheticStep({
    session: executando.session,
    step: "revisar dados",
    phase: "COMPLETED",
    at: DURANTE,
  });
  const concluida = applySyntheticTransition({
    session: etapa.session,
    to: "COMPLETED",
    at: DURANTE,
    syntheticProtocol: "PROT-FICT-0001",
  });

  const trilha = [criada, reivindicada, executando, etapa, concluida].flatMap((r) => r.events);

  assert.deepEqual(
    trilha.map((e) => e.event),
    [
      "synthetic_session_created",
      "synthetic_session_claimed",
      "synthetic_session_step_started",
      "synthetic_session_step_completed",
      "synthetic_session_completed",
    ],
  );
  // Lendo em ordem, a maquina inteira e reproduzivel (docs/74 §12).
  assert.deepEqual(
    trilha.map((e) => `${e.previousState}->${e.nextState}`),
    [
      "null->CREATED",
      "CREATED->CLAIMED",
      "CLAIMED->IN_PROGRESS",
      "IN_PROGRESS->IN_PROGRESS",
      "IN_PROGRESS->COMPLETED",
    ],
  );
});

// --------------------------------------------------- 6/7. correlação e ids

test("preserva auditCorrelationId, processId e actorId em todo evento", () => {
  for (const result of [
    createSyntheticSession(session()),
    applySyntheticTransition({ session: at("CREATED"), to: "CLAIMED", at: DURANTE }),
    recordSyntheticStep({
      session: at("IN_PROGRESS"),
      step: "revisar",
      phase: "STARTED",
      at: DURANTE,
    }),
  ]) {
    assert.equal(result.events[0]?.auditCorrelationId, "corr-lab-0001");
    assert.equal(result.events[0]?.processId, "proc-lab-0001");
    assert.equal(result.events[0]?.actorId, "actor-lab-0001");
  }
});

test("nenhum evento carrega o sessionHandle — a correlação é pelo auditCorrelationId", () => {
  const result = applySyntheticTransition({ session: at("CREATED"), to: "CLAIMED", at: DURANTE });
  const serializado = JSON.stringify(result.events);

  assert.equal(serializado.includes("sh_lab_0001"), false);
  assert.equal(serializado.includes("sessionHandle"), false);
  assert.ok(serializado.includes("corr-lab-0001"));
});

// ----------------------------------------------------------- 8. imutabilidade

test("não muta o objeto de entrada", () => {
  const entrada = at("CREATED");
  const copia = structuredClone(entrada);

  applySyntheticTransition({ session: entrada, to: "CLAIMED", at: DURANTE });

  assert.deepEqual(entrada, copia, "a sessão de entrada foi mutada");
});

test("a sessão devolvida é outro objeto, e o scope também", () => {
  const entrada = at("CREATED");
  const result = applySyntheticTransition({ session: entrada, to: "CLAIMED", at: DURANTE });

  assert.notEqual(result.session, entrada);
  assert.notEqual(result.session?.scope, entrada.scope);
  assert.equal(entrada.handoffState, "CREATED");
  assert.equal(result.session?.handoffState, "CLAIMED");
});

test("transição proibida não altera o estado e devolve session null", () => {
  const entrada = at("COMPLETED");
  const copia = structuredClone(entrada);
  const result = applySyntheticTransition({ session: entrada, to: "IN_PROGRESS", at: DURANTE });

  assert.equal(result.session, null);
  assert.deepEqual(entrada, copia);
});

// --------------------------------------------------- 9. falha sem protocolo

test("falha nunca produz protocolo", () => {
  const result = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "FAILED",
    at: DURANTE,
    failure: "TIMEOUT",
    syntheticProtocol: "PROT-FICT-0001",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["PROTOCOL_NOT_ALLOWED"]);
  assert.equal(result.syntheticProtocol, null);
});

test("nenhum estado além de COMPLETED admite protocolo", () => {
  for (const to of ["BLOCKED", "CANCELLED", "EXPIRED"] as const) {
    const result = applySyntheticTransition({
      session: at("IN_PROGRESS"),
      to,
      at: to === "EXPIRED" ? DEPOIS : DURANTE,
      syntheticProtocol: "PROT-FICT-0001",
    });
    assert.ok(codes(result).includes("PROTOCOL_NOT_ALLOWED"), `${to} não pode aceitar protocolo`);
  }
});

test("COMPLETED aceita protocolo, mas só o sintético PROT-FICT-*", () => {
  const ok = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "COMPLETED",
    at: DURANTE,
    syntheticProtocol: "PROT-FICT-0001",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.syntheticProtocol, "PROT-FICT-0001");

  const recusado = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "COMPLETED",
    at: DURANTE,
    syntheticProtocol: "2026123456789",
  });
  assert.deepEqual(codes(recusado), ["PROTOCOL_NOT_ALLOWED"]);
});

test("COMPLETED sem protocolo continua válido", () => {
  const result = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "COMPLETED",
    at: DURANTE,
  });

  assert.equal(result.ok, true);
  assert.equal(result.syntheticProtocol, null);
});

// -------------------------------------------------- 10. BLOCKED sem avanço

test("BLOCKED não avança para COMPLETED nem IN_PROGRESS, com código próprio", () => {
  for (const to of ["COMPLETED", "IN_PROGRESS"] as const) {
    const result = applySyntheticTransition({
      session: at("BLOCKED"),
      to,
      at: DURANTE,
      ...extrasFor(to),
    });

    assert.equal(result.ok, false);
    assert.deepEqual(
      codes(result),
      ["BLOCKED_NO_FORWARD"],
      "o bloqueio merece código próprio, não um FORBIDDEN_TRANSITION genérico",
    );
    assert.equal(result.events.length, 0);
  }
});

test("BLOCKED sai para o lado e para trás — CANCELLED, FAILED, EXPIRED", () => {
  assert.equal(
    applySyntheticTransition({ session: at("BLOCKED"), to: "CANCELLED", at: DURANTE }).ok,
    true,
  );
  assert.equal(
    applySyntheticTransition({
      session: at("BLOCKED"),
      to: "FAILED",
      at: DURANTE,
      failure: "STEP_UNAVAILABLE",
    }).ok,
    true,
  );
  assert.equal(
    applySyntheticTransition({ session: at("BLOCKED"), to: "EXPIRED", at: DEPOIS }).ok,
    true,
  );
});

test("o bloqueio é o desfecho esperado, não uma falha do desenho", () => {
  const result = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "BLOCKED",
    at: DURANTE,
    reason: "captcha sintético — degrada para humano",
  });

  assert.equal(result.ok, true);
  assert.equal(result.events[0]?.event, "synthetic_session_blocked_by_captcha");
  assert.equal(result.nextState, "BLOCKED");
});

test("não existe atalho de desbloqueio: falha sintética não se aplica a BLOCKED", () => {
  const result = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "BLOCKED",
    at: DURANTE,
    failure: "TIMEOUT",
  });

  assert.deepEqual(codes(result), ["FAILURE_KIND_NOT_ALLOWED"]);
});

// -------------------------------------------------- 11. terminais fechados

test("terminal não reabre para nenhum dos 8 estados", () => {
  for (const from of SYNTHETIC_TERMINAL_STATES) {
    for (const to of SYNTHETIC_HANDOFF_STATES) {
      const result = applySyntheticTransition({
        session: at(from),
        to,
        at: DURANTE,
        ...extrasFor(to),
      });

      assert.equal(result.ok, false, `${from} -> ${to} deveria ser proibido`);
      assert.ok(
        codes(result).includes("TERMINAL_NO_REOPEN"),
        `${from} -> ${to} deveria acusar TERMINAL_NO_REOPEN`,
      );
      assert.equal(result.events.length, 0);
    }
  }
});

test("retry exige nova sessão: o mesmo handle não volta a executar", () => {
  const falhou = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "FAILED",
    at: DURANTE,
    failure: "TIMEOUT",
  });

  const retry = applySyntheticTransition({
    session: falhou.session,
    to: "IN_PROGRESS",
    at: DURANTE,
    step: PRIMEIRA_ETAPA,
  });

  assert.equal(retry.ok, false);
  assert.ok(codes(retry).includes("TERMINAL_NO_REOPEN"));
});

test("claim é único — segundo claim é falha, não substituição", () => {
  const result = applySyntheticTransition({ session: at("CLAIMED"), to: "CLAIMED", at: DURANTE });

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["FORBIDDEN_TRANSITION"]);
});

// --------------------------------------------------------------- 12/13/14/15

test("rejeita dado de produção — environment production não transita", () => {
  const result = applySyntheticTransition({
    session: session({ environment: "production" }),
    to: "CLAIMED",
    at: DURANTE,
  });

  assert.deepEqual(codes(result), ["INVALID_ENVIRONMENT"]);
  assert.equal(result.events.length, 0);
});

test("rejeita valor com formato de CPF no motivo do evento", () => {
  const result = applySyntheticTransition({
    session: at("CREATED"),
    to: "CLAIMED",
    at: DURANTE,
    reason: "solicitante 123.456.789-09",
  });

  assert.deepEqual(codes(result), ["CPF_LIKE_VALUE"]);
  assert.equal(result.alarm, true);
});

for (const payload of [
  '{"cookie":"abc123"}',
  '{"storageState":{}}',
  '{"token":"abc"}',
  "senha=abc",
  '{"otp":"123456"}',
]) {
  test(`rejeita credencial serializada no motivo: ${payload}`, () => {
    const result = applySyntheticTransition({
      session: at("CREATED"),
      to: "CLAIMED",
      at: DURANTE,
      reason: payload,
    });

    assert.equal(result.ok, false);
    assert.ok(codes(result).includes("SERIALIZED_SECRET"));
    assert.equal(result.alarm, true, "tentativa de credencial é alarme, não ruído");
  });
}

test("rejeita campo de credencial na sessão, com código de alarme", () => {
  const result = applySyntheticTransition({
    session: session({ cookie: "abc" }),
    to: "CLAIMED",
    at: DURANTE,
  });

  assert.deepEqual(codes(result), ["SUSPICIOUS_FIELD_NAME"]);
  assert.equal(result.alarm, true);
});

for (const host of ["https://gov.br/x", "https://servicos.pf.gov.br/y", "sinarm", "acesso.gov"]) {
  test(`rejeita host oficial no motivo do evento: ${host}`, () => {
    const result = applySyntheticTransition({
      session: at("CREATED"),
      to: "CLAIMED",
      at: DURANTE,
      reason: `tentou ${host}`,
    });

    assert.equal(result.ok, false);
    assert.ok(codes(result).includes("FORBIDDEN_HOST"));
    assert.equal(result.alarm, true);
  });
}

test("rejeita URL externa no nome da etapa", () => {
  const result = applySyntheticTransition({
    session: at("CLAIMED"),
    to: "IN_PROGRESS",
    at: DURANTE,
    step: "https://example.com/passo",
  });

  assert.ok(codes(result).includes("EXTERNAL_URL"));
  assert.equal(result.alarm, true);
});

test("aceita localhost — o laboratório é local", () => {
  const result = applySyntheticTransition({
    session: at("CLAIMED"),
    to: "IN_PROGRESS",
    at: DURANTE,
    step: PRIMEIRA_ETAPA,
    reason: "http://localhost:3000/admin/lab/guia-trafego",
  });

  assert.equal(result.ok, true);
});

// ------------------------------------- 16. inválida não emite evento algum

test("nenhuma transição inválida emite evento — nem de sucesso, nem de outro tipo", () => {
  const invalidas: SyntheticLifecycleResult[] = [
    applySyntheticTransition({ session: at("COMPLETED"), to: "IN_PROGRESS", at: DURANTE }),
    applySyntheticTransition({ session: at("BLOCKED"), to: "COMPLETED", at: DURANTE }),
    applySyntheticTransition({ session: at("CREATED"), to: "COMPLETED", at: DURANTE }),
    applySyntheticTransition({ session: session({ senha: "x" }), to: "CLAIMED", at: DURANTE }),
    applySyntheticTransition({ session: at("CREATED"), to: "CLAIMED", at: "06/08/2026" }),
  ];

  for (const result of invalidas) {
    assert.equal(result.ok, false);
    assert.deepEqual(result.events, []);
    assert.equal(result.nextState, null);
    assert.equal(result.session, null);
    assert.equal(result.syntheticProtocol, null);
  }
});

// ----------------------------------------------- 17. relógio injetado

test("o timestamp do evento é exatamente o instante injetado", () => {
  const result = applySyntheticTransition({ session: at("CREATED"), to: "CLAIMED", at: DURANTE });

  assert.equal(result.events[0]?.timestamp, DURANTE);
});

test("é determinístico — mesma entrada, mesmo resultado", () => {
  const input = { session: at("IN_PROGRESS"), to: "BLOCKED", at: DURANTE, reason: "captcha" };

  assert.deepEqual(applySyntheticTransition(input), applySyntheticTransition(input));
});

test("rejeita instante fora do ISO-8601", () => {
  assert.deepEqual(
    codes(applySyntheticTransition({ session: at("CREATED"), to: "CLAIMED", at: "ontem" })),
    ["INVALID_TIMESTAMP"],
  );
});

test("handle vencido só admite EXPIRED — sem renovação silenciosa", () => {
  const result = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "COMPLETED",
    at: DEPOIS,
  });

  assert.deepEqual(codes(result), ["SESSION_EXPIRED"]);
});

test("não se declara expirado antes do prazo", () => {
  assert.deepEqual(
    codes(applySyntheticTransition({ session: at("IN_PROGRESS"), to: "EXPIRED", at: DURANTE })),
    ["NOT_YET_EXPIRED"],
  );
});

test("a expiração vale no instante exato do expiresAt", () => {
  const result = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "EXPIRED",
    at: EXPIRA,
  });

  assert.equal(result.ok, true);
  assert.equal(result.events[0]?.event, "synthetic_session_expired");
});

// --------------------------------- 18. as 10 falhas sintéticas do docs/74 §11

test("as 10 falhas sintéticas estão declaradas", () => {
  assert.equal(SYNTHETIC_FAILURE_KINDS.length, 10);
});

for (const failure of SYNTHETIC_FAILURE_KINDS) {
  // 11.8: prazo nao e defeito — handle expirado termina em EXPIRED.
  const destino = failure === "HANDLE_EXPIRED" ? "EXPIRED" : "FAILED";
  const instante = destino === "EXPIRED" ? DEPOIS : DURANTE;

  test(`a falha ${failure} termina em ${destino}, sem protocolo`, () => {
    const result = applySyntheticTransition({
      session: at("IN_PROGRESS"),
      to: destino,
      at: instante,
      failure,
    });

    assert.equal(result.ok, true, `esperava sucesso, veio ${codes(result).join(", ")}`);
    assert.equal(result.nextState, destino);
    assert.equal(result.syntheticProtocol, null);
    assert.equal(
      result.events[0]?.event,
      destino === "EXPIRED" ? "synthetic_session_expired" : "synthetic_session_failed",
    );
  });
}

test("HANDLE_EXPIRED não pode ser classificada como FAILED — prazo não é defeito", () => {
  const result = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "FAILED",
    at: DURANTE,
    failure: "HANDLE_EXPIRED",
  });

  assert.deepEqual(codes(result), ["FAILURE_KIND_MISMATCH"]);
});

test("FAILED exige falha nomeada — sem balde de 'deu errado'", () => {
  assert.deepEqual(
    codes(applySyntheticTransition({ session: at("IN_PROGRESS"), to: "FAILED", at: DURANTE })),
    ["FAILURE_KIND_REQUIRED"],
  );
});

test("tentativa de credencial e de dado real são alarme; timeout não é", () => {
  const alarme = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "FAILED",
    at: DURANTE,
    failure: "REAL_CREDENTIAL_ATTEMPT",
  });
  const rotina = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "FAILED",
    at: DURANTE,
    failure: "TIMEOUT",
  });

  assert.equal(alarme.alarm, true);
  assert.equal(rotina.alarm, false);
});

test("o motivo do evento cai na falha quando não há texto próprio", () => {
  const result = applySyntheticTransition({
    session: at("IN_PROGRESS"),
    to: "FAILED",
    at: DURANTE,
    failure: "STEP_UNAVAILABLE",
  });

  assert.equal(result.events[0]?.reason, "STEP_UNAVAILABLE");
});

// ------------------------------------------------------------------ etapas

test("etapa emite o evento de etapa sem mover a sessão", () => {
  const entrada = at("IN_PROGRESS");
  const copia = structuredClone(entrada);
  const result = recordSyntheticStep({
    session: entrada,
    step: "revisar dados",
    phase: "STARTED",
    at: DURANTE,
  });

  assert.equal(result.ok, true);
  assert.equal(result.events[0]?.event, "synthetic_session_step_started");
  assert.equal(result.events[0]?.step, "revisar dados");
  assert.equal(result.previousState, "IN_PROGRESS");
  assert.equal(result.nextState, "IN_PROGRESS");
  assert.deepEqual(entrada, copia);
});

test("etapa concluída emite synthetic_session_step_completed", () => {
  const result = recordSyntheticStep({
    session: at("IN_PROGRESS"),
    step: "gerar GRU sintética",
    phase: "COMPLETED",
    at: DURANTE,
  });

  assert.equal(result.events[0]?.event, "synthetic_session_step_completed");
});

test("etapa exige a sessão em IN_PROGRESS", () => {
  for (const state of SYNTHETIC_HANDOFF_STATES) {
    if (state === "IN_PROGRESS") continue;

    const result = recordSyntheticStep({
      session: at(state),
      step: "revisar",
      phase: "STARTED",
      at: DURANTE,
    });

    assert.equal(result.ok, false, `etapa não pode rodar em ${state}`);
    assert.ok(codes(result).includes("STEP_REQUIRES_IN_PROGRESS"));
    assert.equal(result.events.length, 0);
  }
});

test("etapa para quando o handle vence no meio", () => {
  const result = recordSyntheticStep({
    session: at("IN_PROGRESS"),
    step: "revisar",
    phase: "STARTED",
    at: DEPOIS,
  });

  assert.ok(codes(result).includes("SESSION_EXPIRED"));
  assert.equal(result.events.length, 0);
});

test("etapa nunca produz protocolo", () => {
  const result = recordSyntheticStep({
    session: at("IN_PROGRESS"),
    step: "revisar",
    phase: "COMPLETED",
    at: DURANTE,
  });

  assert.equal(result.syntheticProtocol, null);
});

// ------------------------- entrada em IN_PROGRESS exige a primeira etapa

test("entrar em IN_PROGRESS sem a primeira etapa é rejeitado", () => {
  const result = applySyntheticTransition({
    session: at("CLAIMED"),
    to: "IN_PROGRESS",
    at: DURANTE,
  });

  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["FIRST_STEP_REQUIRED"]);
});

test("a recusa por falta de primeira etapa não altera a sessão nem emite evento", () => {
  const entrada = at("CLAIMED");
  const copia = structuredClone(entrada);
  const result = applySyntheticTransition({
    session: entrada,
    to: "IN_PROGRESS",
    at: DURANTE,
  });

  assert.deepEqual(result.events, []);
  assert.equal(result.session, null);
  assert.equal(result.nextState, null);
  assert.deepEqual(entrada, copia, "a sessão de entrada não pode mudar");
});

test("etapa vazia ou só espaços não conta como primeira etapa", () => {
  for (const step of ["", "   "]) {
    assert.deepEqual(
      codes(
        applySyntheticTransition({ session: at("CLAIMED"), to: "IN_PROGRESS", at: DURANTE, step }),
      ),
      ["FIRST_STEP_REQUIRED"],
      `step ${JSON.stringify(step)} deveria ser recusado`,
    );
  }
});

test("entrar em IN_PROGRESS com a primeira etapa emite exatamente UM step_started", () => {
  const result = applySyntheticTransition({
    session: at("CLAIMED"),
    to: "IN_PROGRESS",
    at: DURANTE,
    step: PRIMEIRA_ETAPA,
  });

  assert.equal(result.ok, true);
  assert.equal(result.events.length, 1, "uma operação, um evento");
  assert.equal(result.events[0]?.event, "synthetic_session_step_started");
  assert.equal(result.events[0]?.previousState, "CLAIMED");
  assert.equal(result.events[0]?.nextState, "IN_PROGRESS");
  assert.equal(result.events[0]?.step, PRIMEIRA_ETAPA);
  assert.equal(result.events[0]?.timestamp, DURANTE, "relógio injetado preservado");
  assert.equal(result.session?.handoffState, "IN_PROGRESS");
});

test("o evento da primeira etapa não carrega sessionHandle", () => {
  const result = applySyntheticTransition({
    session: at("CLAIMED"),
    to: "IN_PROGRESS",
    at: DURANTE,
    step: PRIMEIRA_ETAPA,
  });
  const serializado = JSON.stringify(result.events);

  assert.equal(serializado.includes("sh_lab_0001"), false);
  assert.equal(serializado.includes("sessionHandle"), false);
});

test("o nome da primeira etapa vai redigido para o evento", () => {
  const result = applySyntheticTransition({
    session: at("CLAIMED"),
    to: "IN_PROGRESS",
    at: DURANTE,
    step: "etapa do titular 123.456.789-09",
  });

  // Formato de CPF no nome da etapa é recusado antes de virar evento.
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes("CPF_LIKE_VALUE"));
  assert.deepEqual(result.events, []);
});

test("etapa posterior emite somente o evento da nova etapa", () => {
  const executando = applySyntheticTransition({
    session: at("CLAIMED"),
    to: "IN_PROGRESS",
    at: DURANTE,
    step: PRIMEIRA_ETAPA,
  });

  const seguinte = recordSyntheticStep({
    session: executando.session,
    step: "revisar dados",
    phase: "STARTED",
    at: DURANTE,
  });

  assert.equal(seguinte.events.length, 1);
  assert.equal(seguinte.events[0]?.step, "revisar dados");
  assert.notEqual(seguinte.events[0]?.step, PRIMEIRA_ETAPA);
});

test("a jornada não produz dois step_started para a mesma primeira etapa", () => {
  const executando = applySyntheticTransition({
    session: at("CLAIMED"),
    to: "IN_PROGRESS",
    at: DURANTE,
    step: PRIMEIRA_ETAPA,
  });
  const segunda = recordSyntheticStep({
    session: executando.session,
    step: "informar destino",
    phase: "STARTED",
    at: DURANTE,
  });
  const terceira = recordSyntheticStep({
    session: segunda.session,
    step: "informar destino",
    phase: "COMPLETED",
    at: DURANTE,
  });

  const iniciadas = [executando, segunda, terceira]
    .flatMap((r) => r.events)
    .filter((e) => e.event === "synthetic_session_step_started")
    .map((e) => e.step);

  assert.deepEqual(iniciadas, [PRIMEIRA_ETAPA, "informar destino"]);
  assert.equal(
    new Set(iniciadas).size,
    iniciadas.length,
    "nenhuma etapa pode aparecer duas vezes como iniciada",
  );
});

test("entrar em execução e registrar etapa preservam correlação e ids", () => {
  const executando = applySyntheticTransition({
    session: at("CLAIMED"),
    to: "IN_PROGRESS",
    at: DURANTE,
    step: PRIMEIRA_ETAPA,
  });
  const seguinte = recordSyntheticStep({
    session: executando.session,
    step: "revisar",
    phase: "COMPLETED",
    at: DURANTE,
  });

  for (const evento of [...executando.events, ...seguinte.events]) {
    assert.equal(evento.auditCorrelationId, "corr-lab-0001");
    assert.equal(evento.processId, "proc-lab-0001");
    assert.equal(evento.timestamp, DURANTE);
  }
});

// ------------------------------------------------------- provas estruturais

/**
 * Codigo sem comentarios. As travas abaixo valem para o que EXECUTA: um
 * comentario que cita `phase9/` ou `Date.now()` para explicar por que NAO os usa
 * nao pode derrubar o teste.
 */
function sourceCode(): string {
  return readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("o módulo não toca Phase 9, Prisma, rede nem I/O", () => {
  const code = sourceCode();

  for (const forbidden of [
    "phase9",
    "safety",
    "networkGuard",
    "@prisma/client",
    "node:fs",
    "playwright",
    "next/",
    "process.env",
    "fetch(",
    "PHASE9_REAL_EXECUTION_ENABLED",
  ]) {
    assert.equal(code.includes(forbidden), false, `não pode referenciar ${forbidden}`);
  }
});

test("o módulo não lê relógio nem sorteia — o instante é sempre injetado", () => {
  const code = sourceCode();

  assert.equal(code.includes("Date.now()"), false);
  assert.equal(code.includes("Math.random()"), false);
  assert.equal(code.includes("new Date()"), false);
});

test("o módulo não declara campo de credencial", () => {
  const code = sourceCode().toLowerCase();

  for (const forbidden of ["password:", "senha:", "otp:", "cookie:", "storagestate", "cpf:"]) {
    assert.equal(code.includes(forbidden), false, `não pode declarar ${forbidden}`);
  }
});

test("nenhuma aresta para execução real: só os 8 estados sintéticos existem", () => {
  const alcancaveis = new Set(Object.values(SYNTHETIC_TRANSITIONS).flat());
  for (const state of alcancaveis) {
    assert.ok(
      (SYNTHETIC_HANDOFF_STATES as readonly string[]).includes(state),
      `${state} não é um dos 8 estados sintéticos`,
    );
  }
});
