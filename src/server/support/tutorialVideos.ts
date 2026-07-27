/**
 * Videos tutoriais — CATALOGO (dominio puro).
 *
 * Estrutura visual pronta; os links ainda NAO existem. `url: null` significa
 * "ainda nao publicado" e a UI renderiza o botao desabilitado com "Em breve".
 * Preferimos ausencia de link a link falso: um placeholder navegavel levaria o
 * cliente para lugar nenhum (ou, pior, para um lugar que nao controlamos).
 *
 * REGRA DE CONFORMIDADE (docs/24 §5/§7/§14): os videos sao material NOSSO.
 * E proibido apontar para canal, video ou marca de orgao publico, ou produzir
 * qualquer coisa que possa passar por canal oficial do governo.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */

export interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  /** URL do nosso video, ou `null` enquanto nao houver publicacao. */
  url: string | null;
}

export const TUTORIAL_VIDEOS: readonly TutorialVideo[] = [
  {
    id: "criar-conta",
    title: "Como criar sua conta",
    description:
      "Passo a passo para criar a conta do nosso sistema e entrar pela primeira vez.",
    url: null,
  },
  {
    id: "enviar-documentos",
    title: "Como enviar seus documentos",
    description:
      "Como fotografar ou escanear, o que costuma ser recusado e como reenviar um documento.",
    url: null,
  },
  {
    id: "acompanhar-pedido",
    title: "Como acompanhar seu pedido",
    description:
      "Onde ver o status, o que cada etapa significa e o que fazer quando aparece uma pendência.",
    url: null,
  },
  {
    id: "gov-br",
    title: "Quando você precisa acessar o Gov.br",
    description:
      "Em quais momentos o login no órgão é feito por você, na janela oficial, e por que nunca pedimos sua senha.",
    url: null,
  },
  {
    id: "pagamentos-gru",
    title: "Pagamento do serviço e GRU",
    description:
      "A diferença entre o pagamento do nosso serviço e a GRU, que é taxa do órgão competente.",
    url: null,
  },
];

/** Aviso obrigatorio junto da secao de videos. */
export const TUTORIALS_DISCLAIMER =
  "Vídeos produzidos pela nossa equipe, para explicar o uso do nosso sistema. Não são material oficial de nenhum órgão público.";

/** Texto do botao quando ainda nao ha video publicado. */
export const TUTORIAL_UNAVAILABLE_LABEL = "Em breve";

/** `true` quando o video ja tem link publicado. */
export function isTutorialAvailable(video: TutorialVideo): boolean {
  return typeof video.url === "string" && video.url.length > 0;
}
