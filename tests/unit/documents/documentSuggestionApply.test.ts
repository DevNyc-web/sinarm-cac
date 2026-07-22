/**
 * Aplicacao manual de sugestao — testes da validacao pura.
 * Sem OCR, sem IA, sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  APPLICABLE_TARGETS,
  checkSuggestionApplication,
  isApplicableTarget,
  isNoOpSuggestion,
  isSuggestionApplicable,
} from "../../../src/server/documents/documentSuggestionApply";
import {
  PROCESS_FIELD_TARGETS,
  buildFieldSuggestions,
  type DocumentFieldSuggestion,
  type ProcessCurrentValues,
} from "../../../src/server/documents/documentFieldSuggestions";
import {
  buildExtractionReview,
  type ReviewDocument,
} from "../../../src/server/documents/documentExtractionReview";

function doc(partial: Partial<ReviewDocument> & Pick<ReviewDocument, "type">): ReviewDocument {
  return {
    id: "doc-1",
    originalFileName: "fake.pdf",
    status: "APROVADO",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    rejectionReason: null,
    ...partial,
  };
}

const DESTINO_ATUAL: ProcessCurrentValues = {
  destination: {
    eventName: "Clube Atual (exemplo)",
    uf: "AA",
    city: "Cidade Atual",
    street: "Rua Atual",
    number: "123",
  },
};

function suggestionsFor(
  type: ReviewDocument["type"],
  current: ProcessCurrentValues = DESTINO_ATUAL,
  status: ReviewDocument["status"] = "APROVADO",
) {
  return buildFieldSuggestions(buildExtractionReview([doc({ type, status })]), current);
}

function find(
  suggestions: readonly DocumentFieldSuggestion[],
  target: string,
): DocumentFieldSuggestion {
  const found = suggestions.find((s) => s.targetField === target);
  assert.ok(found, `sugestão para ${target} não encontrada`);
  return found;
}

test("a allowlist tem exatamente os cinco campos de destino", () => {
  assert.deepEqual(
    [...APPLICABLE_TARGETS],
    [
      "destination.name",
      "destination.uf",
      "destination.city",
      "destination.street",
      "destination.number",
    ],
  );
});

test("só destination.* é aplicável; todo o resto é recusado", () => {
  for (const target of PROCESS_FIELD_TARGETS) {
    assert.equal(isApplicableTarget(target), target.startsWith("destination."), target);
  }
});

test("CAMPO_FUTURO nunca é aplicável", () => {
  for (const type of ["IDENTIFICACAO_PESSOAL", "COMPROVANTE_ORIGEM_ENDERECO", "CR_REGISTRO_CAC"] as const) {
    for (const suggestion of suggestionsFor(type)) {
      assert.equal(suggestion.status, "CAMPO_FUTURO");
      const check = checkSuggestionApplication(suggestion);
      assert.equal(check.ok, false);
      assert.equal(check.ok === false && check.reason, "CAMPO_FUTURO");
      assert.equal(isSuggestionApplicable(suggestion), false);
    }
  }
});

test("sugestão inexistente é recusada", () => {
  const check = checkSuggestionApplication(undefined);
  assert.equal(check.ok, false);
  assert.equal(check.ok === false && check.reason, "NAO_ENCONTRADA");
});

test("documento não conferido não gera sugestão — logo, nada a aplicar", () => {
  for (const status of ["ENVIADO", "EM_ANALISE", "PENDENTE", "REJEITADO"] as const) {
    const suggestions = suggestionsFor("DECLARACAO_DESTINO_EVENTO", DESTINO_ATUAL, status);
    assert.deepEqual(suggestions, [], `status ${status}`);
  }
});

test("documento complementar não gera aplicação", () => {
  assert.deepEqual(suggestionsFor("OUTRO"), []);
});

test("patch tem só a coluna permitida, com o valor da sugestão", () => {
  const suggestions = suggestionsFor("DECLARACAO_DESTINO_EVENTO");

  const uf = checkSuggestionApplication(find(suggestions, "destination.uf"));
  assert.equal(uf.ok, true);
  assert.ok(uf.ok && Object.keys(uf.patch).length === 1, "patch toca uma única coluna");
  assert.deepEqual(uf.ok && uf.patch, { uf: "XX (exemplo)" });
  assert.equal(uf.ok && uf.previousValue, "AA");

  const name = checkSuggestionApplication(find(suggestions, "destination.name"));
  assert.deepEqual(name.ok && name.patch, { eventName: "Clube de Exemplo (fictício)" });
});

test("cada campo de destino mapeia para a coluna correta do Destination", () => {
  const suggestions = suggestionsFor("DECLARACAO_DESTINO_EVENTO");
  const colunaDe = (target: string) => {
    const check = checkSuggestionApplication(find(suggestions, target));
    return check.ok ? Object.keys(check.patch)[0] : null;
  };
  assert.equal(colunaDe("destination.name"), "eventName");
  assert.equal(colunaDe("destination.uf"), "uf");
  assert.equal(colunaDe("destination.city"), "city");
  assert.equal(colunaDe("destination.street"), "street");
  assert.equal(colunaDe("destination.number"), "number");
});

test("valor igual ao atual vira SEM_ALTERACAO e não é aplicável", () => {
  // O destino atual usa exatamente os valores que o mock sugere.
  const igual: ProcessCurrentValues = {
    destination: {
      eventName: "Clube de Exemplo (fictício)",
      uf: "XX (exemplo)",
      city: "Cidade Exemplo",
      street: "Avenida de Exemplo (fictício)",
      number: "000 (exemplo)",
    },
  };
  for (const suggestion of suggestionsFor("DECLARACAO_DESTINO_EVENTO", igual)) {
    assert.equal(isNoOpSuggestion(suggestion), true, suggestion.targetField);
    const check = checkSuggestionApplication(suggestion);
    assert.equal(check.ok, false);
    assert.equal(check.ok === false && check.reason, "SEM_ALTERACAO");
  }
});

test("invariantes de segurança da sugestão são exigidas na aplicação", () => {
  const base = find(suggestionsFor("DECLARACAO_DESTINO_EVENTO"), "destination.city");

  // Uma sugestão forjada que se diga aplicável sozinha é recusada.
  const forjadaAuto = { ...base, canApplyAutomatically: true } as unknown as DocumentFieldSuggestion;
  assert.equal(checkSuggestionApplication(forjadaAuto).ok, false);

  // Idem para uma que dispense confirmação humana.
  const forjadaSemHumano = {
    ...base,
    requiresHumanConfirmation: false,
  } as unknown as DocumentFieldSuggestion;
  assert.equal(checkSuggestionApplication(forjadaSemHumano).ok, false);
});

test("valor vazio ou só espaços não é aplicado", () => {
  const base = find(suggestionsFor("DECLARACAO_DESTINO_EVENTO"), "destination.city");
  for (const value of ["", "   "]) {
    const check = checkSuggestionApplication({ ...base, suggestedValue: value });
    assert.equal(check.ok, false);
    assert.equal(check.ok === false && check.reason, "VALOR_VAZIO");
  }
});

test("target fora da allowlist é recusado mesmo com status pronto", () => {
  const base = find(suggestionsFor("DECLARACAO_DESTINO_EVENTO"), "destination.city");
  const forjada = {
    ...base,
    targetField: "applicant.cpf",
    status: "PRONTA_PARA_REVISAO",
  } as unknown as DocumentFieldSuggestion;
  const check = checkSuggestionApplication(forjada);
  assert.equal(check.ok, false);
  assert.equal(check.ok === false && check.reason, "FORA_DA_ALLOWLIST");
});

/** Trava estatica do caminho de aplicacao. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("a aplicação não confia no valor enviado pelo cliente", () => {
  const action = codeOnly(readFileSync("src/app/(user)/processos/[id]/actions.ts", "utf8"));
  const panel = codeOnly(
    readFileSync("src/components/documents/DocumentFieldSuggestionsPanel.tsx", "utf8"),
  );
  const service = codeOnly(
    readFileSync("src/server/services/applyDestinationSuggestion.ts", "utf8"),
  );

  // O formulario so manda processo, id da sugestao e confirmacao.
  assert.doesNotMatch(panel, /name="suggestedValue"|name="targetField"|name="value"/);
  assert.match(panel, /name="suggestionId"/);
  assert.match(panel, /name="confirmacao"/);

  // A action nao le valor nem alvo do formulario.
  assert.doesNotMatch(action, /formData\.get\("suggestedValue"\)|formData\.get\("targetField"\)/);
  assert.match(action, /formData\.get\("suggestionId"\)/);
  assert.match(action, /formData\.get\("confirmacao"\)/);

  // O service regenera as sugestoes no servidor antes de aplicar.
  assert.match(service, /buildFieldSuggestions/);
  assert.match(service, /checkSuggestionApplication/);
  assert.match(service, /findProcessByIdForUser/, "confere o dono do processo");
});

test("aplicação exige confirmação humana explícita", () => {
  const service = codeOnly(
    readFileSync("src/server/services/applyDestinationSuggestion.ts", "utf8"),
  );
  assert.match(service, /if \(!confirmed\)/, "sem confirmacao, recusa antes de tudo");
});

test("update que não afeta nenhuma linha não vira sucesso nem histórico", () => {
  const service = readFileSync("src/server/services/applyDestinationSuggestion.ts", "utf8");
  const code = codeOnly(service);

  // O resultado do update precisa ser capturado e checado.
  assert.match(code, /const updated = await updateProcessDestination/);
  assert.match(code, /updated\.count === 0/, "count zero precisa ser tratado");

  // A checagem tem de vir ANTES de gravar a trilha: registrar uma aplicacao que
  // nao aconteceu poluiria a auditoria append-only para sempre.
  const guardIndex = code.indexOf("updated.count === 0");
  const eventIndex = code.indexOf("recordOperationalEvent({");
  assert.ok(guardIndex > 0 && eventIndex > 0, "guarda e evento devem existir");
  assert.ok(guardIndex < eventIndex, "a guarda de count precisa vir antes do evento");

  // E o retorno da guarda e erro, nao sucesso.
  const guardBlock = code.slice(guardIndex, eventIndex);
  assert.match(guardBlock, /ok: false/, "count zero retorna erro");
  assert.match(guardBlock, /destino ainda nao existem/i, "mensagem amigavel ao usuario");
  assert.doesNotMatch(guardBlock, /ok: true/, "count zero nunca retorna sucesso");
});

test("só existe um ponto de sucesso, depois da guarda", () => {
  const code = codeOnly(readFileSync("src/server/services/applyDestinationSuggestion.ts", "utf8"));
  // `return { ok: true` — a declaracao do tipo tambem contem "ok: true", por
  // isso contamos apenas os RETORNOS.
  const successes = code.match(/return \{ ok: true/g) ?? [];
  assert.equal(successes.length, 1, "um unico retorno de sucesso");
  assert.ok(
    code.indexOf("return { ok: true") > code.indexOf("updated.count === 0"),
    "o sucesso vem depois da guarda de count",
  );
});

test("caminho de aplicação não tem rede, OCR nem IA", () => {
  const files = [
    "src/server/documents/documentSuggestionApply.ts",
    "src/server/services/applyDestinationSuggestion.ts",
    "src/components/documents/DocumentFieldSuggestionsPanel.tsx",
  ];
  for (const file of files) {
    const code = codeOnly(readFileSync(file, "utf8"));
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, `${file} nao faz requisicao`);
    assert.doesNotMatch(code, /https?:\/\//, `${file} nao tem URL externa`);
    assert.doesNotMatch(
      code,
      /(?:import|require)[^;\n]*["'][^"']*(?:tesseract|ocr|openai|anthropic|vision)/i,
      `${file} nao importa OCR/IA`,
    );
  }
});

test("o domínio de validação não escreve no banco", () => {
  const code = codeOnly(readFileSync("src/server/documents/documentSuggestionApply.ts", "utf8"));
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "validacao e pura");
  assert.doesNotMatch(code, /\.update\(|\.create\(|\.upsert\(/);
});
