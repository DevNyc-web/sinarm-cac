/**
 * Prontidao para automacao — CHECKLIST PRE-EXECUCAO (motor interno).
 *
 * O destino do produto e a automacao (docs/25): a plataforma realizar o processo
 * sozinha ou quase. ANTES de qualquer automacao real existir, precisamos de um
 * motor que responda uma pergunta simples: "este processo esta PRONTO para a
 * automacao futura iniciar?" — e, se nao, liste EXATAMENTE o que falta.
 *
 * DECISAO DE MODELAGEM: como em `operationalSignals.ts`, tudo aqui e **DERIVADO**
 * do estado que ja existe (destino, arma/PCE, documentos, sugestoes, pagamento).
 * Nada e persistido, nada muda de schema, nada envelhece numa coluna. Modulo
 * PURO: sem Prisma, sem I/O, sem rede.
 *
 * LIMITES INEGOCIAVEIS desta etapa (docs/00 §8, docs/15, docs/25 §9):
 *  - NAO executa nenhuma acao — so avalia e descreve.
 *  - NAO altera status, NAO cria pagamento, NAO chama provedor.
 *  - NAO acessa Gov.br/SINARM, NAO usa OCR/IA real, NAO chama API externa.
 *  - NAO existe robo: "pronto" apenas habilita a decisao humana de seguir.
 */
import { type PaymentStatus } from "@prisma/client";
import {
  DOCUMENT_KIND_LABELS,
  documentRequirementsFor,
  guiaTrafegoRequirements,
  resolveRequirementState,
  type DocumentFieldSuggestion,
  type DocumentRequirement,
  type IntakeDocument,
} from "@/server/documents";
import { isSuggestionApplicable } from "@/server/documents/documentSuggestionApply";

export const AUTOMATION_READINESS_STATUSES = [
  "PRONTO_PARA_AUTOMACAO",
  "NAO_PRONTO_PARA_AUTOMACAO",
] as const;

export type AutomationReadinessStatus = (typeof AUTOMATION_READINESS_STATUSES)[number];

export const AUTOMATION_READINESS_LABELS: Record<AutomationReadinessStatus, string> = {
  PRONTO_PARA_AUTOMACAO: "Pronto para automação",
  NAO_PRONTO_PARA_AUTOMACAO: "Não pronto para automação",
};

/** Item do checklist — codigo estavel + rotulo amigavel para a tela. */
export interface ReadinessItem {
  code: string;
  label: string;
}

export interface AutomationReadiness {
  status: AutomationReadinessStatus;
  label: string;
  /** Impedem a automacao futura de iniciar. Vazio => pronto. */
  blockers: ReadinessItem[];
  /** Recomendaveis, mas NAO impedem — a decisao segue possivel. */
  warnings: ReadinessItem[];
  /** O que ja esta em ordem. */
  completed: ReadinessItem[];
}

/** Valores do destino (model `Destination`) necessarios para a avaliacao. */
export interface DestinationFields {
  eventName: string;
  uf: string;
  city: string;
  street: string;
  number: string;
}

/**
 * Retrato minimo do processo — so o necessario para derivar a prontidao.
 * Quem chama monta a partir do estado que ja existe (nada e buscado aqui).
 */
export interface AutomationReadinessSnapshot {
  /** Codigo do tipo de processo (define os requisitos de documento). */
  processTypeCode: string;
  destination: DestinationFields | null;
  /** `true` se ha ao menos um FirearmPce indicado. */
  hasFirearmPce: boolean;
  /** Documentos ja persistidos (metadados) — estado derivado por requisito. */
  documents: readonly IntakeDocument[];
  /** Sugestoes de preenchimento geradas no servidor (destino.*). */
  suggestions: readonly DocumentFieldSuggestion[];
  /** Status do pagamento do servico (sandbox/dev). `null` => nenhuma cobranca. */
  paymentStatus: PaymentStatus | null;
}

