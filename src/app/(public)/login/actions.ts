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
import { getCurrentUser, signInAsMockUser, signOut, startRealSession } from "@/server/auth/session";
import { destinationFor, entryPathFor, originEntryPath } from "@/server/auth/entryPaths";
import { findMockUser } from "@/server/auth/mockUsers";

export async function signInMockAction(formData: FormData) {
  // Defesa em profundidade: a Action tambem recusa, nao so a pagina esconder.
  if (!isMockAuth()) redirect("/login?erro=modo");

  const userId = String(formData.get("userId") ?? "");
  const mockUser = findMockUser(userId);
  const ok = await signInAsMockUser(userId);
  if (!ok || !mockUser) redirect("/login?motivo=invalido");

  // Destino pela REGRA de perfil, nao pelo id: antes era `userId === "mock-user"`,
  // que quebra em silencio se um id mudar de nome.
  redirect(destinationFor(mockUser.role));
}

export async function signInWithPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // De qual porta veio, para devolver o erro na MESMA tela: falhar em `/equipe`
  // e cair na tela do cliente seria a separacao se desfazendo no primeiro erro.
  const origem = originEntryPath(formData.get("origem"));

  const result = await loginWithPassword(email, password);
  if (!result.ok) {
    // A mensagem e sempre a mesma, e o e-mail volta preenchido para nao punir
    // quem so errou a senha.
    redirect(
      `${origem}?erro=${encodeURIComponent(result.message)}&email=${encodeURIComponent(email)}`,
    );
  }

  await startRealSession(result.user.id);
  redirect(destinationFor(result.user.role));
}

export async function signOutAction() {
  // Le o perfil ANTES de encerrar: depois do `signOut` nao ha mais de onde tirar.
  const user = await getCurrentUser();
  const destino = user ? entryPathFor(user.role) : "/login";
  await signOut();
  redirect(destino);
}
