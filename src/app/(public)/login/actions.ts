"use server";

/**
 * Server Actions do login.
 *
 * Em modo REAL: e-mail/senha, com sessao opaca. Em modo MOCK: escolha de perfil
 * ficticio, como antes.
 *
 * A Action nao decide nada de seguranca — coleta o formulario, chama o servico e
 * traduz o resultado. A politica esta em `authenticate.ts`.
 *
 * Este login NAO e o do Gov.br. A senha aqui e do nosso produto; credencial de
 * orgao oficial continua proibida (docs/00 §8).
 */
import { redirect } from "next/navigation";
import { isMockAuth } from "@/server/auth/config";
import { loginWithPassword } from "@/server/auth/authService";
import { signInAsMockUser, signOut, startRealSession } from "@/server/auth/session";
import { isInternalRole } from "@/server/auth/roles";
import { type AuthUser } from "@/server/auth/types";

/** Perfis internos vao para o painel; cliente vai para o dashboard. */
function destinationFor(user: AuthUser): string {
  return isInternalRole(user.role) ? "/admin" : "/dashboard";
}

export async function signInMockAction(formData: FormData) {
  // Defesa em profundidade: a Action tambem recusa, nao so a pagina esconder.
  if (!isMockAuth()) redirect("/login?erro=modo");

  const userId = String(formData.get("userId") ?? "");
  const ok = await signInAsMockUser(userId);
  if (!ok) redirect("/login?motivo=invalido");

  redirect(userId === "mock-user" ? "/dashboard" : "/admin");
}

export async function signInWithPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await loginWithPassword(email, password);
  if (!result.ok) {
    // A mensagem e sempre a mesma, e o e-mail volta preenchido para nao punir
    // quem so errou a senha.
    redirect(
      `/login?erro=${encodeURIComponent(result.message)}&email=${encodeURIComponent(email)}`,
    );
  }

  await startRealSession(result.user.id);
  redirect(destinationFor(result.user));
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
