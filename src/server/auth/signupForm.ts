/**
 * Validacao de FORMULARIO do cadastro — o que e preocupacao da tela, nao da
 * politica de autenticacao.
 *
 * A confirmacao de senha mora aqui, e nao em `authenticate.ts`, de proposito:
 * ela existe para evitar ERRO DE DIGITACAO, nao para decidir acesso. A politica
 * de auth (forca minima, e-mail unico, rate limit, ordem hash-antes-da-consulta)
 * continua intocada no seu modulo.
 *
 * A senha aqui e do NOSSO produto. Credencial de Gov.br/SINARM continua proibida
 * de ser recebida ou guardada (docs/00 §8).
 *
 * Modulo PURO: sem Prisma, sem I/O, sem rede, sem React.
 */

export type PasswordConfirmationResult = { ok: true } | { ok: false; message: string };

/**
 * Mensagem unica de divergencia. Nao diz qual campo esta "certo" — nao existe
 * campo certo: o usuario digitou duas coisas diferentes e precisa reconferir.
 */
export const PASSWORD_MISMATCH_MESSAGE =
  "As senhas não são iguais. Digite a mesma senha nos dois campos.";

/**
 * Confere se senha e confirmacao batem.
 *
 * Comparacao EXATA, sem `trim`: `password.ts` tambem nao apara a senha antes do
 * hash, entao aparar aqui aceitaria um par que depois viraria hash de outra
 * coisa. Espaco no inicio/fim e parte da senha.
 *
 * Nao valida tamanho nem forca — isso e da politica de auth, que roda depois e
 * continua sendo a autoridade. Aqui so se evita o erro de digitacao.
 */
export function checkPasswordConfirmation(
  password: string,
  confirmation: string,
): PasswordConfirmationResult {
  if (typeof password !== "string" || typeof confirmation !== "string") {
    return { ok: false, message: PASSWORD_MISMATCH_MESSAGE };
  }
  if (password !== confirmation) {
    return { ok: false, message: PASSWORD_MISMATCH_MESSAGE };
  }
  return { ok: true };
}
