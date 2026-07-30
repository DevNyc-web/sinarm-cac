/**
 * Fase 5b — TRAVA contra novos writes soltos de `operationalStatus`
 * (docs/46-inventario-operational-status.md §9).
 *
 * POR QUE ESTA TRAVA EXISTE: `operationalStatus` tem 5 caminhos de escrita e 9/9
 * valores alcancaveis, enquanto `internalStatus` tem 1 caminho e 2/17. A Fase 5
 * foi REORDENADA justamente porque projetar agora colapsaria a fila. Enquanto a
 * Fase 5d nao decidir se novos `InternalStatus` serao criados para os 6 estados
 * de workflow humano (docs/46 §7), 5e/5f nao tem destino seguro para escrever.
 *
 * Esta trava impede que o problema CRESCA nesse meio-tempo: um write novo de
 * `operationalStatus` que entre sem decisao explicita aumenta a superficie que a
 * projecao futura tera de cobrir, em silencio.
 *
 * O QUE ELA GUARDA: writes. Nao leituras.
 *
 * Ler `operationalStatus` e legitimo e frequente (13 leituras de decisao, docs/46
 * §4) — filtros, DTOs, guardas, badges, `select` do Prisma, tipos e rotulos
 * continuam livres. Uma trava que reagisse a qualquer mencao textual ao campo
 * seria frágil e viraria ruido no primeiro DTO novo. Por isso a deteccao e por
 * CONTEXTO DE PAYLOAD (§ "Como a deteccao funciona"), nao por palavra.
 *
 * O QUE ELA NAO FAZ: nao migra fluxo, nao cria mapa, nao cria projecao, nao toca
 * schema/enum/migration e nao altera comportamento de aplicacao. E teste
 * estrutural puro: le arquivos como texto, nao importa nada de `src/`.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// --------------------------------------------------------------- 1. allowlist

/**
 * Um write de decisao: alguem escolheu um `operationalStatus` e o gravou.
 *
 * `value` e o texto do valor escrito, normalizado. Casar por valor (e nao so por
 * arquivo) e o que faz a trava distinguir "o write conhecido" de "um write NOVO
 * no mesmo arquivo" — sem isso, `reviewProcessDocument` poderia ganhar um
 * terceiro caminho sem ninguem notar.
 */
type AllowedWrite = {
  file: string;
  sink: string;
  value: string;
  why: string;
};

/**
 * Os 5 writes inventariados em docs/46 §3. Ordem igual a do documento.
 *
 * "legado conhecido" = permitido TEMPORARIAMENTE, ate a subfase que o migra
 * (5e/5f/5g). Nao e aprovacao permanente: quando o fluxo passar pela porta
 * canonica, a entrada correspondente sai desta lista (o teste
 * "allowlist nao guarda entrada morta" cobra isso).
 */
const ALLOWED_WRITES: readonly AllowedWrite[] = [
  {
    file: "src/server/services/confirmPixPayment.ts",
    sink: "alsoSet",
    value: '"PAGO_EM_FILA"',
    why: "docs/46 §3.1 — JA MIGRADO: passa pela porta canonica `transitionInternalStatus`, com evento tipado. E a referencia para os demais.",
  },
  {
    file: "src/server/services/uploadProcessDocument.ts",
    sink: "updateProcessOperations(...)",
    value: '"DOCUMENTO_ENVIADO"',
    why: "docs/46 §3.2 — legado conhecido, permitido temporariamente. Migra na 5e. Bloqueio: nao existe `InternalStatus` para 'documento enviado, aguardando conferencia'.",
  },
  {
    file: "src/server/services/reviewProcessDocument.ts",
    sink: "updateProcessOperations(...)",
    value: '"DOCUMENTO_APROVADO"',
    why: "docs/46 §3.3 — legado conhecido (aprovacao), permitido temporariamente. Migra na 5f. Mesmo bloqueio do 3.2.",
  },
  {
    file: "src/server/services/reviewProcessDocument.ts",
    sink: "updateProcessOperations(...)",
    value: '"BLOQUEADO"',
    why: "docs/46 §3.4 — legado conhecido (rejeicao), permitido temporariamente. PROIBIDO mapear para `BLOQUEADO_INSTABILIDADE` ou `EXCECAO_*` sem decisao propria: inventaria a causa do bloqueio.",
  },
  {
    file: "src/server/services/updateProcessOperations.ts",
    sink: "updateProcessOperations(...)",
    value: "status",
    why: "docs/46 §3.5 — porta manual/admin, aceita os 9 valores. Risco alto: migra na 5g, por ultimo.",
  },
];

