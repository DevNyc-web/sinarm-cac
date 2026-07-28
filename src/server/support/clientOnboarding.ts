/**
 * Jornada inicial do cliente — conteudo da area logada (dominio puro).
 *
 * Explica o que fazer depois de entrar. NAO promete automacao, aprovacao,
 * deferimento nem prazo (docs/24 §14): descreve o NOSSO atendimento, cujas
 * etapas oficiais continuam sendo feitas fora deste site, pelo proprio cliente.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */

export interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  /** Rota interna do proximo passo, ou `null` quando e so orientacao. */
  href: string | null;
  /** Rotulo do link/acao. `null` quando o passo nao tem acao propria ainda. */
  action: string | null;
}

/**
 * Passos na ordem em que o cliente os encontra.
 *
 * "Enviar documentos" nao tem rota propria: o envio acontece DENTRO do pedido.
 * Deixar `href: null` evita prometer uma tela que nao existe — o card orienta,
 * e a acao real fica no pedido.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "abrir-pedido",
    title: "1. Abra seu pedido",
    body: "Escolha o serviço, informe os dados básicos e salve. Dá para deixar como rascunho e continuar depois.",
    href: "/processos/novo",
    action: "Abrir pedido",
  },
  {
    id: "enviar-documentos",
    title: "2. Envie os documentos",
    body: "Cada pedido mostra a lista do que é necessário. Você envia por lá e uma pessoa da nossa equipe confere antes de seguir.",
    href: null,
    action: null,
  },
  {
    id: "pagamento",
    title: "3. Confirme o pagamento",
    body: "Você paga o nosso serviço. A GRU, quando o processo exigir, é taxa do órgão competente e é cobrada à parte.",
    href: null,
    action: null,
  },
  {
    id: "acompanhar",
    title: "4. Acompanhe o status",
    body: "O painel mostra em que etapa o pedido está e o que fazer no próximo passo, em linguagem simples.",
    href: "/ajuda#guia-de-status",
    action: "Ver o que cada status significa",
  },
];

/**
 * Microcopy de confianca. Frases curtas, repetidas nos pontos em que o cliente
 * forma expectativa — e a defesa dele contra golpe feito em nosso nome.
 */
export const TRUST_NOTES: readonly string[] = [
  "Sua conta permite acompanhar seus pedidos em um só lugar.",
  "Não somos órgão público.",
  "Não pedimos senha Gov.br.",
  "Quando uma etapa oficial exigir Gov.br, você acessará o ambiente oficial.",
  "O acompanhamento no nosso painel mostra o status operacional do atendimento.",
];

/** Aviso fixo sobre etapas oficiais — sempre visivel na area logada. */
export const OFFICIAL_STEPS_NOTICE =
  "Algumas etapas oficiais podem exigir acesso ao ambiente Gov.br/PF, sempre fora deste site.";

/**
 * Saudacao pelo primeiro nome.
 *
 * "Ola" e nao "Bem-vindo": o cliente pode ser de qualquer genero e o cadastro
 * nao pergunta isso. "Boas-vindas" (substantivo) e usado como titulo do card
 * pelo mesmo motivo — flexionar o adjetivo erraria com metade das pessoas.
 */
export function greetingFor(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first ? `Olá, ${first}` : "Olá";
}

/** Titulo do card de entrada — neutro de proposito (ver `greetingFor`). */
export const WELCOME_TITLE = "Boas-vindas";

/** Passo por id, ou `undefined` para id desconhecido (erro controlado). */
export function getOnboardingStep(id: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === id);
}
