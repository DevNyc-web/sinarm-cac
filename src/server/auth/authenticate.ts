/**
 * Politica de autenticacao do PRODUTO — login, cadastro, resolucao e revogacao
 * de sessao.
 *
 * ESCOPO: senha e sessao do NOSSO app. Credencial de Gov.br/SINARM continua
 * proibida de ser recebida ou guardada (docs/00 §8). Nenhuma funcao aqui trata
 * login em orgao oficial — aquilo e feito pelo usuario, na janela oficial.
 *
 * DESENHO: modulo PURO de politica. Todo I/O entra por `deps`, entao os caminhos
 * criticos de seguranca sao testaveis sem Postgres — o CI nao tem banco, e
 * autenticacao sem teste em CI seria o pior lugar para abrir excecao.
 *
 * Repositorios fazem I/O; este arquivo decide. Server Actions chamam daqui.
 */
import { z } from "zod";
import { type AuthUser } from "./types";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "./password";
import { isSessionExpired } from "./sessionToken";

/**
 * Linha do usuario COM os campos sensiveis. Existe so dentro desta camada: o que
 * sai para o app e `AuthUser`, que nao tem `passwordHash`.
 */
export interface StoredUser extends AuthUser {
  passwordHash: string | null;
  active: boolean;
}

/** Remove tudo que nao pode atravessar a fronteira do servico. */
export function toAuthUser(stored: StoredUser): AuthUser {
  return { id: stored.id, name: stored.name, email: stored.email, role: stored.role };
}

/**
 * Normaliza e-mail para escrita E leitura. Precisa ser a MESMA funcao nos dois
 * lados: o indice unico e case-sensitive, entao gravar `A@x.com` e procurar
 * `a@x.com` criaria conta inacessivel e permitiria duplicata disfarcada.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// --------------------------------------------------------------------- login

export type LoginFailure = "INVALID_CREDENTIALS" | "RATE_LIMITED";

export type LoginResult =
  | { ok: true; user: AuthUser; rehashedPassword: string | null }
  | { ok: false; reason: LoginFailure };

export interface LoginDeps {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  /** `allowed=false` interrompe antes de qualquer consulta pesada. */
  checkRateLimit?(key: string): { allowed: boolean };
  /** Zera o contador apos sucesso. */
  resetRateLimit?(key: string): void;
}

/**
 * Autentica por e-mail e senha.
 *
 * Regras que valem para TODAS as falhas: motivo unico `INVALID_CREDENTIALS` e a
 * mesma mensagem na UI. O chamador nao pode distinguir "e-mail nao existe" de
 * "senha errada" de "conta inativa" — isso e enumeracao de usuario.
 *
 * `verifyPassword` roda ate quando nao ha usuario, contra um alvo falso, para o
 * TEMPO de resposta tambem nao denunciar.
 */
export async function login(
  input: { email: string; password: string },
  deps: LoginDeps,
): Promise<LoginResult> {
  const email = normalizeEmail(input.email ?? "");
  const rateKey = `login:${email}`;

  if (deps.checkRateLimit && !deps.checkRateLimit(rateKey).allowed) {
    return { ok: false, reason: "RATE_LIMITED" };
  }

  const stored = await deps.findUserByEmail(email);

  // Conta inativa e conta sem senha caem no mesmo caminho de uma senha errada —
  // inclusive gastando o tempo do scrypt.
  const usableHash = stored && stored.active ? stored.passwordHash : null;
  const passwordMatches = await verifyPassword(input.password ?? "", usableHash);

  if (!stored || !stored.active || !passwordMatches) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  deps.resetRateLimit?.(rateKey);

  // Migracao transparente de custo/algoritmo: so quando a senha ja foi conferida.
  const rehashedPassword =
    stored.passwordHash && needsRehash(stored.passwordHash)
      ? await hashPassword(input.password)
      : null;

  return { ok: true, user: toAuthUser(stored), rehashedPassword };
}

// ------------------------------------------------------------------ cadastro

export type RegisterFailure = "INVALID_INPUT" | "EMAIL_TAKEN" | "RATE_LIMITED";

export type RegisterResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: RegisterFailure; issues?: string[] };

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  email: z.string().trim().email("E-mail invalido.").max(254, "E-mail muito longo."),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `A senha precisa de ao menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(PASSWORD_MAX_LENGTH, "Senha muito longa."),
});

export interface RegisterDeps {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: "USER";
  }): Promise<AuthUser>;
  checkRateLimit?(key: string): { allowed: boolean };
  /** Chave do limite — IP, quando disponivel. Cai para um balde global sem ele. */
  rateLimitKey?: string;
}

/**
 * Cadastro publico de CLIENTE.
 *
 * `role` e literal `"USER"` e NAO vem do formulario — perfil interno so por
 * processo administrativo. Um campo `role` no corpo do request nao tem efeito.
 *
 * SEM verificacao de e-mail neste PR: qualquer endereco cria conta. Isso e
 * pendencia registrada e pre-condicao de producao ampla.
 */
export async function register(
  input: { name: string; email: string; password: string },
  deps: RegisterDeps,
): Promise<RegisterResult> {
  const rateKey = deps.rateLimitKey ?? "signup:global";
  if (deps.checkRateLimit && !deps.checkRateLimit(rateKey).allowed) {
    return { ok: false, reason: "RATE_LIMITED" };
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "INVALID_INPUT",
      issues: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const email = normalizeEmail(parsed.data.email);
  if (await deps.findUserByEmail(email)) {
    // O chamador deve exibir mensagem GENERICA — dizer "ja cadastrado" confirma
    // a existencia da conta para quem so chutou o e-mail.
    return { ok: false, reason: "EMAIL_TAKEN" };
  }

  const user = await deps.createUser({
    name: parsed.data.name,
    email,
    passwordHash: await hashPassword(parsed.data.password),
    role: "USER",
  });

  return { ok: true, user };
}

// -------------------------------------------------------------------- sessao

export interface SessionRow {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}

export interface ResolveSessionDeps {
  findSessionByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  now?(): Date;
}

/**
 * Resolve a sessao a partir do `tokenHash` ja validado por HMAC.
 *
 * Nega e LIMPA a linha quando a sessao expirou; nega quando o usuario sumiu ou
 * foi desativado. `users.active = false` derruba o acesso na hora — e o motivo de
 * a sessao ser opaca no banco, e nao um cookie stateless.
 */
export async function resolveSession(
  tokenHash: string,
  deps: ResolveSessionDeps,
): Promise<AuthUser | null> {
  const now = deps.now?.() ?? new Date();
  const session = await deps.findSessionByTokenHash(tokenHash);
  if (!session) return null;

  if (isSessionExpired(session.expiresAt, now)) {
    await deps.deleteSessionByTokenHash(tokenHash);
    return null;
  }

  const stored = await deps.findUserById(session.userId);
  if (!stored || !stored.active) return null;

  return toAuthUser(stored);
}

export interface RevokeSessionDeps {
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
}

/**
 * Revoga a sessao. Idempotente de proposito: sair duas vezes, ou sair com cookie
 * ja invalido, nao pode falhar — o chamador limpa o cookie de qualquer forma.
 */
export async function revokeSession(
  tokenHash: string | null,
  deps: RevokeSessionDeps,
): Promise<void> {
  if (!tokenHash) return;
  await deps.deleteSessionByTokenHash(tokenHash);
}
