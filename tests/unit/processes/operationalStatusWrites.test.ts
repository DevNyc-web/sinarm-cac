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
 *
 * LIMITE conhecido: este teste detecta writes estruturais explicitos em sinks
 * conhecidos e literais diretos de `operationalStatus` em padroes comuns. Ele NAO
 * e um parser TypeScript completo e NAO garante detectar todos os fluxos
 * indiretos por objeto intermediario, spread complexo, factory dinamica ou chave
 * construida em runtime. O objetivo da Fase 5b e impedir crescimento
 * ACIDENTAL/PLAUSIVEL dos writes, nao provar ausencia formal.
 *
 * O que fica coberto e o que fica de fora esta exercitado em testes proprios no
 * fim do arquivo (secoes 6 e 7) — de proposito, para que o limite seja VISIVEL e
 * nao vire surpresa quando alguem confiar demais na trava.
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
    sink: "alsoSet",
    value: '"DOCUMENTO_ENVIADO"',
    why: "docs/46 §3.2 — JA MIGRADO na Fase 5e (docs/47 §6.1): passa pela porta canonica `transitionInternalStatus`, internalStatus vai para `DOCUMENTO_RECEBIDO_PARA_ANALISE`, com evento tipado. `operationalStatus` continua sendo DECISAO deste fluxo, so que via `alsoSet` — mesmo padrao de `confirmPixPayment`.",
  },
  {
    file: "src/server/services/reviewProcessDocument.ts",
    sink: "alsoSet",
    value: '"DOCUMENTO_APROVADO"',
    why: "docs/46 §3.3 — JA MIGRADO na Fase 5f, lado aprovacao (docs/47 §6.2): passa pela porta canonica `transitionInternalStatus`, internalStatus vai para `DOCUMENTO_VALIDADO`, com evento tipado. `operationalStatus` continua sendo DECISAO deste fluxo, so que via `alsoSet` — mesmo padrao de `confirmPixPayment`/`uploadProcessDocument`. O lado REJEITADO (proxima entrada) migrou depois, pela decisao propria do docs/48.",
  },
  {
    file: "src/server/services/reviewProcessDocument.ts",
    sink: "alsoSet",
    value: '"BLOQUEADO"',
    why: "docs/46 §3.4 — JA MIGRADO na Fase 5f completa, lado rejeicao (docs/48): passa pela porta canonica `transitionInternalStatus`, internalStatus vai para `BLOQUEADO_OPERACIONAL` (categoria NOVA para bloqueio decidido por HUMANO), com evento tipado e o motivo em `note`. `operationalStatus` continua sendo DECISAO deste fluxo, so que via `alsoSet`. CONTINUA PROIBIDO mapear para `BLOQUEADO_INSTABILIDADE` ou `EXCECAO_*`: aqueles afirmam causa apurada pela automacao.",
  },
  {
    file: "src/server/services/updateProcessOperations.ts",
    sink: "alsoSet",
    value: '"RASCUNHO"',
    why: "docs/46 §3.5 — JA MIGRADO na Fase 5g: um dos 3 valores com InternalStatus homonimo (docs/46 §6), passa pela porta canonica `transitionInternalStatus`.",
  },
  {
    file: "src/server/services/updateProcessOperations.ts",
    sink: "alsoSet",
    value: '"AGUARDANDO_PAGAMENTO"',
    why: "docs/46 §3.5 — JA MIGRADO na Fase 5g: mesmo padrao do write acima, internalStatus vai para `AGUARDANDO_PAGAMENTO`.",
  },
  {
    file: "src/server/services/updateProcessOperations.ts",
    sink: "alsoSet",
    value: '"PAGO_EM_FILA"',
    why: "docs/46 §3.5 — JA MIGRADO na Fase 5g: mesmo padrao, internalStatus vai para `PAGO_EM_FILA` (mesmo alvo que `confirmPixPayment` ja produz).",
  },
  {
    file: "src/server/services/updateProcessOperations.ts",
    sink: "updateProcessOperations(...)",
    value: "status",
    why: "docs/46 §3.5 — legado conhecido para os 6 valores SEM InternalStatus homonimo (DOCUMENTO_ENVIADO, DOCUMENTO_APROVADO, EM_REVISAO_OPERACIONAL, PRONTO_PARA_PROTOCOLO_MANUAL, BLOQUEADO, CANCELADO_DEV). Os dois primeiros TEM candidato canonico nos fluxos naturais (uploadProcessDocument/reviewProcessDocument), mas esta porta e MANUAL/admin e nao valida maquina de transicoes — migrar aqui poderia retroceder uma jornada ja avancada por um fluxo real sem a checagem que so aquele fluxo faz. Decisao explicita sobre esses dois ficou de fora da Fase 5g.",
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

/**
 * Remove comentarios sem quebrar `https://`. Variante do helper de
 * labRedaction.test.ts com uma diferenca que importa aqui: o comentario de bloco
 * vira as MESMAS quebras de linha que ocupava, em vez de um unico espaco.
 *
 * Sem isso, todo cabecalho `/** ... *\/` encolhe o arquivo e a linha reportada
 * na falha sai deslocada — em `transitionInternalStatus.ts` o desvio chegava a
 * 52 linhas. Uma trava que aponta para a linha errada perde a serventia.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
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

function spansOf(code: string, re: RegExp, sink: string, openChar: "(" | "{") {
  const spans: { sink: string; start: number; end: number }[] = [];
  for (const match of code.matchAll(re)) {
    const open = code.indexOf(openChar, match.index);
    spans.push({ sink, start: open, end: endOfBlock(code, open) });
  }
  return spans;
}

/** Spans dos contextos de payload — onde uma chave `operationalStatus` grava. */
function payloadSpans(code: string) {
  return [
    ...spansOf(code, /\bupdateProcessOperations\s*\(/g, "updateProcessOperations(...)", "("),
    ...spansOf(code, /\balsoSet\s*\??\s*:\s*\{/g, "alsoSet", "{"),
    ...spansOf(code, /\bdata\s*\??\s*:\s*\{/g, "prisma data", "{"),
  ];
}

/**
 * ANTI-SINKS: contextos onde `operationalStatus` NUNCA grava, nem com valor
 * literal. `where`/`select` sao clausulas de LEITURA do Prisma — filtrar a fila
 * por `"PAGO_EM_FILA"` e legitimo e nao pode acender a trava.
 *
 * Precisam ser explicitos porque a regra de valor literal (abaixo) dispensa
 * sink; sem esta lista, um filtro com valor fixo viraria falso positivo.
 */
function readOnlySpans(code: string) {
  return [
    ...spansOf(code, /\bwhere\s*:\s*\{/g, "where", "{"),
    ...spansOf(code, /\bselect\s*:\s*\{/g, "select", "{"),
  ];
}

/**
 * Os 9 valores de `OperationalStatus`, lidos do schema — nao copiados. Copiar
 * criaria uma segunda fonte de verdade que envelheceria calada.
 */
function operationalStatusValues(): string[] {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const block = /enum OperationalStatus \{([\s\S]*?)\}/.exec(schema);
  if (!block) throw new Error("enum OperationalStatus nao encontrado em prisma/schema.prisma");
  return block[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
}

const OPERATIONAL_STATUS_VALUES = operationalStatusValues();

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

/**
 * `operationalStatus: "PAGO_EM_FILA"` — valor cravado no arquivo.
 *
 * Tolera a assercao final (`as const`, `as OperationalStatus`), que e como o TS
 * costuma exigir o literal em objeto solto: sem isso, `as const` bastava para
 * furar a trava.
 */
function isLiteralStatus(value: string): boolean {
  const semAssercao = value.replace(/\s+as\s+[\w.]+$/, "").trim();
  const literal = /^"([A-Z0-9_]+)"$|^'([A-Z0-9_]+)'$/.exec(semAssercao);
  const name = literal?.[1] ?? literal?.[2];
  return name !== undefined && OPERATIONAL_STATUS_VALUES.includes(name);
}

function scanSource(file: string, source: string): DetectedWrite[] {
  const code = codeOnly(source);
  const spans = payloadSpans(code);
  const readOnly = readOnlySpans(code);
  const found: DetectedWrite[] = [];
  const lineOf = (index: number) => code.slice(0, index).split("\n").length;
  const inside = <T extends { start: number; end: number }>(list: T[], index: number) =>
    list.find((s) => index > s.start && index < s.end);

  // (a) chave com valor: `operationalStatus: <valor>`.
  // O lookbehind descarta `.operationalStatus`, `"process.operationalStatus"` e
  // qualquer sufixo de identificador maior (ex.: `nextOperationalStatus`).
  for (const match of code.matchAll(/(?<![\w$.'"])operationalStatus(\s*\?)?\s*:/g)) {
    const optional = match[1] !== undefined;
    const colon = code.indexOf(":", match.index);
    const value = valueAfter(code, colon);
    // `operationalStatus?:` so existe em declaracao de tipo/prop opcional.
    if (optional || isTypeAnnotation(value)) continue;
    // `where`/`select` sao leitura, mesmo com valor literal.
    if (inside(readOnly, match.index)) continue;

    const span = inside(spans, match.index);
    if (span) {
      found.push({ file, line: lineOf(match.index), sink: span.sink, value });
      continue;
    }
    // Fora de sink conhecido, um VALOR LITERAL do enum ainda e write: e o unico
    // motivo plausivel para cravar o valor no codigo. Fecha os dois bypasses que
    // a revisao sondou — objeto intermediario (`const patch = {...}`) e porta
    // generica nova (`patchProcess(id, {...})`) — sem precisar de parser.
    // Leitura nao tem literal do lado direito: tem `row.operationalStatus`,
    // `true`, `filters.x` ou um tipo.
    if (isLiteralStatus(value)) {
      found.push({ file, line: lineOf(match.index), sink: "objeto literal", value });
    }
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

const FILES = sourceFiles("src").sort();
/** Ordem estavel: a saida da falha nao pode depender da ordem do filesystem. */
const DETECTED = FILES.flatMap((file) => scanSource(file, readFileSync(file, "utf8"))).sort(
  (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
);

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
  // Um write no mesmo arquivo/sink de uma entrada conhecida quase sempre e o
  // MESMO write com o valor renomeado (`status` -> `novoStatus`), nao um write
  // novo. Dizer "novo write" nesse caso manda a pessoa procurar o que nao existe.
  const describe = (s: DetectedWrite) => {
    const renamed = ALL_ALLOWED.find((a) => a.file === s.file && a.sink === s.sink);
    const hint = renamed
      ? ` — parece o write conhecido \`${renamed.value}\` renomeado/alterado; se for, ajuste o \`value\` na allowlist`
      : "";
    return `  - ${s.file}:${s.line} — sink \`${s.sink}\`, valor \`${s.value}\`${hint}`;
  };
  assert.deepEqual(
    strays,
    [],
    `${FAILURE_MESSAGE}\n\nEncontrado(s):\n${strays
      .map(describe)
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

test("o inventario continua com 5 CAMINHOS de decisao, agora 8 escritas literais + 1 repasse canonico", () => {
  // Trava o NUMERO, nao so o conteudo: docs/46 §2 publica "5 caminhos de
  // escrita" — numero de ARQUIVOS/funcoes de decisao, que NAO muda na Fase 5g
  // (updateProcessOperations continua sendo 1 caminho). O que muda e quantas
  // ESCRITAS LITERAIS esse caminho produz: a Fase 5g trocou 1 escrita dinamica
  // (`status`, cobrindo os 9 valores em uma linha so) por 4 (3 literais
  // migrados + 1 dinamica remanescente para os 6 valores legados) — o mesmo
  // padrao que `reviewProcessDocument` ja tinha (1 caminho, 2 escritas) desde
  // antes da Fase 5f. 5 caminhos - 1 (a escrita antiga) + 4 (as novas) = 8.
  const decisions = DETECTED.filter((write) =>
    ALLOWED_WRITES.some((a) => matches(write, a)),
  ).length;
  const passthrough = DETECTED.filter((write) =>
    ALLOWED_PASSTHROUGH.some((a) => matches(write, a)),
  ).length;
  assert.equal(
    decisions,
    8,
    "docs/46 §2/§3 registra 5 caminhos; a Fase 5g fez updateProcessOperations produzir 4 escritas (era 1)",
  );
  assert.equal(passthrough, 1, "o repasse canonico e um: `alsoSet` em transitionInternalStatus");
});

test("a Fase 5f completa zerou os writes soltos de fluxo natural: 7 migrados (sink alsoSet), 1 ainda legado", () => {
  // "Write solto" = decisao de operationalStatus que NAO passa pela porta
  // canonica: sink `updateProcessOperations(...)` direto. Migrado = sink
  // `alsoSet`, mesmo padrao de `confirmPixPayment` (docs/46 §3.1),
  // `uploadProcessDocument` (Fase 5e), os DOIS lados de
  // `reviewProcessDocument` (aprovacao na 5f; rejeicao na 5f completa, docs/48)
  // e RASCUNHO/AGUARDANDO_PAGAMENTO/PAGO_EM_FILA de `updateProcessOperations`
  // (Fase 5g). Progressao: 1/4 (antes da 5e) -> 2/3 (5e) -> 3/2 (5f) -> 6/2
  // (5g) -> 7/1 (5f completa). O unico solto restante e a linha dinamica da
  // porta MANUAL/admin: nenhum fluxo NATURAL escreve operationalStatus fora da
  // porta canonica agora.
  const decisoes = DETECTED.filter((write) => ALLOWED_WRITES.some((a) => matches(write, a)));
  const migrados = decisoes.filter((write) => write.sink === "alsoSet").length;
  const soltos = decisoes.filter((write) => write.sink === "updateProcessOperations(...)").length;
  assert.equal(
    migrados,
    7,
    "confirmPixPayment + uploadProcessDocument + reviewProcessDocument (aprovacao E rejeicao) + updateProcessOperations (RASCUNHO/AGUARDANDO_PAGAMENTO/PAGO_EM_FILA)",
  );
  assert.equal(soltos, 1, "so updateProcessOperations (os 6 valores legados, 1 linha dinamica)");
  assert.equal(migrados + soltos, decisoes.length, "todo write de decisao e um dos dois sinks");
});

test("a Fase 5g migra so 3 dos 9 valores de updateProcessOperations; os outros 6 continuam na mesma linha legada", () => {
  // Explicito, alem dos testes gerais acima: garante que especificamente os 3
  // valores com InternalStatus homonimo saem pelo sink `alsoSet`, e que a
  // linha dinamica remanescente (sink `updateProcessOperations(...)`, valor
  // `status`) e a UNICA escrita legada que sobra neste arquivo — cobrindo os
  // 6 valores sem equivalencia (inclusive DOCUMENTO_ENVIADO/DOCUMENTO_APROVADO,
  // que tem candidato nos fluxos naturais mas NAO foram migrados aqui: porta
  // manual/admin, decisao explicita ficou de fora da Fase 5g).
  const doArquivo = DETECTED.filter(
    (write) => write.file === "src/server/services/updateProcessOperations.ts",
  );
  const migrados = doArquivo.filter((w) => w.sink === "alsoSet").map((w) => w.value).sort();
  const soltos = doArquivo.filter((w) => w.sink === "updateProcessOperations(...)");
  assert.deepEqual(migrados, ['"AGUARDANDO_PAGAMENTO"', '"PAGO_EM_FILA"', '"RASCUNHO"']);
  assert.deepEqual(
    soltos.map((w) => w.value),
    ["status"],
    "so deve sobrar UMA escrita dinamica, cobrindo os 6 valores legados",
  );
});

test("o lado REJEITADO de reviewProcessDocument migrou (BLOQUEADO, sink alsoSet)", () => {
  // Explicito, alem do teste generico acima: garante que especificamente o
  // BLOQUEADO de reviewProcessDocument saiu do sink solto. Era a ultima
  // escrita de fluxo NATURAL fora da porta canonica (docs/48).
  const rejeicao = DETECTED.find(
    (write) => write.file === "src/server/services/reviewProcessDocument.ts" && write.value === '"BLOQUEADO"',
  );
  assert.ok(rejeicao, "write de BLOQUEADO em reviewProcessDocument nao encontrado");
  assert.equal(rejeicao!.sink, "alsoSet", "BLOQUEADO deveria passar pela porta canonica agora");

  // E o arquivo nao pode mais chamar a porta legada em ramo nenhum.
  const code = readFileSync("src/server/services/reviewProcessDocument.ts", "utf8");
  assert.doesNotMatch(
    codeOnly(code),
    /updateProcessOperations\s*\(/,
    "nenhum ramo de reviewProcessDocument deveria mais escrever pela porta legada",
  );
});

test("o BLOQUEADO de updateProcessOperations continua legado — a Fase 5g dele nao e este PR", () => {
  // A rejeicao migrou; o dropdown do admin NAO. Sem esta trava, o proximo PR
  // poderia migrar os dois de carona e ninguem notaria pela contagem.
  const code = codeOnly(readFileSync("src/server/services/updateProcessOperations.ts", "utf8"));
  assert.doesNotMatch(code, /toStatus:\s*"BLOQUEADO_OPERACIONAL"/);
  assert.doesNotMatch(code, /alsoSet:\s*\{\s*operationalStatus:\s*"BLOQUEADO"/);
});

test("os 5 writes estao onde docs/46 §3 diz que estao", () => {
  // Ordenado: reordenar os dois ramos de `reviewProcessDocument` e refatoracao
  // inocente e nao deve quebrar a trava. O que importa e o CONJUNTO de valores
  // gravados por arquivo, nao a ordem em que aparecem.
  const byFile = (file: string) =>
    DETECTED.filter((w) => w.file === file)
      .map((w) => w.value)
      .sort();
  assert.deepEqual(byFile("src/server/services/confirmPixPayment.ts"), ['"PAGO_EM_FILA"']);
  assert.deepEqual(byFile("src/server/services/uploadProcessDocument.ts"), ['"DOCUMENTO_ENVIADO"']);
  assert.deepEqual(byFile("src/server/services/reviewProcessDocument.ts"), [
    '"BLOQUEADO"',
    '"DOCUMENTO_APROVADO"',
  ]);
  assert.deepEqual(byFile("src/server/services/updateProcessOperations.ts"), [
    '"AGUARDANDO_PAGAMENTO"',
    '"PAGO_EM_FILA"',
    '"RASCUNHO"',
    "status",
  ]);
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
    `/* bloco: operationalStatus: "BLOQUEADO" dentro de comentario */`,
    // Os dois abaixo so passam por causa dos ANTI-SINKS: tem valor literal do
    // enum, que a regra nova trataria como write se `where`/`select` nao fossem
    // reconhecidos como leitura. Filtrar a fila por um status fixo e legitimo.
    `where: { operationalStatus: "PAGO_EM_FILA" }`,
    `const q = { where: { operationalStatus: "EM_REVISAO_OPERACIONAL" }, select: { id: true } };`,
  ];
  for (const line of benign) {
    assert.deepEqual(
      scanSource("src/exemplo.ts", line),
      [],
      `padrao inofensivo foi tratado como write: ${line}`,
    );
  }
});

// ------------------------------------- 7. alcance real: o que pega, o que nao

test("PEGA write por objeto intermediario e por porta generica nova", () => {
  // Os dois bypasses que a revisao do PR sondou. Nenhum dos dois e evasao
  // exotica: sao estilos de codigo comuns, e por isso precisavam ser fechados —
  // um write novo nao deve escapar so porque o patch ganhou uma variavel.
  const viaVariavel = scanSource(
    "src/server/services/novo.ts",
    `const patch = { operationalStatus: "CANCELADO_DEV" };
     await updateProcessOperations(id, patch);`,
  );
  assert.deepEqual(
    viaVariavel.map((w) => `${w.sink}:${w.value}`),
    ['objeto literal:"CANCELADO_DEV"'],
    "objeto intermediario com valor literal precisa acender a trava",
  );

  // `as const` e como o TS costuma exigir o literal num objeto solto — sondado
  // em src/ real durante a revisao, e furava a trava antes desta correcao.
  const comAssercao = scanSource(
    "src/server/services/novo.ts",
    `const patch = { operationalStatus: "CANCELADO_DEV" as const };
     await updateProcessOperations(id, patch);`,
  );
  assert.equal(comAssercao.length, 1, "`as const` nao pode servir de escape");

  const viaPortaNova = scanSource(
    "src/server/services/novo.ts",
    `await patchProcess(id, { operationalStatus: "BLOQUEADO" });`,
  );
  assert.deepEqual(
    viaPortaNova.map((w) => `${w.sink}:${w.value}`),
    ['objeto literal:"BLOQUEADO"'],
    "porta generica nova com valor literal precisa acender a trava",
  );
});

test("os 9 valores do enum vem do schema, nao de copia", () => {
  // Se `OperationalStatus` ganhar um valor, a regra de literal passa a cobri-lo
  // sozinha. Copiar a lista aqui criaria uma segunda fonte de verdade.
  assert.equal(OPERATIONAL_STATUS_VALUES.length, 9);
  assert.ok(OPERATIONAL_STATUS_VALUES.includes("PRONTO_PARA_PROTOCOLO_MANUAL"));
  assert.equal(OPERATIONAL_STATUS_VALUES.includes("CONCLUIDO"), false, "esse e InternalStatus");
});

test("LIMITE conhecido: indirecao dinamica NAO e detectada", () => {
  // Documentado de proposito, no mesmo espirito do "LIMITE conhecido" de
  // labRedaction.test.ts: a trava impede crescimento acidental/plausivel, nao
  // prova ausencia. Cobrir estes casos exigiria parser TypeScript completo —
  // custo desproporcional para a Fase 5b.
  //
  // Se algum dia um destes aparecer de verdade, a defesa nao e esta trava: e a
  // revisao de PR e a decisao da Fase 5d.
  const naoCobertos = [
    // chave montada em runtime
    `const campo = "operationalStatus"; patch[campo] = "BLOQUEADO";`,
    // valor vindo de variavel, fora de sink conhecido
    `const alvo = "BLOQUEADO"; await patchProcess(id, { operationalStatus: alvo });`,
    // factory dinamica
    `const build = (v: string) => ({ operationalStatus: v }); await patchProcess(id, build("BLOQUEADO"));`,
  ];
  for (const linha of naoCobertos) {
    assert.deepEqual(
      scanSource("src/exemplo.ts", linha),
      [],
      `este caso passou a ser detectado — otimo: atualize o LIMITE do cabecalho: ${linha}`,
    );
  }
});

test("as linhas reportadas sao as linhas REAIS do arquivo", () => {
  // Regressao do bug corrigido: `codeOnly` colapsava comentario de bloco num
  // unico espaco e a linha reportada saia deslocada (52 linhas em
  // transitionInternalStatus.ts). A mensagem da trava existe para apontar o
  // write ofensor; linha errada a torna inutil.
  for (const write of DETECTED) {
    const linhaReal = readFileSync(write.file, "utf8").split("\n")[write.line - 1];
    assert.match(
      linhaReal ?? "",
      /operationalStatus/,
      `${write.file}:${write.line} nao contem operationalStatus — a linha reportada esta deslocada`,
    );
  }
});
