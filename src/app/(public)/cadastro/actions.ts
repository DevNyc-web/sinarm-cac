"use server";

/**
 * Server Actions do cadastro de CLIENTE.
 *
 * Cria SEMPRE `role: "USER"` — perfil interno nao nasce de cadastro publico. O
 * papel e literal na politica (`register`) e no repositorio (`createClientUser`),
 * entao um campo `role` no formulario nao tem efeito nenhum.
 *
 * PENDENCIA REGISTRADA: **nao ha verificacao de e-mail neste PR**. Qualquer
 * endereco cria conta, inclusive de terceiro. Antes de trafego real e preciso
 * exigir confirmacao — pre-condicao de producao, nao detalhe de UX.
 *
 * A senha aqui e do PRODUTO. Credencial de Gov.br/SINARM continua proibida
 * (docs/00 §8).
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { registerClient } from "@/server/auth/authService";
import { startRealSession } from "@/server/auth/session";

/**
 * Chave do rate limit. Sem proxy confiavel configurado, `x-forwarded-for` e
 * falsificavel — por isso ha tambem o balde global como rede.
 */
async function rateLimitKey(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip ? `signup:${ip}` : "signup:global";
}

export async function signUpAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await registerClient({ name, email, password }, await rateLimitKey());

  if (!result.ok) {
    const detalhe = result.issues?.length ? ` ${result.issues.join(" ")}` : "";
    redirect(
      `/cadastro?erro=${encodeURIComponent(result.message + detalhe)}` +
        `&nome=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`,
    );
  }

  await startRealSession(result.user.id);
  redirect("/dashboard");
}
