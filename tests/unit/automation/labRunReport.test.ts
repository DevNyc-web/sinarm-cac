/**
 * Fase 8D — relatorio estruturado do laboratorio sintetico (docs/37).
 *
 * O relatorio precisa ser: deterministico, auto-declarado como LAB/SINTETICO,
 * livre de segredo e incapaz de produzir protocolo quando o run falhou.
 * Todos os dados aqui sao FICTICIOS.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  LAB_ARTIFACT_REJECTED,
  LAB_ARTIFACTS_ROOT,
  LAB_REPORT_KIND,
  LAB_RUN_STATUSES,
  LAB_SYNTHETIC_PROTOCOL_PREFIX,
  buildLabRunReport,
  type LabRunInput,
} from "../../../src/server/automation/lab/labRunReport";
import { LAB_REDACTED } from "../../../src/server/automation/redaction";

const CPF = "123.456.789-09";
const RG = "12.345.678-9";
const EMAIL = "fulano.teste@example.com";
const TELEFONE = "(11) 98765-4321";

const INICIO = "2026-07-25T10:00:00.000Z";
const FIM = "2026-07-25T10:00:12.500Z";

function baseInput(overrides: Partial<LabRunInput> = {}): LabRunInput {
  return {
    scenario: "normal",
    status: "SUCESSO",
    startedAt: INICIO,
    finishedAt: FIM,
    steps: [
      { name: "abrir laboratório", status: "OK", startedAt: INICIO, finishedAt: FIM },
      { name: "preencher destino", status: "OK", meta: { uf: "SP", cidade: "São Paulo" } },
    ],
    artifacts: [`${LAB_ARTIFACTS_ROOT}/lab-final-1.png`],
    networkPolicy: { allowedHosts: ["localhost"], externalAccessAllowed: false, offenders: [] },
    ...overrides,
  };
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

// --------------------------------------------------------------- estrutura

test("o relatorio traz cenario, status, duracao, passos e artefatos", () => {
  const report = buildLabRunReport(baseInput());

  assert.equal(report.scenario, "normal");
  assert.equal(report.status, "SUCESSO");
  assert.equal(report.startedAt, INICIO);
  assert.equal(report.finishedAt, FIM);
  assert.equal(report.durationMs, 12_500);
  assert.equal(report.steps.length, 2);
  assert.deepEqual(
    report.steps.map((step) => step.index),
    [0, 1],
  );
  assert.equal(report.steps[0].durationMs, 12_500);
  assert.equal(report.steps[1].durationMs, null, "passo sem marcos nao inventa duracao");
  assert.deepEqual(report.artifacts, [`${LAB_ARTIFACTS_ROOT}/lab-final-1.png`]);
  assert.deepEqual(report.networkPolicy.allowedHosts, ["localhost"]);
  assert.equal(report.networkPolicy.externalAccessAllowed, false);
});

test("o relatorio se declara LAB/SINTETICO", () => {
  const report = buildLabRunReport(baseInput());

  assert.equal(report.kind, LAB_REPORT_KIND);
  assert.equal(report.kind, "LAB_SINTETICO");
  assert.equal(report.synthetic, true);
  assert.match(report.disclaimer, /LABORAT[ÓO]RIO SINT[ÉE]TICO/);
  assert.match(report.disclaimer, /Nenhum processo real foi protocolado/);
  assert.match(report.disclaimer, /não acessa gov\.br nem sinarm/i);
});

test("o relatorio e deterministico", () => {
  const input = baseInput({ errors: ["falha fictícia"], warnings: ["aviso fictício"] });
  assert.deepEqual(buildLabRunReport(input), buildLabRunReport(input));
});

test("duracao invertida ou data invalida nao explode nem inventa horario", () => {
  const invertido = buildLabRunReport(baseInput({ startedAt: FIM, finishedAt: INICIO }));
  assert.equal(invertido.durationMs, 0);
  assert.ok(invertido.warnings.some((w) => w.includes("duração normalizada")));

  const invalido = buildLabRunReport(baseInput({ startedAt: "nao-e-data" }));
  assert.equal(invalido.startedAt, null);
  assert.equal(invalido.durationMs, 0);
});

// ------------------------------------------------------------------ segredo

test("o relatorio usa a redacao do lab em meta, erros e avisos", () => {
  const report = buildLabRunReport(
    baseInput({
      steps: [
        {
          name: `login de ${EMAIL}`,
          status: "FALHOU",
          meta: { senha: "SenhaFicticia123", cookie: "sid=abc", cpf: CPF, uf: "SP" },
        },
      ],
      warnings: [`revisar RG ${RG}`],
      errors: [new Error(`timeout ao enviar ${TELEFONE}`)],
    }),
  );

  assert.equal(report.steps[0].meta.senha, LAB_REDACTED);
  assert.equal(report.steps[0].meta.cookie, LAB_REDACTED);
  assert.equal(report.steps[0].meta.uf, "SP", "dado nao sensivel permanece");
  assert.ok(report.redactionSummary.redactedKeys >= 2);
  assert.equal(
    report.redactionSummary.total,
    report.redactionSummary.redactedKeys + report.redactionSummary.maskedValues,
  );
});

test("errors redigidos entram na contagem — o resumo nao pode ficar zerado", () => {
  // Sem steps/warnings: tudo que o resumo contar vem SO dos errors.
  const report = buildLabRunReport(
    baseInput({
      status: "FALHA",
      steps: [],
      warnings: [],
      errors: [new Error(`falha ao enviar ${CPF} para ${EMAIL}`)],
    }),
  );

  const output = serialize(report);
  assert.equal(output.includes(CPF), false);
  assert.equal(output.includes(EMAIL), false);
  assert.match(report.errors[0].message, /\*\*\*\.\*\*\*\.\*\*\*-\*\*/);
  assert.equal(report.errors[0].message.includes("[EMAIL]"), true);

  // CPF + e-mail = 2 redacoes; um resumo zerado seria subdeclaracao.
  assert.equal(report.redactionSummary.maskedValues, 2);
  assert.equal(report.redactionSummary.total, 2);
});

