/**
 * Rotulos em portugues para os status do processo (docs/11 §10/§11).
 * Identificadores em ingles/enum; texto de UI em portugues (docs/16 §5).
 */
import {
  type DocumentStatus,
  type DocumentType,
  type InternalStatus,
  type UserFacingStatus,
} from "@prisma/client";

export const INTERNAL_STATUS_LABELS: Record<InternalStatus, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO_EM_FILA: "Pago / em fila",
  AGUARDANDO_LOGIN_GOVBR: "Aguardando login Gov.br",
  SESSAO_GOVBR_EXPIRADA: "Sessao Gov.br expirada",
  EM_PREENCHIMENTO_SINARM: "Em preenchimento (SINARM)",
  EM_REVISAO_HUMANA: "Em revisao humana",
  BLOQUEADO_INSTABILIDADE: "Bloqueado / instabilidade",
  EXCECAO_DOC_INVALIDO: "Excecao — doc invalido",
  EXCECAO_ARMA_DIVERGENTE: "Excecao — arma divergente",
  EXCECAO_DESTINO_INCOMPLETO: "Excecao — destino incompleto",
  PROTOCOLADO_GRU_GERADA: "Protocolado / GRU gerada",
  GRU_PAGA_EMPRESA: "GRU paga (empresa)",
  CONCLUIDO: "Concluido",
  CANCELADO_REEMBOLSADO: "Cancelado / reembolsado",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDENTE: "Pendente",
  ENVIADO: "Enviado",
  EM_ANALISE: "Em analise",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  IDENTIFICACAO_PESSOAL: "Documento de Identificacao Pessoal",
  OUTRO: "Outro",
};

export const USER_FACING_STATUS_LABELS: Record<UserFacingStatus, string> = {
  RECEBIDO: "Recebido",
  PAGAMENTO_CONFIRMADO: "Pagamento confirmado",
  AGUARDANDO_SEU_LOGIN_GOVBR: "Aguardando seu login Gov.br",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_SISTEMA_PF: "Aguardando o sistema da PF",
  PRECISAMOS_DE_UM_AJUSTE: "Precisamos de um ajuste",
  PROTOCOLADO: "Protocolado",
  CONCLUIDO: "Concluido",
  CANCELADO: "Cancelado",
};
