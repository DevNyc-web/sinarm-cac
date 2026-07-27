/**
 * Glossario de STATUS para o cliente (dominio puro, so explicacao de produto).
 *
 * ATENCAO — o que este modulo NAO e:
 *  - NAO e o enum do banco. Os status persistidos (`InternalStatus`,
 *    `OperationalStatus`, `UserFacingStatus` em prisma/schema) continuam como
 *    estao; NAO ha mudanca de schema nesta etapa e NAO ha mapeamento 1:1 aqui.
 *    Os rotulos tecnicos vivem em `src/server/processes/statusLabels.ts`.
 *  - NAO e integracao com orgao. Nenhum status aqui reflete consulta a
 *    Gov.br/SINARM/PF: sao etapas do NOSSO atendimento.
 *
 * Regras de texto (docs/24 §14): sem prazo de analise, sem promessa de
 * deferimento, sem sugerir que somos orgao publico.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */

/** Codigos de PRODUTO (documentacao/UI). Deliberadamente nao sao enum do banco. */
export const CLIENT_STATUS_CODES = [
  "PEDIDO_RECEBIDO",
  "DOCUMENTOS_PENDENTES",
  "DOCUMENTOS_APROVADOS",
  "PAGAMENTO_CONFIRMADO",
  "EM_PREPARACAO",
  "PROTOCOLADO",
  "AGUARDANDO_ANALISE",
  "PENDENCIA_ENCONTRADA",
  "DEFERIDO",
  "INDEFERIDO",
  "FINALIZADO",
  "CANCELADO",
] as const;

export type ClientStatusCode = (typeof CLIENT_STATUS_CODES)[number];

export interface ClientStatusExplanation {
  code: ClientStatusCode;
  label: string;
  description: string;
  /** O que se espera do cliente neste status ("nada por enquanto" e resposta valida). */
  whatYouDo: string;
}

export const CLIENT_STATUS_GUIDE: readonly ClientStatusExplanation[] = [
  {
    code: "PEDIDO_RECEBIDO",
    label: "Pedido recebido",
    description:
      "Recebemos seu pedido e ele entrou na fila de conferência da nossa equipe. Nada foi enviado ao órgão ainda.",
    whatYouDo: "Nada por enquanto — avisamos assim que precisarmos de algo.",
  },
  {
    code: "DOCUMENTOS_PENDENTES",
    label: "Documentos pendentes",
    description:
      "Falta algum documento, ou um dos arquivos enviados precisa ser refeito (ilegível, cortado ou vencido).",
    whatYouDo: "Abra o pedido: a lista mostra o que falta e o motivo de cada recusa.",
  },
  {
    code: "DOCUMENTOS_APROVADOS",
    label: "Documentos aprovados",
    description:
      "Nossa equipe conferiu os documentos e eles estão adequados para seguir. Esta é uma conferência nossa, não uma decisão do órgão.",
    whatYouDo: "Nada — seguimos para a próxima etapa.",
  },
  {
    code: "PAGAMENTO_CONFIRMADO",
    label: "Pagamento confirmado",
    description:
      "O pagamento do nosso serviço foi confirmado. A GRU, quando o processo exigir, é taxa do órgão competente e é cobrada à parte.",
    whatYouDo: "Nada — o comprovante fica guardado no pedido.",
  },
  {
    code: "EM_PREPARACAO",
    label: "Em preparação",
    description:
      "Estamos organizando e conferindo os dados do seu pedido para deixá-lo pronto antes do protocolo.",
    whatYouDo: "Fique atento: é aqui que costumamos tirar as últimas dúvidas com você.",
  },
  {
    code: "PROTOCOLADO",
    label: "Protocolado",
    description:
      "O pedido foi registrado no órgão e existe um número de protocolo. Protocolado não significa aprovado.",
    whatYouDo: "Guarde o número do protocolo — ele fica disponível no pedido.",
  },
  {
    code: "AGUARDANDO_ANALISE",
    label: "Aguardando análise",
    description:
      "O pedido está com o órgão competente. A análise e o tempo de resposta são do órgão — não temos como acelerar nem prever a data.",
    whatYouDo: "Nada — avisamos assim que houver movimentação.",
  },
  {
    code: "PENDENCIA_ENCONTRADA",
    label: "Pendência encontrada",
    description:
      "Apareceu algo a corrigir: pode ser exigência do órgão ou um ponto que a nossa conferência identificou.",
    whatYouDo: "Abra o pedido: dizemos exatamente o que precisa ser ajustado.",
  },
  {
    code: "DEFERIDO",
    label: "Deferido",
    description:
      "O órgão competente decidiu de forma favorável ao pedido. A decisão é sempre do órgão, nunca nossa.",
    whatYouDo: "Confira no pedido os documentos e as orientações do que vem depois.",
  },
  {
    code: "INDEFERIDO",
    label: "Indeferido",
    description:
      "O órgão competente não aprovou o pedido. Registramos o motivo informado pelo órgão.",
    whatYouDo: "Fale com o suporte para entender os caminhos possíveis a partir daqui.",
  },
  {
    code: "FINALIZADO",
    label: "Finalizado",
    description:
      "O atendimento foi encerrado. O resultado e os documentos continuam disponíveis no seu pedido.",
    whatYouDo: "Nada — o histórico fica salvo na sua conta.",
  },
  {
    code: "CANCELADO",
    label: "Cancelado",
    description:
      "O pedido foi encerrado antes da conclusão, a seu pedido ou por um impedimento que inviabilizou seguir.",
    whatYouDo: "Se houver valor a devolver, seguimos a nossa política de reembolso.",
  },
];

/**
 * Aviso que acompanha o glossario na UI. Deixa explicito que este e um
 * vocabulario do NOSSO atendimento, e nao um espelho do sistema do orgao.
 */
export const CLIENT_STATUS_GUIDE_NOTE =
  "Estes nomes descrevem as etapas do nosso atendimento. Não são o sistema do órgão competente, não indicam prazo e não antecipam a decisão dele.";

/** Explicacao por codigo, ou `undefined` para codigo desconhecido. */
export function getClientStatusExplanation(
  code: string,
): ClientStatusExplanation | undefined {
  return CLIENT_STATUS_GUIDE.find((status) => status.code === code);
}
