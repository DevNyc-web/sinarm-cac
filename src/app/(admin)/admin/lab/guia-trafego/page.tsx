import type { Metadata } from "next";
import { requireAdminRole } from "@/server/auth/guards";
import { LabGuiaTrafego } from "./LabGuiaTrafego";

/**
 * Fase 8A/8C — Laboratorio de Automacao Sintetica (docs/26 §10/§11, docs/27, docs/30).
 *
 * Rota INTERNA/DEV: uma pagina fake/sintetica que IMITA o fluxo de Guia de
 * Trafego apenas para servir de alvo a automacao (Fase 8B) e ensaiar cenarios
 * de excecao sinteticos (Fase 8C).
 *
 * LIMITES (inegociaveis nesta fase):
 * - NAO acessa Gov.br, NAO acessa SINARM, NAO acessa nenhum site publico real.
 * - NAO faz upload real, NAO gera pagamento real, NAO protocola nada.
 * - TODOS os dados sao ficticios (docs/27 §"dados ficticios").
 *
 * O `scenario` (query param, ex.: `?scenario=gru-failure`) escolhe o modo de
 * simulacao; a validacao/normalizacao fica no componente (default: normal).
 *
 * Acesso restrito a ADMIN/OPERADOR (docs/21 §10); usuario comum e demais perfis
 * caem no redirect do guard.
 */
export const metadata: Metadata = {
  title: "Laboratório sintético — Guia de Tráfego",
};

export default async function LabGuiaTrafegoPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  // Guard de rota: so ADMIN/OPERADOR. USER/FINANCEIRO/SUPORTE -> /login?motivo=perfil.
  await requireAdminRole(["ADMIN", "OPERADOR"]);

  const { scenario } = await searchParams;
  return <LabGuiaTrafego initialScenario={scenario} />;
}