test("nenhum segredo nem PII em claro sobrevive ao relatorio serializado", () => {
  const report = buildLabRunReport(
    baseInput({
      scenario: `cenario-${CPF}`,
      steps: [
        {
          name: `contato ${EMAIL}`,
          status: "FALHOU",
          meta: {
            password: "hunter2",
            token: "eyJhbGciOiJIUzI1NiJ9.ficticio",
            otp: "123456",
            authorization: "Bearer ficticio-abc",
            cookie: "session=abc123",
            solicitante: { cpf: CPF, rg: RG, telefone: TELEFONE, email: EMAIL },
          },
        },
      ],
      warnings: [`RG ${RG}`],
      errors: [new Error(`falha com ${CPF}`)],
      networkPolicy: { offenders: ["localhost:3000/lab?token=ficticio-abc"] },
    }),
  );

  const output = serialize(report);
  for (const secret of [
    "hunter2",
    "eyJhbGciOiJIUzI1NiJ9.ficticio",
    "123456",
    "Bearer ficticio-abc",
    "ficticio-abc",
    "session=abc123",
    CPF,
    RG,
    TELEFONE,
    EMAIL,
  ]) {
    assert.equal(output.includes(secret), false, `"${secret}" vazou no relatório`);
  }
  assert.equal(/\btoken=/.test(output), false, "query string removida dos offenders");
});

// --------------------------------------------------------------- protocolo

test("execucao sem sucesso NUNCA produz protocolo", () => {
  for (const status of LAB_RUN_STATUSES.filter((s) => s !== "SUCESSO")) {
    const report = buildLabRunReport(
      baseInput({ status, syntheticProtocol: `${LAB_SYNTHETIC_PROTOCOL_PREFIX}0001` }),
    );
    assert.equal(report.syntheticProtocol, null, `${status} nao pode ter protocolo`);
    assert.ok(report.warnings.some((w) => w.includes("Protocolo descartado")));
  }
});

