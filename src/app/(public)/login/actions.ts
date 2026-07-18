"use server";

/**
 * Server Actions da tela de login MOCK/DEV (Fase 2).
 * Nao ha senha, e-mail, token ou provedor real — apenas escolha de um perfil
 * ficticio para navegar o app. Sera substituido pelo provedor real (docs/15 §3.8).
 */
import { redirect } from "next/navigation";
import { signInAsMockUser, signOut } from "@/server/auth/session";

export async function signInMockAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const ok = await signInAsMockUser(userId);
  if (!ok) redirect("/login?motivo=invalido");

  redirect(userId === "mock-user" ? "/dashboard" : "/admin");
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
