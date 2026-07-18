/**
 * RBAC estrutural — matriz de permissoes por perfil interno.
 *
 * Fonte: docs/11 §3 (tabela "Permissoes por perfil"). Esta e a UNICA fonte de
 * verdade de permissao no app: paginas e services devem consultar `hasPermission`,
 * nunca comparar `role` diretamente.
 *
 * Nada aqui depende de auth real — a matriz continua valida quando o provedor
 * definitivo entrar (docs/15 §3.8/§3.9).
 */
import { type Role } from "./roles";

export const PERMISSIONS = [
  "queue.view", // Ver fila de processos
  "process.detail.view", // Ver detalhe do processo
  "process.pii.viewFull", // Ver PII completa (CPF, docs)
  "process.pii.viewMinimal", // Ver apenas o minimo necessario de PII
  "sinarm.execute", // Executar fluxo no SINARM/CAC
  "review.checklist", // Aplicar/registrar checklist de revisao
  "gru.generate", // Clicar "Gerar GRU e Salvar" (irreversivel)
  "payment.pix.confirm", // Confirmar Pix do cliente
  "payment.gru.register", // Registrar pagamento da GRU (empresa)
  "refund.approve", // Aprovar reembolso
  "message.send", // Enviar mensagens ao usuario
  "internalUsers.manage", // Gerenciar usuarios internos/permissoes
  "audit.view.all", // Ver todos os logs/auditoria
  "audit.view.own", // Ver os proprios logs
  "audit.view.financial", // Ver logs financeiros
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Rotulos em portugues para exibir permissoes na UI do painel. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "queue.view": "Ver fila de processos",
  "process.detail.view": "Ver detalhe do processo",
  "process.pii.viewFull": "Ver PII completa (CPF, documentos)",
  "process.pii.viewMinimal": "Ver PII — minimo necessario",
  "sinarm.execute": "Executar fluxo no SINARM/CAC",
  "review.checklist": "Aplicar checklist de revisao",
  "gru.generate": 'Clicar "Gerar GRU e Salvar"',
  "payment.pix.confirm": "Confirmar Pix do cliente",
  "payment.gru.register": "Registrar pagamento da GRU (empresa)",
  "refund.approve": "Aprovar reembolso",
  "message.send": "Enviar mensagens ao usuario",
  "internalUsers.manage": "Gerenciar usuarios internos e permissoes",
  "audit.view.all": "Ver logs/auditoria (todos)",
  "audit.view.own": "Ver logs/auditoria (proprios)",
  "audit.view.financial": "Ver logs/auditoria (financeiros)",
};

/**
 * Matriz perfil -> permissoes (docs/11 §3).
 *
 * Segregacao de funcoes: quem executa o protocolo (OPERADOR) nao libera
 * pagamento; quem libera pagamento (FINANCEIRO) nao executa o SINARM.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Usuario final do app: nenhuma permissao de operacao interna.
  USER: [],

  // Admin ve tudo e resolve excecoes.
  ADMIN: PERMISSIONS,

  OPERADOR: [
    "queue.view",
    "process.detail.view",
    "process.pii.viewFull",
    "sinarm.execute",
    "review.checklist",
    "gru.generate",
    "message.send",
    "audit.view.own",
  ],

  FINANCEIRO: [
    "queue.view",
    "process.detail.view",
    "process.pii.viewFull",
    "payment.pix.confirm",
    "payment.gru.register",
    "refund.approve",
    "message.send",
    "audit.view.financial",
  ],

  SUPORTE: [
    "queue.view",
    "process.detail.view",
    "process.pii.viewMinimal",
    "message.send",
    "audit.view.own",
  ],
};

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
