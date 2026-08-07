import type { Metadata } from "next";
import { requireAdminRole } from "@/server/auth/guards";
import { LabSyntheticSession } from "./LabSyntheticSession";

/**
 * Fase 2 — Laboratorio de LOGIN e HANDOFF sinteticos (docs/72 §7.1/§7.2).
 *
 * Rota INTERNA/DEV, separada do laboratorio de Guia de Trafego
 * (`/admin/lab/guia-trafego`, Fase 8): aqui o alvo nao e o formulario, e sim o
 * ciclo de vida da SESSAO — login sintetico, handoff, primeira etapa, eventos e
 * violacoes tipadas.
 *
 * LIMITES (inegociaveis):
 * - NAO acessa Gov.br, SINARM, PF nem qualquer host externo.
 * - NAO pede CPF, senha, token, cookie ou qualquer dado Gov.br.
 * - NAO persiste nada: o estado vive no React e some no reload.
 * - NAO habilita execucao real; `PHASE9_REAL_EXECUTION_ENABLED` segue `false`.
 *
 * Acesso restrito a ADMIN/OPERADOR, como o laboratorio existente (docs/21 §10).
 */
export const metadata: Metadata = {
  title: "Laboratório sintético — sessão e handoff",
};

export default async function LabSessaoSinteticaPage() {
  await requireAdminRole(["ADMIN", "OPERADOR"]);

  return <LabSyntheticSession />;
}
