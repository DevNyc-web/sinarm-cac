/**
 * Central de ajuda — TOPICOS (dominio puro).
 *
 * Conteudo de PRODUTO: explica ao cliente como usar o nosso sistema. Nao e
 * material oficial de orgao publico, nao descreve integracao com Gov.br/SINARM
 * e nao promete prazo nem deferimento (docs/24 §14).
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */

export interface HelpTopic {
  /** Ancora estavel da secao (usada em links do tipo /ajuda#gov-br). */
  id: string;
  question: string;
  summary: string;
  steps?: readonly string[];
  /** Observacao de conformidade/seguranca exibida ao pe do topico. */
  note?: string;
}

/**
 * Frase unica sobre credencial de orgao. Repetida de proposito em varios
 * pontos: e a defesa do usuario contra golpe de phishing em nosso nome.
 */
export const NEVER_ASK_GOVBR_CREDENTIALS =
  "Nunca pedimos sua senha, código ou token do Gov.br — nem aqui dentro, nem por WhatsApp, nem por e-mail.";

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    id: "criar-conta",
    question: "Como criar sua conta",
    summary:
      "A conta é do nosso sistema. Com ela você acompanha tudo em um lugar só: seus pedidos, os documentos enviados, os pagamentos e o status de cada etapa.",
    steps: [
      "Clique em “Criar conta” e informe seu nome, seu e-mail e uma senha.",
      "Use uma senha que você não use em nenhum outro site.",
      "Depois é só entrar com esse e-mail e essa senha para ver seus pedidos no painel.",
    ],
    note: `Esta conta não é o Gov.br. ${NEVER_ASK_GOVBR_CREDENTIALS}`,
  },
  {
    id: "enviar-documentos",
    question: "Como enviar documentos",
    summary:
      "Cada pedido mostra a lista de documentos necessários e o que ainda está faltando. Você envia por ali e acompanha a conferência.",
    steps: [
      "Abra o pedido no seu painel e veja a lista de documentos.",
      "Envie um arquivo por documento — foto legível ou PDF, com o documento inteiro visível.",
      "Cada documento passa por conferência da nossa equipe e fica marcado como enviado, aprovado ou recusado.",
      "Se algum for recusado, explicamos o motivo e você reenvia pelo mesmo lugar.",
    ],
    note: "Envie os documentos aqui dentro, pelo próprio pedido — é onde eles ficam organizados e ligados ao seu processo.",
  },
  {
    id: "acompanhar-pedido",
    question: "Como acompanhar seu pedido",
    summary:
      "O painel mostra em que etapa cada pedido está, o que já aconteceu e qual é o próximo passo.",
    steps: [
      "Entre na sua conta e abra o painel.",
      "Cada pedido mostra o status atual e o histórico das etapas.",
      "Quando precisamos de algo de você, o pedido diz exatamente o que ajustar.",
      "Se o status não mudar por um tempo, isso costuma significar que o pedido está com o órgão competente.",
    ],
    note: "Não informamos prazo de análise: esse tempo é do órgão competente e não depende de nós.",
  },
  {
    id: "gov-br",
    question: "Quando posso precisar acessar o Gov.br?",
    summary:
      "Algumas etapas acontecem em sistemas do governo e exigem autenticação. Quando isso for necessário, quem faz o login é você, na janela oficial.",
    steps: [
      "Antes disso, nós preparamos e conferimos com você os dados e os documentos.",
      "Na hora em que a etapa exigir autenticação no órgão, você faz o login diretamente na janela oficial.",
      "Sua credencial do Gov.br não passa por aqui: não pedimos, não vemos, não guardamos e não reutilizamos.",
    ],
    note: `Se alguém pedir sua senha do Gov.br em nome deste serviço, desconfie. ${NEVER_ASK_GOVBR_CREDENTIALS}`,
  },
  {
    id: "status",
    question: "O que significam os status?",
    summary:
      "Usamos nomes simples para cada etapa do pedido. Veja abaixo o que cada um quer dizer na prática.",
    note: "Status é informação de acompanhamento do nosso serviço. Ele não substitui nem antecipa a decisão do órgão competente.",
  },
  {
    id: "suporte",
    question: "Como falar com suporte",
    summary:
      "Você fala com uma pessoa da nossa equipe quando precisar, em qualquer etapa. Sem robô no lugar de gente quando o assunto é importante.",
    steps: [
      "Use o botão de suporte no fim desta página.",
      "Diga o número ou o nome do pedido — assim a gente já abre o seu caso.",
      "Se a dúvida for sobre um documento recusado, o próprio pedido já mostra o motivo.",
    ],
    note: NEVER_ASK_GOVBR_CREDENTIALS,
  },
];

/** Topico pelo id, ou `undefined` para id desconhecido (erro controlado). */
export function getHelpTopic(id: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.id === id);
}
