import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ClientStatusGuideSection } from "@/components/help/ClientStatusGuideSection";
import { HelpTopicsSection } from "@/components/help/HelpTopicsSection";
import { SupportChannelSection } from "@/components/help/SupportChannelSection";
import { TutorialVideosSection } from "@/components/help/TutorialVideosSection";

export const metadata: Metadata = {
  title: "Central de ajuda — Assistente CAC",
  description:
    "Como criar sua conta, enviar documentos, acompanhar seu pedido, entender os status e falar com o suporte.",
};

/**
 * Central de ajuda (/ajuda) — pagina publica.
 *
 * O conteudo nao consulta banco nem integra servico externo: e texto de PRODUTO
 * explicando o uso do NOSSO sistema. Nao consulta Gov.br/SINARM/PF e nao expoe
 * processo de ninguem.
 *
 * A rota e renderizada sob demanda (nao estatica) porque o layout raiz monta o
 * `Header`, que le cookie de sessao — comportamento global, nao desta pagina.
 */
export default function AjudaPage() {
  return (
    <Container>
      <section className="py-6 sm:py-10">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Central de ajuda
        </p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Como podemos ajudar?</h1>
        <p className="mt-4 max-w-2xl text-base text-neutral-600">
          Respostas curtas para as dúvidas mais comuns sobre a sua conta, o envio de documentos, o
          acompanhamento do pedido e o que cada status quer dizer.
        </p>

        <nav aria-label="Atalhos da ajuda" className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link
            href="#duvidas-frequentes"
            className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
          >
            Dúvidas frequentes
          </Link>
          <Link
            href="#videos"
            className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
          >
            Vídeos tutoriais
          </Link>
          <Link
            href="#guia-de-status"
            className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
          >
            Guia de status
          </Link>
          <Link
            href="#suporte"
            className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
          >
            Falar com suporte
          </Link>
        </nav>
      </section>

      <section className="pb-2">
        <Notice tone="warning" title="Antes de tudo, o mais importante">
          Este é um <strong>serviço privado de apoio</strong>. Não somos órgão público e{" "}
          <strong>não representamos Gov.br, Polícia Federal ou SINARM</strong>. A conta que você
          cria aqui é <strong>do nosso sistema</strong>, e{" "}
          <strong>nunca pedimos sua senha, código ou token do Gov.br</strong>. Quando uma etapa
          exigir login no órgão, <strong>você</strong> faz isso na janela oficial.
        </Notice>
      </section>

      <HelpTopicsSection />
      <TutorialVideosSection />
      <ClientStatusGuideSection />
      <SupportChannelSection />

      <section className="py-6 pb-10">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/como-funciona" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full px-5 py-3 text-base sm:w-auto">
              Ver como funciona
            </Button>
          </Link>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full px-5 py-3 text-base sm:w-auto">
              Ir para o meu painel
            </Button>
          </Link>
        </div>
      </section>
    </Container>
  );
}