/** Campos do destino avaliados, na ordem em que aparecem na tela. */
const DESTINATION_FIELDS: ReadonlyArray<{
  key: keyof DestinationFields;
  code: string;
  label: string;
}> = [
  { key: "eventName", code: "DESTINO_NOME_AUSENTE", label: "Destino: nome do evento/clube" },
  { key: "uf", code: "DESTINO_UF_AUSENTE", label: "Destino: UF" },
  { key: "city", code: "DESTINO_CIDADE_AUSENTE", label: "Destino: cidade" },
  { key: "street", code: "DESTINO_LOGRADOURO_AUSENTE", label: "Destino: logradouro" },
  { key: "number", code: "DESTINO_NUMERO_AUSENTE", label: "Destino: número" },
];

/** `true` quando o campo do destino esta preenchido (nao vazio/so espacos). */
function hasValue(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Bloqueios de DESTINO — um por campo faltante; ausente total vira um so. */
function checkDestination(snapshot: AutomationReadinessSnapshot): {
  blockers: ReadinessItem[];
  completed: ReadinessItem[];
} {
  const destination = snapshot.destination;
  if (!destination) {
    return {
      blockers: [{ code: "DESTINO_AUSENTE", label: "Destino/evento não informado" }],
      completed: [],
    };
  }

  const missing = DESTINATION_FIELDS.filter((field) => !hasValue(destination[field.key]));
  if (missing.length > 0) {
    return {
      blockers: missing.map((field) => ({ code: field.code, label: field.label })),
      completed: [],
    };
  }

  return {
    blockers: [],
    completed: [{ code: "DESTINO_COMPLETO", label: "Destino/evento completo" }],
  };
}

/** Bloqueio de ARMA/PCE — sem ao menos um FirearmPce, nao ha o que automatizar. */
function checkFirearm(snapshot: AutomationReadinessSnapshot): {
  blockers: ReadinessItem[];
  completed: ReadinessItem[];
} {
  if (snapshot.hasFirearmPce) {
    return {
      blockers: [],
      completed: [{ code: "PCE_INDICADO", label: "Arma/PCE indicada" }],
    };
  }
  return {
    blockers: [{ code: "PCE_AUSENTE", label: "Nenhuma arma/PCE indicada" }],
    completed: [],
  };
}

/** Requisitos do processo (default: Guia de Trafego, unico processo do MVP). */
function requirementsFor(processTypeCode: string): readonly DocumentRequirement[] {
  // documentRequirementsFor devolve [] para codigo desconhecido; nesta etapa so
  // ha a Guia de Trafego, entao caimos nela para nao esvaziar o checklist.
  const requirements = documentRequirementsFor(processTypeCode);
  return requirements.length > 0 ? requirements : guiaTrafegoRequirements();
}

/**
 * Bloqueios de DOCUMENTOS OBRIGATORIOS + alertas dos RECOMENDADOS.
 *
 * Obrigatorio (tier OBRIGATORIO_MVP) bloqueia quando: ausente, enviado mas nao
 * aprovado/conferido, ou rejeitado. So APROVADO libera. Recomendado que ainda
 * nao esteja aprovado vira ALERTA — nao bloqueia.
 */
function checkDocuments(snapshot: AutomationReadinessSnapshot): {
  blockers: ReadinessItem[];
  warnings: ReadinessItem[];
  completed: ReadinessItem[];
} {
  const blockers: ReadinessItem[] = [];
  const warnings: ReadinessItem[] = [];
  const completed: ReadinessItem[] = [];

  for (const req of requirementsFor(snapshot.processTypeCode)) {
    if (req.tier !== "OBRIGATORIO_MVP" && req.tier !== "RECOMENDADO") continue;

    const { state, pending } = resolveRequirementState(req.kind, snapshot.documents);
    const title = DOCUMENT_KIND_LABELS[req.kind];

    if (state === "APROVADO") {
      completed.push({ code: `DOC_${req.kind}_APROVADO`, label: `${title}: aprovado` });
      continue;
    }

    if (req.tier === "RECOMENDADO") {
      warnings.push({
        code: `DOC_${req.kind}_RECOMENDADO_PENDENTE`,
        label: `${title}: recomendado, ainda não aprovado`,
      });
      continue;
    }

    // Obrigatorio nao aprovado — motivo exato.
    if (pending) {
      blockers.push({ code: `DOC_${req.kind}_AUSENTE`, label: `${title}: não enviado` });
    } else if (state === "REJEITADO") {
      blockers.push({ code: `DOC_${req.kind}_REJEITADO`, label: `${title}: rejeitado` });
    } else {
      // ENVIADO / EM_ANALISE: ha arquivo, mas ninguem aprovou/conferiu.
      blockers.push({
        code: `DOC_${req.kind}_NAO_APROVADO`,
        label: `${title}: enviado, aguardando conferência`,
      });
    }
  }

  return { blockers, warnings, completed };
}

/**
 * Bloqueio de SUGESTOES pendentes de destino.
 *
 * Antes da automacao, uma sugestao aplicavel (destino.*) precisa ser aplicada ou
 * decidida — nao pode ficar pendente. Usa a MESMA regra da tela de aplicacao
 * (`isSuggestionApplicable`): so conta o que virou botao de "aplicar".
 */
function checkSuggestions(snapshot: AutomationReadinessSnapshot): {
  blockers: ReadinessItem[];
  completed: ReadinessItem[];
} {
  const pending = snapshot.suggestions.filter(isSuggestionApplicable);
  if (pending.length > 0) {
    return {
      blockers: [
        {
          code: "SUGESTAO_DESTINO_PENDENTE",
          label: `Sugestão de destino pendente (${pending.length}) — aplicar ou ignorar`,
        },
      ],
      completed: [],
    };
  }
  return {
    blockers: [],
    completed: [{ code: "SEM_SUGESTAO_PENDENTE", label: "Nenhuma sugestão pendente" }],
  };
}

/**
 * Bloqueio de PAGAMENTO (sandbox/dev). So `PAGO` libera. NAO cria pagamento,
 * NAO chama provedor — apenas le o status que ja existe.
 */
function checkPayment(snapshot: AutomationReadinessSnapshot): {
  blockers: ReadinessItem[];
  completed: ReadinessItem[];
} {
  if (snapshot.paymentStatus === "PAGO") {
    return {
      blockers: [],
      completed: [{ code: "PAGAMENTO_CONFIRMADO", label: "Pagamento confirmado (sandbox/dev)" }],
    };
  }
  return {
    blockers: [
      {
        code: "PAGAMENTO_PENDENTE",
        label: "Pagamento do serviço ainda não confirmado (sandbox/dev)",
      },
    ],
    completed: [],
  };
}

/**
 * Avaliacao derivada de prontidao para automacao.
 *
 * Junta os cinco checks (destino, arma/PCE, documentos, sugestoes, pagamento). O
 * status e PRONTO_PARA_AUTOMACAO se — e somente se — nao houver NENHUM bloqueio.
 * Alertas nunca mudam o status.
 */
export function deriveAutomationReadiness(
  snapshot: AutomationReadinessSnapshot,
): AutomationReadiness {
  const destination = checkDestination(snapshot);
  const firearm = checkFirearm(snapshot);
  const documents = checkDocuments(snapshot);
  const suggestions = checkSuggestions(snapshot);
  const payment = checkPayment(snapshot);

  const blockers: ReadinessItem[] = [
    ...destination.blockers,
    ...firearm.blockers,
    ...documents.blockers,
    ...suggestions.blockers,
    ...payment.blockers,
  ];

  const warnings: ReadinessItem[] = [...documents.warnings];

  const completed: ReadinessItem[] = [
    ...destination.completed,
    ...firearm.completed,
    ...documents.completed,
    ...suggestions.completed,
    ...payment.completed,
  ];

  const status: AutomationReadinessStatus =
    blockers.length === 0 ? "PRONTO_PARA_AUTOMACAO" : "NAO_PRONTO_PARA_AUTOMACAO";

  return {
    status,
    label: AUTOMATION_READINESS_LABELS[status],
    blockers,
    warnings,
    completed,
  };
}