/**
 * Encanamento, nao decisao. Repassa o que o chamador ja decidiu — nao escolhe
 * valor nenhum.
 *
 * Separado dos 5 de proposito: docs/46 §3 conta CAMINHOS DE DECISAO, e somar o
 * repasse ali faria o numero do inventario divergir do documento. A porta
 * canonica precisa poder escrever `operationalStatus`; e exatamente o que
 * `alsoSet` existe para fazer (docs/44, Fase 3a).
 */
const ALLOWED_PASSTHROUGH: readonly AllowedWrite[] = [
  {
    file: "src/server/services/transitionInternalStatus.ts",
    sink: "prisma data",
    value: "alsoSet.operationalStatus",
    why: "porta canonica: repassa `alsoSet` para a `update` unica. Nao deriva nem escolhe valor — quem decide e o chamador (docs/44 §4).",
  },
];

/**
 * `src/server/repositories/processRepository.ts` NAO entra em lista nenhuma, e
 * isso e intencional: `updateProcessOperations(id, data)` recebe `data` como
 * VARIAVEL tipada e a repassa ao Prisma. Nao ha literal de `operationalStatus`
 * ali, logo o scanner nao encontra nada — o repositorio e porta generica, nao
 * ponto de decisao. Registrado aqui para que a ausencia nao pareca esquecimento.
 */

const FAILURE_MESSAGE =
  "Novo write de operationalStatus encontrado fora da allowlist. " +
  "A Fase 5 exige decisao explicita antes de adicionar novos writes. " +
  "Consulte docs/46-inventario-operational-status.md.";

// ---------------------------------------------------------------- 2. deteccao

/**
 * Como a deteccao funciona.
 *
 * Um write e uma ocorrencia de `operationalStatus` como CHAVE COM VALOR dentro
 * de um CONTEXTO DE PAYLOAD — os tres unicos lugares por onde o campo chega ao
 * banco nesta base:
 *
 *   1. os argumentos de uma chamada a `updateProcessOperations(...)`;
 *   2. um literal `alsoSet: { ... }` (porta canonica);
 *   3. um literal `data: { ... }` (payload do Prisma).
 *
 * Fora desses contextos, a mencao ao campo NAO e write. Por construcao ficam de
 * fora `where:`, `select:`, DTOs, tipos, rotulos, filtros e leituras — sem
 * precisar de lista de excecoes por arquivo, que envelheceria.
 *
 * Tambem detecta atribuicao direta (`.operationalStatus = ...`) em qualquer
 * lugar: hoje nao existe nenhuma, e a rede fica armada para o caso de aparecer.
 */
type DetectedWrite = {
  file: string;
  line: number;
  sink: string;
  value: string;
};

/** Remove comentarios sem quebrar `https://`. Mesmo helper de labRedaction.test.ts. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Avanca o indice para depois de uma string literal, respeitando escapes. */
function skipString(code: string, start: number): number {
  const quote = code[start];
  let i = start + 1;
  while (i < code.length && code[i] !== quote) {
    if (code[i] === "\\") i++;
    i++;
  }
  return i + 1;
}

/**
 * Fim do bloco balanceado aberto em `openIndex`. Conta apenas o par do caractere
 * de abertura, de modo que `(` nao se confunde com `{` aninhado, e pula strings
 * para nao contar chave dentro de texto.
 */
function endOfBlock(code: string, openIndex: number): number {
  const open = code[openIndex];
  const close = open === "(" ? ")" : "}";
  let depth = 0;
  let i = openIndex;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(code, i);
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return i + 1;
    i++;
  }
  return code.length;
}

