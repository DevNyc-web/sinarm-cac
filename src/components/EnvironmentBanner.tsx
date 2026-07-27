import { isMockAuthForDisplay } from "@/server/auth/config";

/**
 * Faixa de ambiente (docs/24 §11/§16).
 *
 * Concentra o aviso de "dados ficticios" num unico lugar, FORA do conteudo —
 * assim as telas do usuario ficam livres de jargao interno ("Fase 2", "mock",
 * "sandbox") e a faixa some sozinha quando houver auth real.
 */
export function EnvironmentBanner() {
  // Renderiza em toda pagina, inclusive no prerender do build: usa a leitura
  // leve de env, nao a validacao completa (ver `isMockAuthForDisplay`).
  if (!isMockAuthForDisplay()) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
      Ambiente de <strong>demonstração</strong>: dados fictícios. Não envie documentos ou dados
      pessoais reais, e não faça pagamentos.
    </div>
  );
}
