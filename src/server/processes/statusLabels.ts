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
  AGUARDANDO_CONFIRMACAO_HUMANA: "Aguardando confirmacao humana",
  // "validacao humana", NAO "resolvendo captcha": o rotulo descreve o que o
  // sistema esta esperando (uma pessoa), nunca o mecanismo nem uma resolucao
  // automatica. Burlar captcha e proibido de forma permanente (docs/00 §8), e
  // rotulo de tela e onde essa promessa vaza primeiro.
  AGUARDANDO_CAPTCHA: "Aguardando validacao humana",
  // Candidatos aprovados pela Fase 5d (docs/47) — SEM CONSUMIDOR neste PR, mesmo
  // status dos dois rotulos acima. Rotulo tecnico para admin/diagnostico; nunca
  // fonte visual do cliente (docs/45 — clientVisibleStatusLabel nao le
  // internalStatus).
  DOCUMENTO_RECEBIDO_PARA_ANALISE: "Documento recebido para analise",
  DOCUMENTO_VALIDADO: "Documento validado",
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
  CR_REGISTRO_CAC: "CR / registro / autorizacao (CAC)",
  COMPROVANTE_ORIGEM_ENDERECO: "Comprovante de origem / endereco",
  DECLARACAO_DESTINO_EVENTO: "Declaracao do destino / evento",
  OUTRO: "Complementar / outro",
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

/**
 * O rotulo que o CLIENTE realmente ve no status do processo.
 *
 * FONTE UNICA desta regra. Antes ela existia inline no JSX da tela do cliente, e
 * o admin exibia OUTRA coisa — `userFacingStatus` — sob o rotulo "Status visivel
 * ao usuario". As duas divergiam em 4 dos 9 estados operacionais (ex.: com
 * `DOCUMENTO_ENVIADO` o cliente le "Documento em analise" e o admin dizia "Em
 * andamento"), entao um operador que confiasse na tela admin informava o cliente
 * errado.
 *
 * NAO usa `userFacingStatus`: aquela coluna nao alimenta nenhuma tela do
 * cliente. O que decidir sobre ela — promover ou deprecar — e decisao propria
 * (docs/44 §5.1), fora desta correcao.
 *
 * Regra: depois que a execucao manual comeca, ela e a visao mais atual do
 * processo e sobrepoe o status operacional (docs/21 §11).
 */
export function clientVisibleStatusLabel(process: {
  operationalStatus: OperationalStatus;
  manualExecutionStatus: ManualExecutionStatus;
}): string {
  return process.manualExecutionStatus === "EXECUCAO_MANUAL_NAO_INICIADA"
    ? OPERATIONAL_STATUS_USER_LABELS[process.operationalStatus]
    : MANUAL_EXECUTION_USER_LABELS[process.manualExecutionStatus];
}

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
