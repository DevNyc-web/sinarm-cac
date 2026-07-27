/**
 * Fio entre as Server Actions e a politica de auth.
 *
 * As Actions nao implementam regra: elas coletam o formulario, chamam daqui e
 * traduzem o resultado em mensagem. A politica vive em `authenticate.ts` (pura,
 * testavel sem banco) e o I/O nos repositorios. Este arquivo so liga os dois.
 *
 * Senha e sessao do PRODUTO. Credencial de Gov.br/SINARM continua proibida
 * (docs/00 §8).
 */
import {
  createClientUser,
  findUserByEmailWithSecrets,
  updatePasswordHash,
} from "@/server/repositories/userRepository";
import { type RegisterResult, login, register } from "./authenticate";
import { LOGIN_RATE_LIMIT, SIGNUP_RATE_LIMIT, createRateLimiter } from "./rateLimit";
import { type AuthUser } from "./types";

/**
 * Limitadores em MEMORIA e por instancia — ver os limites documentados em
 * `rateLimit.ts`. Nao servem para producao; rate limit distribuido e PR futuro.
 */
const loginLimiter = createRateLimiter(LOGIN_RATE_LIMIT);
const signupLimiter = createRateLimiter(SIGNUP_RATE_LIMIT);

/** Mensagem UNICA de falha de login. Distinguir os casos seria enumeracao. */
export const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";

/**
 * Mensagem UNICA de falha de cadastro que NAO seja de validacao.
 *
 * Cobre inclusive "e-mail ja cadastrado": dizer isso confirmaria a existencia da
 * conta para quem so chutou o endereco. Custo assumido: UX pior para quem
 * esqueceu que ja tinha conta. Mitigacao real vem com verificacao de e-mail,
 * que e PR futuro.
 */
export const GENERIC_SIGNUP_ERROR =
  "Não foi possível criar a conta com esses dados. Verifique e tente novamente.";

export type LoginOutcome = { ok: true; user: AuthUser } | { ok: false; message: string };

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginOutcome> {
  const result = await login(
    { email, password },
    {
      findUserByEmail: findUserByEmailWithSecrets,
      checkRateLimit: (key) => loginLimiter.consume(key),
      resetRateLimit: (key) => loginLimiter.reset(key),
    },
  );

  if (!result.ok) return { ok: false, message: GENERIC_LOGIN_ERROR };

  // Migracao transparente de custo/algoritmo — so depois da senha conferida.
  // Falhar aqui NAO pode derrubar um login valido.
  if (result.rehashedPassword) {
    try {
      await updatePasswordHash(result.user.id, result.rehashedPassword);
    } catch {
      // Segue com o hash antigo; tenta de novo no proximo login.
    }
  }

  return { ok: true, user: result.user };
}

export type SignupOutcome =
  | { ok: true; user: AuthUser }
  | { ok: false; message: string; issues?: string[] };

export async function registerClient(
  input: { name: string; email: string; password: string },
  rateLimitKey: string,
): Promise<SignupOutcome> {
  const result: RegisterResult = await register(input, {
    findUserByEmail: findUserByEmailWithSecrets,
    createUser: ({ name, email, passwordHash }) =>
      createClientUser({ name, email, passwordHash }),
    checkRateLimit: (key) => signupLimiter.consume(key),
    rateLimitKey,
  });

  if (result.ok) return { ok: true, user: result.user };

  // Erro de VALIDACAO pode ser especifico (o usuario precisa saber o que
  // corrigir); os demais colapsam na mensagem generica.
  if (result.reason === "INVALID_INPUT") {
    return { ok: false, message: "Confira os dados informados.", issues: result.issues };
  }
  return { ok: false, message: GENERIC_SIGNUP_ERROR };
}
