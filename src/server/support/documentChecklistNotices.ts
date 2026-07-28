/**
 * Avisos da tela de checklist de documentos (dominio puro).
 *
 * Contem SO a microcopy da tela — a lista de documentos continua vindo de
 * `documents/documentRequirements.ts` (`guiaTrafegoRequirements`). Nao existe
 * checklist paralelo aqui: duplicar a lista faria as duas divergirem.
 *
 * O aviso de etapas oficiais e REUSADO de `clientOnboarding` em vez de reescrito:
 * e a mesma mensagem que o painel de entrada ja mostra, e repetir o texto em dois
 * lugares deixaria um dos dois desatualizado.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */
import { OFFICIAL_STEPS_NOTICE } from "./clientOnboarding";

/** Titulo e chamada da tela — enquadram o checklist como operacional. */
export const CHECKLIST_TITLE = "Checklist da Guia de Tráfego";

export const CHECKLIST_INTRO =
  "Itens que normalmente precisamos conferir para preparar seu atendimento. " +
  "Pode haver solicitação adicional conforme o caso.";

/**
 * Avisos de seguranca da tela.
 *
 * As duas primeiras frases sao a defesa do cliente contra golpe feito em nosso
 * nome; as duas ultimas evitam que o checklist seja lido como promessa de
 * resultado. `OFFICIAL_STEPS_NOTICE` entra reusado, sem copia.
 */
export const CHECKLIST_SECURITY_NOTES: readonly string[] = [
  "Não envie senha Gov.br.",
  "Nunca pediremos código, token ou senha Gov.br dentro deste site.",
  OFFICIAL_STEPS_NOTICE,
  "A análise e a decisão são do órgão competente.",
  "Este checklist organiza o atendimento e não garante aprovação.",
];

/**
 * Onde o envio realmente acontece. A tela e SO leitura: o upload e a conferencia
 * seguem no fluxo do pedido, que ja existe — nao ha anexo aqui.
 */
export const CHECKLIST_UPLOAD_NOTICE =
  "Esta página é apenas informativa. O envio dos arquivos e a conferência acontecem dentro do seu pedido.";

/** Explica a legenda de estados sem prometer prazo de analise. */
export const CHECKLIST_STATE_LEGEND_INTRO =
  "Dentro do pedido, cada documento aparece com um destes estados:";
