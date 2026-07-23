/**
 * Gate de envio para a fila de automacao — testes.
 * Elegibilidade PURA + montagem de snapshot + travas estaticas do servico/action.
 * Sem OCR, sem IA, sem rede, sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AUTOMATION_QUEUE_SUBMISSION_MARKER,
  checkAutomationQueueEligibility,
  wasSubmittedToAutomationQueue,
} from "../../../src/server/automation/automationQueueSubmission";
import {
  deriveAutomationReadiness,
  type AutomationReadiness,
} from "../../../src/server/automation/automationReadiness";
import {
  snapshotFromRow,
  type AutomationReadinessRow,
} from "../../../src/server/automation/automationReadinessInput";
import { GUIA_TRAFEGO_PROCESS_CODE } from "../../../src/server/documents/documentRequirements";
import type { DocumentStatus, DocumentType } from "@prisma/client";

function readiness(status: AutomationReadiness["status"]): AutomationReadiness {
  const blockers =
    status === "PRONTO_PARA_AUTOMACAO"
      ? []
      : [{ code: "PAGAMENTO_PENDENTE", label: "Pagamento pendente" }];
  return { status, label: "x", blockers, warnings: [], completed: [] };
}

const PRONTO = readiness("PRONTO_PARA_AUTOMACAO");
const NAO_PRONTO = readiness("NAO_PRONTO_PARA_AUTOMACAO");

test("sem confirmacao, recusa (nao importa a prontidao)", () => {
  const result = checkAutomationQueueEligibility(PRONTO, false, false);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "SEM_CONFIRMACAO");
});

test("processo nao pronto nao pode ser enviado, mesmo confirmado", () => {
  const result = checkAutomationQueueEligibility(NAO_PRONTO, true, false);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "NAO_PRONTO");
});

test("processo pronto e confirmado pode ser enviado", () => {
  const result = checkAutomationQueueEligibility(PRONTO, true, false);
  assert.equal(result.ok, true);
});

test("processo ja enviado nao envia de novo (idempotencia)", () => {
  const result = checkAutomationQueueEligibility(PRONTO, true, true);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "JA_ENVIADO");
});

test("wasSubmitted detecta o marcador por igualdade exata", () => {
  assert.equal(wasSubmittedToAutomationQueue([]), false);
  assert.equal(wasSubmittedToAutomationQueue([{ toValue: null }, { toValue: "Urgente" }]), false);
  assert.equal(
    wasSubmittedToAutomationQueue([{ toValue: AUTOMATION_QUEUE_SUBMISSION_MARKER }]),
    true,
  );
  // Nao casa com prefixo/substring — so valor exato.
  assert.equal(
    wasSubmittedToAutomationQueue([{ toValue: `${AUTOMATION_QUEUE_SUBMISSION_MARKER}_X` }]),
    false,
  );
});

function doc(type: DocumentType, status: DocumentStatus) {
  return { type, status, createdAt: new Date("2026-01-01T10:00:00Z") };
}

/** Linha "pronta" do banco; cada teste quebra so o que precisa. */
function readyRow(overrides: Partial<AutomationReadinessRow> = {}): AutomationReadinessRow {
  return {
    processType: { code: GUIA_TRAFEGO_PROCESS_CODE },
    destination: {
      eventName: "Clube (exemplo)",
      uf: "SP",
      city: "São Paulo",
      street: "Rua Exemplo",
      number: "10",
    },
    firearm: { id: "firearm-1" },
    documents: [doc("IDENTIFICACAO_PESSOAL", "APROVADO")],
    payments: [{ status: "PAGO" }],
    ...overrides,
  };
}

test("snapshotFromRow + deriveAutomationReadiness: linha completa fica PRONTA e elegivel", () => {
  const result = deriveAutomationReadiness(snapshotFromRow(readyRow()));
  assert.equal(result.status, "PRONTO_PARA_AUTOMACAO");
  assert.equal(checkAutomationQueueEligibility(result, true, false).ok, true);
});

test("snapshotFromRow: sem pagamento PAGO nao fica pronta e nao e elegivel", () => {
  const result = deriveAutomationReadiness(snapshotFromRow(readyRow({ payments: [] })));
  assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO");
  const eligibility = checkAutomationQueueEligibility(result, true, false);
  assert.equal(eligibility.ok, false);
  assert.equal(eligibility.ok === false && eligibility.reason, "NAO_PRONTO");
});