test("status desconhecido (chamador sem tipos) nao gera protocolo", () => {
  // A porta e allow-list: so "SUCESSO" passa. Um status novo, ou um chamador
  // JavaScript sem tipos, tem de cair no `null` — nao no caminho permissivo.
  const report = buildLabRunReport(
    baseInput({
      status: "ERRO_DESCONHECIDO" as never,
      syntheticProtocol: `${LAB_SYNTHETIC_PROTOCOL_PREFIX}0001`,
    }),
  );

  assert.equal(report.syntheticProtocol, null);
  assert.equal(serialize(report).includes("PROT-FICT-0001"), false);
  assert.ok(report.warnings.some((w) => w.includes("Protocolo descartado")));
});

test("so o protocolo sintetico e aceito; numero fora do padrao e descartado", () => {
  const aceito = buildLabRunReport(
    baseInput({ syntheticProtocol: `${LAB_SYNTHETIC_PROTOCOL_PREFIX}0001` }),
  );
  assert.equal(aceito.syntheticProtocol, "PROT-FICT-0001");

  const recusado = buildLabRunReport(baseInput({ syntheticProtocol: "2026123456789" }));
  assert.equal(recusado.syntheticProtocol, null);
  assert.ok(recusado.warnings.some((w) => w.includes("fora do padrão sintético")));

  const semProtocolo = buildLabRunReport(baseInput());
  assert.equal(semProtocolo.syntheticProtocol, null, "sucesso sem protocolo continua null");
});

// --------------------------------------------------------------- artefatos

test("artefato fora do laboratorio e recusado", () => {
  const report = buildLabRunReport(
    baseInput({
      artifacts: [
        `${LAB_ARTIFACTS_ROOT}/ok.png`,
        "/etc/passwd",
        "C:/Users/fulano/Documents/rg-real.pdf",
        `${LAB_ARTIFACTS_ROOT}/../../../segredo.png`,
        "storage-local/documento-real.pdf",
        "file:///tmp/x.png",
      ],
    }),
  );

  assert.equal(report.artifacts[0], `${LAB_ARTIFACTS_ROOT}/ok.png`);
  assert.deepEqual(report.artifacts.slice(1), Array(5).fill(LAB_ARTIFACT_REJECTED));
  assert.equal(serialize(report).includes("rg-real.pdf"), false);
  assert.equal(serialize(report).includes("documento-real.pdf"), false);
});

test("o caminho do artefato preserva o timestamp mas perde PII no nome", () => {
  const report = buildLabRunReport(
    baseInput({
      artifacts: [
        `${LAB_ARTIFACTS_ROOT}/lab-final-1784987585333.png`,
        `${LAB_ARTIFACTS_ROOT}/doc-${CPF}.png`,
      ],
    }),
  );

  // Mascarar o timestamp tornaria o caminho inutil para achar o arquivo.
  assert.equal(report.artifacts[0], `${LAB_ARTIFACTS_ROOT}/lab-final-1784987585333.png`);
  assert.equal(report.artifacts[1].includes(CPF), false);
});

test("acesso externo pedido no input e sempre recusado", () => {
  const report = buildLabRunReport(
    baseInput({ networkPolicy: { externalAccessAllowed: true, offenders: [] } }),
  );
  assert.equal(report.networkPolicy.externalAccessAllowed, false);
  assert.ok(report.warnings.some((w) => w.includes("sempre local")));
});

// ------------------------------------------------------------ trava estatica

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("o relatorio do lab e puro: sem banco, rede, arquivo ou navegador", () => {
  const code = codeOnly(readFileSync("src/server/automation/lab/labRunReport.ts", "utf8"));
  assert.doesNotMatch(code, /getPrisma|@prisma\/client/, "e puro, sem Prisma");
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket/, "nao faz requisicao");
  assert.doesNotMatch(code, /\b(?:https?|wss?):\/\//, "nao tem URL externa");
  assert.doesNotMatch(
    code,
    /(?:import|require)[^;\n]*["'][^"']*(?:node:fs|node:http|playwright|chromium|puppeteer)/i,
    "nao importa fs/http/navegador",
  );
  assert.doesNotMatch(
    code,
    /(?:import|require)[^;\n]*["'][^"']*phase9/i,
    "nao reaproveita codigo da Fase 9",
  );
  assert.doesNotMatch(code, /Date\.now\(|Math\.random\(/, "e deterministico");
});
