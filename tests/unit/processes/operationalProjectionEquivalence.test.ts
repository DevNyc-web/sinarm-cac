/**
 * Equivalencia entre `operationalStatusProjection.ts` (Fase 5h) e
 * `statusDivergence.ts` (Fase 5c) — garante que os dois modulos concordam,
 * sem mudar comportamento vivo nenhum.
 *
 * DIFERENCA para `operationalStatusProjection.test.ts`: aquele arquivo testa
 * cada helper isoladamente (um par por vez, uma categoria por vez). Este
 * arquivo prova a LEI que os liga — a EQUIVALENCIA entre `isCoherentPair` e
 * `severity === "none"` — de forma EXAUSTIVA sobre o produto cartesiano
 * InternalStatus x OperationalStatus (lido do schema, nao copiado), alem de
 * provar que as classificacoes "operational-only"/"legacy-expected" nao
 * dependem de QUAL internalStatus seguro esta sendo comparado.
 *
 * O que este arquivo NAO faz: nao testa `needs_decision`/`invalid_projection`
 * em detalhe (isso e `statusDivergence.test.ts`), nao reimplementa o dropdown
 * (isso e `updateProcessOperations.test.ts`, ja cobre DOCUMENTO_ENVIADO/
 * DOCUMENTO_APROVADO fora das opcoes manuais) e nao muda nenhuma reason.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { InternalStatus, OperationalStatus } from "@prisma/client";
import {
  CANONICAL_OPERATIONAL_PROJECTION,
  hasCanonicalProjection,
  isCoherentPair,
  isLegacyExpectedOperationalStatus,
  isOperationalOnlyStatus,
  LEGACY_EXPECTED_OPERATIONAL_STATUSES,
  OPERATIONAL_ONLY_STATUSES,
  projectOperationalStatus,
  type CanonicalInternalStatus,
} from "../../../src/server/processes/operationalStatusProjection";
import { diagnoseStatusDivergence } from "../../../src/server/processes/statusDivergence";

const ALL_INTERNAL_STATUSES = Object.values(InternalStatus);
const ALL_OPERATIONAL_STATUSES = Object.values(OperationalStatus);
const CANONICAL_INTERNAL_STATUSES = Object.keys(
  CANONICAL_OPERATIONAL_PROJECTION,
) as CanonicalInternalStatus[];

/* ---------------------------------------- 1. a lei central de equivalencia */

test("lei central: diagnoseStatusDivergence da severity 'none' SE E SOMENTE SE isCoherentPair for true", () => {
  // Exaustivo sobre TODO o produto cartesiano (21 InternalStatus x 9
  // OperationalStatus = 189 combinacoes) — nao uma amostra curada. Se os dois
  // modulos algum dia divergirem (um novo par entrar num so dos dois, uma
  // trava relaxar sem a outra acompanhar), este teste pega, nao importa em
  // qual combinacao especifica isso acontecer.
  let checked = 0;
  for (const internalStatus of ALL_INTERNAL_STATUSES) {
    for (const operationalStatus of ALL_OPERATIONAL_STATUSES) {
      const coherent = isCoherentPair(internalStatus, operationalStatus);
      const { severity } = diagnoseStatusDivergence({ internalStatus, operationalStatus });
      assert.equal(
        severity === "none",
        coherent,
        `internalStatus=${internalStatus} operationalStatus=${operationalStatus}: ` +
          `isCoherentPair=${coherent} mas severity=${severity}`,
      );
      checked++;
    }
  }
  assert.equal(checked, ALL_INTERNAL_STATUSES.length * ALL_OPERATIONAL_STATUSES.length);
});

/* --------------------------------- 2. pares canonicos: tripla equivalencia */

test("cada par canonico: projectOperationalStatus + isCoherentPair + severity none concordam", () => {
  for (const internalStatus of CANONICAL_INTERNAL_STATUSES) {
    const expected = CANONICAL_OPERATIONAL_PROJECTION[internalStatus];
    assert.equal(projectOperationalStatus(internalStatus), expected, internalStatus);
    assert.ok(isCoherentPair(internalStatus, expected), internalStatus);
    assert.equal(
      diagnoseStatusDivergence({ internalStatus, operationalStatus: expected }).severity,
      "none",
      internalStatus,
    );
  }
});

