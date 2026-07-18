/**
 * Rotulos em portugues para os status do processo (docs/11 §10/§11).
 * Identificadores em ingles/enum; texto de UI em portugues (docs/16 §5).
 */
import {
  type DocumentStatus,
  type DocumentType,
  type InternalStatus,
  type ManualExecutionStatus,
  type NoteVisibility,
  type OperationalStatus,
  type PaymentStatus,
  type ProcessPriority,
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

/** Status operacional da fila (Fase 6) — rotulo para a equipe interna. */
export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  RASCUNHO: "Rascunho",
  DOCUMENTO_ENVIADO: "Documento enviado",
  DOCUMENTO_APROVADO: "Documento aprovado",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO_EM_FILA: "Pago / em fila",
  EM_REVISAO_OPERACIONAL: "Em revisao operacional",
  PRONTO_PARA_PROTOCOLO_MANUAL: "Pronto para protocolo manual",
  BLOQUEADO: "Bloqueado",
  CANCELADO_DEV: "Cancelado (dev)",
};

/**
 * Como o USUARIO ve cada status operacional (docs/11 §11: tom amigavel, sem a
 * granularidade interna e sem prometer aprovacao).
 */
export const OPERATIONAL_STATUS_USER_LABELS: Record<OperationalStatus, string> = {
  RASCUNHO: "Recebido",
  DOCUMENTO_ENVIADO: "Documento em analise",
  DOCUMENTO_APROVADO: "Documento aprovado",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO_EM_FILA: "Pagamento confirmado — em fila",
  EM_REVISAO_OPERACIONAL: "Em andamento",
  PRONTO_PARA_PROTOCOLO_MANUAL: "Em andamento",
  BLOQUEADO: "Precisamos de um ajuste",
  CANCELADO_DEV: "Cancelado",
};

/**
 * Etapas da execucao assistida MANUAL (Fase 7) — rotulo interno.
 * Os textos descrevem o que o OPERADOR HUMANO fez fora do app.
 */
export const MANUAL_EXECUTION_LABELS: Record<ManualExecutionStatus, string> = {
  EXECUCAO_MANUAL_NAO_INICIADA: "Execucao manual nao iniciada",
  GOVBR_ABERTO_PELO_OPERADOR: "Gov.br aberto pelo operador (fora do app)",
  SINARM_ABERTO_PELO_OPERADOR: "SINARM aberto pelo operador (fora do app)",
  FORMULARIO_PREENCHIDO_MANUALMENTE: "Formulario preenchido manualmente",
  CHECKPOINT_DADOS_GRU_CONFERIDO: "Checkpoint 'Dados da GRU' conferido",
  PROTOCOLO_MANUAL_REGISTRADO: "Protocolo registrado manualmente",
  GRU_MANUAL_REGISTRADA: "GRU registrada manualmente",
  AGUARDANDO_PAGAMENTO_GRU_EMPRESA: "Aguardando pagamento da GRU (empresa)",
  GRU_PAGA_MANUALMENTE_DEV: "GRU paga manualmente (dev)",
  BLOQUEADO_OPERACIONALMENTE: "Bloqueado operacionalmente",
};

/**
 * Como o USUARIO ve a execucao manual (docs/21 §11).
 * Tom neutro e honesto: nunca sugerir que o app operou o orgao.
 */
export const MANUAL_EXECUTION_USER_LABELS: Record<ManualExecutionStatus, string> = {
  EXECUCAO_MANUAL_NAO_INICIADA: "Em revisao",
  GOVBR_ABERTO_PELO_OPERADOR: "Em execucao",
  SINARM_ABERTO_PELO_OPERADOR: "Em execucao",
  FORMULARIO_PREENCHIDO_MANUALMENTE: "Em execucao",
  CHECKPOINT_DADOS_GRU_CONFERIDO: "Em execucao",
  PROTOCOLO_MANUAL_REGISTRADO: "Protocolo registrado",
  GRU_MANUAL_REGISTRADA: "GRU registrada",
  AGUARDANDO_PAGAMENTO_GRU_EMPRESA: "Aguardando pagamento da GRU",
  GRU_PAGA_MANUALMENTE_DEV: "Em acompanhamento",
  BLOQUEADO_OPERACIONALMENTE: "Bloqueado — precisa de ajuste",
};

export const PRIORITY_LABELS: Record<ProcessPriority, string> = {
  BAIXA: "Baixa",
  NORMAL: "Normal",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const NOTE_VISIBILITY_LABELS: Record<NoteVisibility, string> = {
  INTERNA: "Nota interna",
  VISIVEL_USUARIO: "Mensagem ao usuario",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDENTE: "Pendente",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  EXPIRADO: "Expirado",
  CANCELADO: "Cancelado",
  FALHOU: "Falhou",
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
