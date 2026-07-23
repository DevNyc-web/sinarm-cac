/**
 * Fila de automacao — AGRUPAMENTO por prontidao (dominio puro).
 *
 * NAO reimplementa o checklist: recebe o resultado de `deriveAutomationReadiness`
 * e apenas classifica o processo numa categoria operacional, escolhendo o
 * bloqueio PRINCIPAL de forma DETERMINISTICA quando ha varios. A fila serve para
 * a operacao interna saber o que esta pronto ou o que falta — nada e executado.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */
import {
  type AutomationReadiness,
  type AutomationReadinessStatus,
  type ReadinessItem,
} from "./automationReadiness";

export const AUTOMATION_QUEUE_CATEGORIES = [
  "PRONTO_PARA_AUTOMACAO",
  "NAO_PRONTO_DESTINO",
  "NAO_PRONTO_PCE",
  "NAO_PRONTO_DOCUMENTOS",
  "NAO_PRONTO_SUGESTOES",
  "NAO_PRONTO_PAGAMENTO",
  "BLOQUEADO_OUTROS",
] as const;

export type AutomationQueueCategory = (typeof AUTOMATION_QUEUE_CATEGORIES)[number];

export const AUTOMATION_QUEUE_CATEGORY_LABELS: Record<AutomationQueueCategory, string> = {
  PRONTO_PARA_AUTOMACAO: "Pronto para automação",
  NAO_PRONTO_DESTINO: "Não pronto — destino",
  NAO_PRONTO_PCE: "Não pronto — arma/PCE",
  NAO_PRONTO_DOCUMENTOS: "Não pronto — documentos",
  NAO_PRONTO_SUGESTOES: "Não pronto — sugestões",
  NAO_PRONTO_PAGAMENTO: "Não pronto — pagamento",
  BLOQUEADO_OUTROS: "Bloqueado — outros",
};

/** Categorias de bloqueio, em ORDEM DE PRECEDENCIA (a 1a presente vence). */
const BLOCKER_CATEGORY_PRECEDENCE = [
  "NAO_PRONTO_DESTINO",
  "NAO_PRONTO_PCE",
  "NAO_PRONTO_DOCUMENTOS",
  "NAO_PRONTO_SUGESTOES",
  "NAO_PRONTO_PAGAMENTO",
] as const satisfies readonly AutomationQueueCategory[];

/**
 * Categoria de UM bloqueio a partir do seu codigo (ver `automationReadiness`):
 *  - `DESTINO_*`               -> destino
 *  - `PCE_AUSENTE`             -> arma/PCE
 *  - `DOC_*`                   -> documentos
 *  - `SUGESTAO_DESTINO_*`      -> sugestoes
 *  - `PAGAMENTO_*`            -> pagamento
 * Codigo desconhecido devolve `null` -> cai em BLOQUEADO_OUTROS.
 */
export function blockerCategory(code: string): AutomationQueueCategory | null {
  if (code.startsWith("DESTINO_")) return "NAO_PRONTO_DESTINO";
  if (code === "PCE_AUSENTE") return "NAO_PRONTO_PCE";
  if (code.startsWith("DOC_")) return "NAO_PRONTO_DOCUMENTOS";
  if (code.startsWith("SUGESTAO_")) return "NAO_PRONTO_SUGESTOES";
  if (code.startsWith("PAGAMENTO_")) return "NAO_PRONTO_PAGAMENTO";
  return null;
}

export interface QueueClassification {
  category: AutomationQueueCategory;
  status: AutomationReadinessStatus;
  ready: boolean;
  /** Bloqueio principal (o 1o da categoria escolhida); `null` quando pronto. */
  mainBlocker: ReadinessItem | null;
  blockerCount: number;
}

/**
 * Classifica um processo a partir do resultado do checklist.
 *
 * PRONTO => PRONTO_PARA_AUTOMACAO. Caso contrario, escolhe a categoria de maior
 * precedencia entre os bloqueios presentes; se nenhum bloqueio casar com uma
 * categoria conhecida, cai em BLOQUEADO_OUTROS. A escolha e deterministica:
 * depende so dos codigos e da ordem fixa de precedencia.
 */
export function classifyReadiness(readiness: AutomationReadiness): QueueClassification {
  if (readiness.status === "PRONTO_PARA_AUTOMACAO") {
    return {
      category: "PRONTO_PARA_AUTOMACAO",
      status: readiness.status,
      ready: true,
      mainBlocker: null,
      blockerCount: 0,
    };
  }

  const present = new Set(
    readiness.blockers
      .map((blocker) => blockerCategory(blocker.code))
      .filter((category): category is AutomationQueueCategory => category !== null),
  );

  const category =
    BLOCKER_CATEGORY_PRECEDENCE.find((candidate) => present.has(candidate)) ?? "BLOQUEADO_OUTROS";

  // Bloqueio principal: o 1o da categoria escolhida (na ordem do checklist);
  // no fallback, o 1o bloqueio qualquer. Status NAO_PRONTO garante >= 1 bloqueio.
  const mainBlocker =
    category === "BLOQUEADO_OUTROS"
      ? (readiness.blockers[0] ?? null)
      : (readiness.blockers.find((blocker) => blockerCategory(blocker.code) === category) ??
        readiness.blockers[0] ??
        null);

  return {
    category,
    status: readiness.status,
    ready: false,
    mainBlocker,
    blockerCount: readiness.blockers.length,
  };
}

export interface AutomationQueueGroup<T> {
  category: AutomationQueueCategory;
  label: string;
  rows: T[];
}

/**
 * Agrupa linhas ja classificadas na ordem canonica das categorias (pronto
 * primeiro). Categorias vazias sao mantidas — a fila mostra a contagem zero.
 */
export function groupByCategory<T extends { category: AutomationQueueCategory }>(
  rows: readonly T[],
): AutomationQueueGroup<T>[] {
  return AUTOMATION_QUEUE_CATEGORIES.map((category) => ({
    category,
    label: AUTOMATION_QUEUE_CATEGORY_LABELS[category],
    rows: rows.filter((row) => row.category === category),
  }));
}