test("cada par canonico com operationalStatus TROCADO por outro alvo canonico: nunca coerente, nunca none", () => {
  const canonicalTargets = Object.values(CANONICAL_OPERATIONAL_PROJECTION) as OperationalStatus[];
  for (const internalStatus of CANONICAL_INTERNAL_STATUSES) {
    const ownExpected = CANONICAL_OPERATIONAL_PROJECTION[internalStatus];
    for (const wrongTarget of canonicalTargets) {
      if (wrongTarget === ownExpected) continue;
      assert.ok(
        !isCoherentPair(internalStatus, wrongTarget),
        `${internalStatus}+${wrongTarget} nao deveria ser coerente`,
      );
      const { severity } = diagnoseStatusDivergence({ internalStatus, operationalStatus: wrongTarget });
      assert.notEqual(severity, "none", `${internalStatus}+${wrongTarget}`);
    }
  }
});

/* -------------------------- 3. operational-only: independe do internalStatus */

test("operational-only: mesma severity 'operational_only' para QUALQUER internalStatus seguro (nao so um)", () => {
  // A propriedade que importa aqui: EM_REVISAO_OPERACIONAL/PRONTO_PARA_
  // PROTOCOLO_MANUAL/CANCELADO_DEV sao operational_only PELO PROPRIO VALOR,
  // nao por acaso de qual internalStatus seguro apareceu ao lado. Testar so
  // com RASCUNHO (como os testes focados ja fazem) nao provaria isso.
  for (const operationalStatus of OPERATIONAL_ONLY_STATUSES) {
    assert.ok(isOperationalOnlyStatus(operationalStatus));
    assert.ok(
      !(Object.values(CANONICAL_OPERATIONAL_PROJECTION) as OperationalStatus[]).includes(operationalStatus),
      `${operationalStatus} nao deveria ser alvo de par canonico`,
    );
    for (const internalStatus of CANONICAL_INTERNAL_STATUSES) {
      const { severity } = diagnoseStatusDivergence({ internalStatus, operationalStatus });
      assert.equal(severity, "operational_only", `${internalStatus}+${operationalStatus}`);
    }
  }
});

/* ------------------------- 4. legacy-expected: independe do internalStatus */

test("legacy-expected: mesma severity 'expected_legacy' para QUALQUER internalStatus seguro DIFERENTE do seu par", () => {
  // Espelho do teste anterior: DOCUMENTO_ENVIADO/DOCUMENTO_APROVADO/BLOQUEADO
  // sao expected_legacy contra QUALQUER internalStatus seguro que nao seja o
  // proprio par — nao um efeito colateral de testar so com RASCUNHO.
  for (const operationalStatus of LEGACY_EXPECTED_OPERATIONAL_STATUSES) {
    assert.ok(isLegacyExpectedOperationalStatus(operationalStatus));
    for (const internalStatus of CANONICAL_INTERNAL_STATUSES) {
      const isOwnPair = CANONICAL_OPERATIONAL_PROJECTION[internalStatus] === operationalStatus;
      const { severity } = diagnoseStatusDivergence({ internalStatus, operationalStatus });
      if (isOwnPair) {
        // Contraste: o par canonico do PROPRIO valor continua "none", nunca
        // "expected_legacy" — a classificacao muda com o par, nao com o valor.
        assert.equal(severity, "none", `${internalStatus}+${operationalStatus} (par proprio)`);
      } else {
        assert.equal(severity, "expected_legacy", `${internalStatus}+${operationalStatus}`);
      }
    }
  }
});

/* --------------------- 5. protecao contra projecao TOTAL por acidente --- */

test("nenhum InternalStatus fora dos 6 canonicos projeta operationalStatus (varredura EXAUSTIVA do enum)", () => {
  // Lido do schema (Object.values(InternalStatus)), nao uma lista copiada:
  // se o enum ganhar um valor novo amanha, este teste automaticamente o
  // inclui na varredura, sem precisar lembrar de atualizar uma lista a mao.
  const naoCanonicos = ALL_INTERNAL_STATUSES.filter(
    (status) => !CANONICAL_INTERNAL_STATUSES.includes(status as CanonicalInternalStatus),
  );
  assert.ok(naoCanonicos.length > 0, "varredura vazia — os 21 valores nao deveriam ser todos canonicos");
  for (const internalStatus of naoCanonicos) {
    assert.equal(hasCanonicalProjection(internalStatus), false, internalStatus);
    assert.equal(projectOperationalStatus(internalStatus), undefined, internalStatus);
  }
});

test("os 21 valores de InternalStatus continuam vindo do schema, nao de copia (varredura nao fica vazia por acidente)", () => {
  assert.equal(ALL_INTERNAL_STATUSES.length, 21);
  assert.equal(ALL_OPERATIONAL_STATUSES.length, 9);
  assert.equal(CANONICAL_INTERNAL_STATUSES.length, 6);
});