test("snapshotFromRow: sem arma/PCE nao fica pronta", () => {
  const result = deriveAutomationReadiness(snapshotFromRow(readyRow({ firearm: null })));
  assert.equal(result.status, "NAO_PRONTO_PARA_AUTOMACAO");
});

/** Remove comentarios para as travas estaticas nao casarem com texto de doc. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SERVICE = "src/server/services/submitToAutomationQueue.ts";
const ACTION = "src/app/(admin)/admin/processos/[id]/actions.ts";
const PURE_FILES = [
  "src/server/automation/automationQueueSubmission.ts",
  "src/server/automation/automationReadinessInput.ts",
];

test("o servico REGENERA a prontidao no servidor (nao confia no cliente)", () => {
  const code = codeOnly(readFileSync(SERVICE, "utf8"));
  assert.match(code, /deriveAutomationReadiness/, "deriva readiness no servidor");
  assert.match(code, /findProcessForAutomationReadiness/, "le o processo do banco");
});

test("a action so passa processId e confirmacao — nunca readiness/status/blockers", () => {
  const code = codeOnly(readFileSync(ACTION, "utf8"));
  assert.match(code, /submitToAutomationQueueAction/);
  assert.match(code, /requirePermission\("automation\.queue\.submit"\)/, "RBAC no guard");
  assert.match(code, /formData\.get\("processId"\)/);
  assert.match(code, /formData\.get\("confirmacao"\)/);
  assert.doesNotMatch(
    code,
    /formData\.get\("(readiness|status|blockers|ready|category)"\)/,
    "nao le prontidao do formulario",
  );
});

test("o evento so e registrado DEPOIS da elegibilidade", () => {
  const code = codeOnly(readFileSync(SERVICE, "utf8"));
  // Call sites (nao os imports) — a chamada da elegibilidade e o await do registro.
  const eligibilityIndex = code.indexOf("= checkAutomationQueueEligibility(");
  const recordIndex = code.indexOf("await recordOperationalEvent(");
  assert.ok(eligibilityIndex > 0 && recordIndex > 0, "ambos os call sites existem");
  assert.ok(eligibilityIndex < recordIndex, "a elegibilidade vem antes de gravar");
  // Guarda de saida em caso de recusa, antes do registro.
  const guard = code.slice(eligibilityIndex, recordIndex);
  assert.match(guard, /if \(!eligibility\.ok\) return/, "recusa retorna antes de gravar");
});

test("o registro usa o marcador e nao altera status", () => {
  const code = codeOnly(readFileSync(SERVICE, "utf8"));
  assert.match(code, /AUTOMATION_QUEUE_SUBMISSION_MARKER/, "grava o marcador estavel");
  assert.match(code, /kind: "NOTA"/, "usa a trilha append-only, sem mudar status");
  assert.doesNotMatch(code, /updateProcessOperations|operationalStatus:/, "nao altera status");
});

test("gate e dominios nao executam automacao, rede, OCR, IA nem Gov/SINARM", () => {
  for (const file of [SERVICE, ...PURE_FILES]) {
    const code = codeOnly(readFileSync(file, "utf8"));
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, `${file} sem rede`);
    assert.doesNotMatch(code, /https?:\/\//, `${file} sem URL externa`);
    assert.doesNotMatch(code, /playwright|puppeteer/i, `${file} sem browser automation`);
    assert.doesNotMatch(code, /gov\.br|sinarm/i, `${file} nao cita Gov/SINARM`);
    assert.doesNotMatch(
      code,
      /(?:import|require)[^;\n]*["'][^"']*(?:tesseract|ocr|openai|anthropic|vision)/i,
      `${file} nao importa OCR/IA`,
    );
  }
});

test("os dominios de submissao sao puros (sem Prisma direto)", () => {
  for (const file of PURE_FILES) {
    const code = codeOnly(readFileSync(file, "utf8"));
    assert.doesNotMatch(code, /getPrisma/, `${file} nao acessa banco`);
    assert.doesNotMatch(code, /\.create\(|\.update\(|\.upsert\(|\.delete\(/, `${file} nao grava`);
  }
});
