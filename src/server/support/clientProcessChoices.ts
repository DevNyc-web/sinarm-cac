/**
 * Escolha de processo do cliente novo — CONTEUDO (dominio puro).
 *
 * Decidido no docs/63: quem ainda nao tem processo e recebido por uma PERGUNTA
 * ("Qual processo voce deseja realizar?") e por opcoes em linguagem do cliente,
 * nao por uma lista vazia de "Meus processos".
 *
 * Este modulo e a fronteira entre o vocabulario do CLIENTE e o do SISTEMA:
 * traduz o catalogo (`processCatalog`) para nomes amigaveis e deriva a rota de
 * criacao da REGRA DE DISPONIBILIDADE que ja existe (`processAvailability`) —
 * sem duplicar a regra e sem lista hardcoded na UI.
 *
 * Serve as duas pontas da jornada: `clientProcessChoices()` para quem esta
 * ESCOLHENDO um processo, e `clientProcessName()` para quem ja TEM um e o ve
 * numa lista ou num detalhe (docs/61 §4.C).
 *
 * CTA FALSO E IMPOSSIVEL POR CONSTRUCAO (docs/63 §6.2): `href` e `cta` so
 * recebem valor quando o processo e realmente criavel hoje. Um processo em
 * preparacao nao tem para onde apontar, entao a UI nao tem o que renderizar.
 *
 * NAO promete automacao, aprovacao, deferimento nem prazo (docs/24 §14), e nao
 * confunde preparacao documental com execucao real: escolher aqui abre, no
 * maximo, um rascunho no NOSSO sistema.
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */
import { isLaunchProcessCode, type LaunchProcessCode } from "../processes/processCatalog";
import {
  IN_PREPARATION_MESSAGE,
  PROCESS_AVAILABILITY_LABELS,
  launchProcessEntries,
} from "../processes/processAvailability";
import { catalogCodeFromPersistedProcessTypeCode } from "../processes/processTypeMapping";

/** Pergunta de abertura da area logada de quem ainda nao tem processo. */
export const CLIENT_START_QUESTION = "Qual processo você deseja realizar?";

/**
 * Linha de apoio da pergunta. Curta de proposito (docs/63 §4.9) e alinhada ao
 * aviso ja usado em `/processos/novo`: escolher nao envia nada a orgao nenhum.
 */
export const CLIENT_START_HINT =
  "Escolha uma opção para começar. Nada é enviado a nenhum órgão nesta etapa.";

/** Rota do fluxo de criacao — hoje so a Guia de Trafego chega ate ela. */
const NEW_PROCESS_HREF = "/processos/novo";

/** Rotulo do CTA do processo disponivel. */
const START_CTA_LABEL = "Começar";

/**
 * Nome amigavel + explicacao curta, por processo do catalogo.
 *
 * O nome tecnico continua existindo e NAO muda: `CONCESSAO_CR` no catalogo,
 * `GUIA_TRAFEGO_PF_CAC` na persistencia (docs/60 §9.1). Esta camada e so o que
 * o cliente le. `Record` completo — processo novo no catalogo quebra o
 * typecheck ate ganhar nome de cliente, em vez de vazar o codigo tecnico na
 * tela.
 */
export const CLIENT_PROCESS_LABELS: Record<
  LaunchProcessCode,
  { label: string; name: string; blurb: string }
> = {
  CONCESSAO_CR: {
    label: "Tirar ou renovar meu CR",
    name: "Certificado de Registro (CR)",
    blurb: "Seu registro de CAC: primeira solicitação ou renovação.",
  },
  AUTORIZACAO_COMPRA: {
    label: "Comprar arma ou produto controlado",
    name: "Autorização de compra",
    blurb: "Autorização para adquirir arma ou produto controlado.",
  },
  EMISSAO_CRAF: {
    label: "Emitir documento da arma",
    name: "Documento da arma (CRAF)",
    blurb: "Documento de registro de uma arma que você já adquiriu.",
  },
  GUIA_TRAFEGO: {
    label: "Emitir Guia de Tráfego",
    name: "Guia de Tráfego",
    blurb: "Autorização para transportar sua arma até treino ou competição.",
  },
};

/**
 * Nome do processo para o CLIENTE, no registro de SUBSTANTIVO.
 *
 * Dois registros, de proposito (docs/61 §4.C):
 *  - `label` e ACAO — "Emitir Guia de Tráfego" —, para quem esta ESCOLHENDO;
 *  - `name` e COISA — "Guia de Tráfego" —, para quem ja TEM o processo.
 * Um pedido em "Meus processos" nao e um comando; ler "Emitir Guia de Tráfego"
 * numa linha de acompanhamento sugeriria que ha algo a fazer ali.
 *
 * Aceita o codigo PERSISTIDO (`process_types.code`, ex. `GUIA_TRAFEGO_PF_CAC`)
 * ou o do CATALOGO (ex. `GUIA_TRAFEGO`) — a UI passa o que tem em maos.
 *
 * `fallback` e o nome vindo do banco (`ProcessType.name`). Tipo fora do
 * catalogo continua exibivel: melhor um nome operacional do que um espaco
 * vazio. **Nao** confundir com `Process.code` (`CAC-YYYY-NNNNNN`, docs/62),
 * que e o NUMERO INTERNO do pedido e nao passa por aqui.
 */
export function clientProcessName(code: string, fallback: string): string {
  const catalogCode = isLaunchProcessCode(code)
    ? code
    : catalogCodeFromPersistedProcessTypeCode(code);
  return catalogCode ? CLIENT_PROCESS_LABELS[catalogCode].name : fallback;
}

/** Uma opcao da tela de escolha, ja pronta para render. */
export interface ClientProcessChoice {
  code: LaunchProcessCode;
  /** Nome amigavel — o que o cliente le. */
  label: string;
  /** Uma frase sobre o que e o processo. */
  blurb: string;
  available: boolean;
  /** Rota de criacao, ou `null` quando o processo ainda nao e criavel. */
  href: string | null;
  /** Rotulo do CTA, ou `null`. Sempre nulo junto com `href` — nunca CTA falso. */
  cta: string | null;
  /** Rotulo de estado para quem esta em preparacao, ou `null`. */
  statusLabel: string | null;
  /** Aviso de estado para quem esta em preparacao, ou `null`. */
  note: string | null;
}

/**
 * Opcoes para a tela do cliente novo, com o que da para fazer AGORA primeiro.
 *
 * A ordem do catalogo e a logica de dependencia (CR -> ... -> Guia), util para
 * quem opera; para quem esta escolhendo, o criavel vem antes. `sort` e estavel,
 * entao a ordem logica se mantem dentro de cada grupo.
 */
export function clientProcessChoices(): ClientProcessChoice[] {
  return launchProcessEntries()
    .map(({ definition, available }) => ({
      code: definition.code,
      ...CLIENT_PROCESS_LABELS[definition.code],
      available,
      href: available ? NEW_PROCESS_HREF : null,
      cta: available ? START_CTA_LABEL : null,
      statusLabel: available ? null : PROCESS_AVAILABILITY_LABELS.EM_PREPARACAO,
      note: available ? null : IN_PREPARATION_MESSAGE,
    }))
    .sort((a, b) => Number(b.available) - Number(a.available));
}
