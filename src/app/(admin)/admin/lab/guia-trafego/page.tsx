import type { Metadata } from "next";
import { requireAdminRole } from "@/server/auth/guards";
import { LabGuiaTrafego } from "./LabGuiaTrafego";

/**
 * Fase 8A — Laboratorio de Automacao Sintetica (docs/26 §10/§11, docs/27).
 *
 * Rota INTERNA/DEV: uma pagina fake/sintetica que IMITA o fluxo de Guia de
 * Trafego apenas para servir de alvo a automacao futura (Fase 8B).
 *
 * LIMITES (inegociaveis nesta fase):
 * - NAO acessa Gov.br, NAO acessa SINARM, NAO acessa nenhum site publico real.
 * - NAO faz upload real, NAO gera pagamento real, NAO protocola nada.
 * - NAO ha Playwright/Puppeteer aqui — isto e so o AMBIENTE fake.
 * - TODOS os dados sao ficticios (docs/27 §"dados ficticios").
 *
 * Acesso restrito a ADMIN/OPERADOR (docs/21 §10); usuario comum e demais perfis
 * caem no redirect do guard.
 */
export const metadata: Metadata = {
  title: "Laboratório sintético — Guia de Tráfego",
};

export default async function LabGuiaTrafegoPage() {
  // Guard de rota: so ADMIN/OPERADOR. USER/FINANCEIRO/SUPORTE -> /login?motivo=perfil.
  await requireAdminRole(["ADMIN", "OPERADOR"]);

  return <LabGuiaTrafego />;
}