/** Spans dos contextos de payload do arquivo. */
function payloadSpans(code: string): { sink: string; start: number; end: number }[] {
  const sinks: { sink: string; re: RegExp }[] = [
    { sink: "updateProcessOperations(...)", re: /\bupdateProcessOperations\s*\(/g },
    { sink: "alsoSet", re: /\balsoSet\s*\??\s*:\s*\{/g },
    { sink: "prisma data", re: /\bdata\s*\??\s*:\s*\{/g },
  ];
  const spans: { sink: string; start: number; end: number }[] = [];
  for (const { sink, re } of sinks) {
    for (const match of code.matchAll(re)) {
      const open = code.indexOf(sink === "updateProcessOperations(...)" ? "(" : "{", match.index);
      spans.push({ sink, start: open, end: endOfBlock(code, open) });
    }
  }
  return spans;
}

/** Texto do valor escrito, normalizado: do `:` ate a virgula/fecho do mesmo nivel. */
function valueAfter(code: string, colonIndex: number): string {
  let i = colonIndex + 1;
  let depth = 0;
  let out = "";
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const next = skipString(code, i);
      out += code.slice(i, next);
      i = next;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ")" || ch === "}" || ch === "]") {
      if (depth === 0) break;
      depth--;
    }
    if ((ch === "," || ch === ";") && depth === 0) break;
    out += ch;
    i++;
  }
  return out.trim().replace(/\s+/g, " ");
}

/** Um valor que e ANOTACAO DE TIPO, nao dado gravado. */
function isTypeAnnotation(value: string): boolean {
  return /^(?:OperationalStatus|string)\b/.test(value);
}

function scanSource(file: string, source: string): DetectedWrite[] {
  const code = codeOnly(source);
  const spans = payloadSpans(code);
  const found: DetectedWrite[] = [];
  const lineOf = (index: number) => code.slice(0, index).split("\n").length;

  // (a) chave com valor: `operationalStatus: <valor>`.
  // O lookbehind descarta `.operationalStatus`, `"process.operationalStatus"` e
  // qualquer sufixo de identificador maior (ex.: `nextOperationalStatus`).
  for (const match of code.matchAll(/(?<![\w$.'"])operationalStatus(\s*\?)?\s*:/g)) {
    const optional = match[1] !== undefined;
    const colon = code.indexOf(":", match.index);
    const value = valueAfter(code, colon);
    // `operationalStatus?:` so existe em declaracao de tipo/prop opcional.
    if (optional || isTypeAnnotation(value)) continue;
    const span = spans.find((s) => match.index > s.start && match.index < s.end);
    if (!span) continue; // leitura, DTO, filtro, `select`, rotulo — nao e write
    found.push({ file, line: lineOf(match.index), sink: span.sink, value });
  }

  // (b) atribuicao direta a propriedade: `algo.operationalStatus = ...`.
  for (const match of code.matchAll(/(?<![\w$])\w+\.operationalStatus\s*=(?!=)/g)) {
    const eq = code.indexOf("=", match.index);
    found.push({
      file,
      line: lineOf(match.index),
      sink: "atribuicao direta",
      value: valueAfter(code, eq),
    });
  }

  return found;
}

// ------------------------------------------------------------------ 3. varredura

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full.split("\\").join("/"));
  }
  return acc;
}

const FILES = sourceFiles("src");
const DETECTED = FILES.flatMap((file) => scanSource(file, readFileSync(file, "utf8")));

const ALL_ALLOWED = [...ALLOWED_WRITES, ...ALLOWED_PASSTHROUGH];

function matches(write: DetectedWrite, allowed: AllowedWrite): boolean {
  return (
    write.file === allowed.file && write.sink === allowed.sink && write.value === allowed.value
  );
}

// --------------------------------------------------------------------- 4. travas

test("a varredura encontrou codigo (a trava nao esta vazia por acidente)", () => {
  // Sem isto, um erro de caminho tornaria TODOS os testes abaixo verdes por
  // vacuidade — a pior falha possivel numa trava.
  assert.ok(FILES.length > 50, `varredura achou apenas ${FILES.length} arquivos em src/`);
  assert.ok(
    FILES.includes("src/server/services/confirmPixPayment.ts"),
    "arquivo conhecido ficou fora da varredura",
  );
});

test("nenhum write de operationalStatus fora da allowlist", () => {
  const strays = DETECTED.filter((write) => !ALL_ALLOWED.some((a) => matches(write, a)));
  assert.deepEqual(
    strays,
    [],
    `${FAILURE_MESSAGE}\n\nEncontrado(s):\n${strays
      .map((s) => `  - ${s.file}:${s.line} — sink \`${s.sink}\`, valor \`${s.value}\``)
      .join("\n")}\n\nSe o write for legitimo e decidido, some-o a ALLOWED_WRITES com a justificativa e atualize docs/46 §3.`,
  );
});

test("allowlist nao guarda entrada morta", () => {
  // Quando 5e/5f/5g migrarem um fluxo, o write sai do codigo e a entrada
  // correspondente TEM de sair daqui — senao a allowlist passa a autorizar um
  // legado que nao existe mais, e o inventario de docs/46 §3 mente.
  const stale = ALL_ALLOWED.filter((a) => !DETECTED.some((write) => matches(write, a)));
  assert.deepEqual(
    stale,
    [],
    `Entrada de allowlist sem write correspondente no codigo:\n${stale
      .map((s) => `  - ${s.file} — sink \`${s.sink}\`, valor \`${s.value}\``)
      .join(
        "\n",
      )}\n\nSe o fluxo foi migrado para a porta canonica, remova a entrada e atualize docs/46 §3.`,
  );
});

test("o inventario continua com 5 writes de decisao + 1 repasse canonico", () => {
  // Trava o NUMERO, nao so o conteudo: docs/46 §2 publica "5 caminhos de
  // escrita", e numero repetido em documento vira fato falso quando o codigo
  // anda sozinho.
  const decisions = DETECTED.filter((write) =>
    ALLOWED_WRITES.some((a) => matches(write, a)),
  ).length;
  const passthrough = DETECTED.filter((write) =>
    ALLOWED_PASSTHROUGH.some((a) => matches(write, a)),
  ).length;
  assert.equal(decisions, 5, "docs/46 §2/§3 registra 5 caminhos de escrita de decisao");
  assert.equal(passthrough, 1, "o repasse canonico e um: `alsoSet` em transitionInternalStatus");
});

test("os 5 writes estao onde docs/46 §3 diz que estao", () => {
  const byFile = (file: string) => DETECTED.filter((w) => w.file === file).map((w) => w.value);
  assert.deepEqual(byFile("src/server/services/confirmPixPayment.ts"), ['"PAGO_EM_FILA"']);
  assert.deepEqual(byFile("src/server/services/uploadProcessDocument.ts"), ['"DOCUMENTO_ENVIADO"']);
  assert.deepEqual(byFile("src/server/services/reviewProcessDocument.ts"), [
    '"DOCUMENTO_APROVADO"',
    '"BLOQUEADO"',
  ]);
  assert.deepEqual(byFile("src/server/services/updateProcessOperations.ts"), ["status"]);
});

// -------------------------------------------- 5. precisao: leitura nao e write

test("LEITURAS nao sao tratadas como write", () => {
  // Cada caso abaixo e uma mencao REAL a `operationalStatus` que existe hoje em
  // src/ e que a trava precisa ignorar. Se um destes passar a contar como write,
  // a trava vira ruido e sera desligada por irritacao — e o problema volta.
  const readers = [
    "src/server/processes/operationalSignals.ts", // 7 leituras de decisao + tipo
    "src/server/processes/statusLabels.ts", // rotulo/`clientVisibleStatusLabel`
    "src/server/repositories/processRepository.ts", // `where`, `select`, tipos
    "src/server/services/getAdminQueue.ts", // DTO + flag da fila
    "src/server/services/getAdminProcessDetail.ts", // DTO
    "src/server/auth/permissions.ts", // RBAC "process.operationalStatus"
    "src/app/(admin)/admin/processos/page.tsx", // filtro + badge
    "src/app/(user)/processos/novo/sucesso/page.tsx", // rotulo ao cliente
  ];
  for (const file of readers) {
    assert.ok(FILES.includes(file), `arquivo de referencia desapareceu: ${file}`);
    assert.deepEqual(
      DETECTED.filter((w) => w.file === file),
      [],
      `${file} so LE operationalStatus — nao deveria ser detectado como write`,
    );
  }
});

test("o tipo de `alsoSet` nao e confundido com write", () => {
  // `alsoSet?: { operationalStatus?: OperationalStatus }` mora DENTRO de um sink
  // (`alsoSet`), entao so a regra de anotacao de tipo o salva. Caso classico de
  // falso positivo que uma trava ingenua produziria.
  const source = readFileSync("src/server/services/transitionInternalStatus.ts", "utf8");
  assert.match(source, /alsoSet\?:\s*\{\s*operationalStatus\?:\s*OperationalStatus/);
  assert.deepEqual(
    scanSource("x.ts", source).map((w) => w.value),
    ["alsoSet.operationalStatus"],
    "no arquivo da porta canonica so o repasse e write",
  );
});

// ------------------------------------------- 6. a trava realmente dispara?

test("a trava DISPARA em write novo (fixture, nao codigo de produto)", () => {
  // Prova que os testes acima nao passam por vacuidade. O write artificial vive
  // apenas nesta string — nao existe em src/ e nao muda comportamento nenhum.
  const fixture = `
    import { updateProcessOperations } from "@/server/repositories/processRepository";
    export async function cancelProcessForFun(id: string) {
      await updateProcessOperations(id, { operationalStatus: "CANCELADO_DEV" });
    }
  `;
  const detected = scanSource("src/server/services/novoFluxo.ts", fixture);
  assert.equal(detected.length, 1, "write novo dentro de updateProcessOperations nao foi visto");
  assert.equal(detected[0].value, '"CANCELADO_DEV"');
  assert.equal(
    ALL_ALLOWED.some((a) => matches(detected[0], a)),
    false,
    "write novo nao pode casar com a allowlist",
  );
});

test("a trava DISPARA em write novo por `data` do Prisma e por atribuicao direta", () => {
  // Os outros dois caminhos de escrita: payload cru do Prisma (contornando o
  // repositorio) e mutacao de propriedade.
  const viaPrisma = scanSource(
    "src/server/services/atalho.ts",
    `await tx.process.update({ where: { id }, data: { operationalStatus: "BLOQUEADO" } });`,
  );
  assert.deepEqual(
    viaPrisma.map((w) => `${w.sink}:${w.value}`),
    ['prisma data:"BLOQUEADO"'],
  );

  const viaAssign = scanSource(
    "src/server/services/atalho.ts",
    `process.operationalStatus = "EM_REVISAO_OPERACIONAL";`,
  );
  assert.deepEqual(
    viaAssign.map((w) => `${w.sink}:${w.value}`),
    ['atribuicao direta:"EM_REVISAO_OPERACIONAL"'],
  );
});

test("a trava NAO dispara em leitura, filtro, select, tipo nem permissao RBAC", () => {
  // O espelho do teste acima: cada linha aqui e um padrao que DEVE passar livre.
  const benign = [
    `const fila = await getAdminQueue({ operationalStatus: statusFilter });`,
    `where: { operationalStatus: filters.operationalStatus }`,
    `select: { id: true, operationalStatus: true }`,
    `type Row = { operationalStatus: OperationalStatus };`,
    `if (process.operationalStatus === "RASCUNHO") return;`,
    `const label = OPERATIONAL_STATUS_LABELS[row.operationalStatus];`,
    `await requirePermission("process.operationalStatus");`,
    `return { operationalStatus: row.operationalStatus, priority: row.priority };`,
    `// muda o operationalStatus: comentario nao e codigo`,
  ];
  for (const line of benign) {
    assert.deepEqual(
      scanSource("src/exemplo.ts", line),
      [],
      `padrao inofensivo foi tratado como write: ${line}`,
    );
  }
});
