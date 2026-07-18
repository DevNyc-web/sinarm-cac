import { ComoFuncionaBlock, LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Termos de uso — Assistente CAC" };

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de uso"
      summary="O que contratamos, o que fazemos e o que está fora do nosso alcance."
    >
      <ComoFuncionaBlock />

      <h2 className="pt-2 text-base font-medium text-neutral-900">1. Objeto</h2>
      <p>
        Prestamos um <strong>serviço privado de assistência</strong> para preparar, conferir e
        acompanhar o processo de Guia de Tráfego junto ao órgão competente. Não emitimos a Guia:
        quem emite e decide é o órgão.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">2. Execução assistida</h2>
      <p>
        A execução no sistema oficial é feita <strong>manualmente por uma pessoa da nossa
        equipe</strong>. O aplicativo <strong>não automatiza</strong> nem opera o Gov.br/SINARM.
        Quando for necessário autenticar, <strong>você</strong> faz o login na janela oficial — a
        senha é digitada apenas lá e <strong>não passa por nós em nenhum momento</strong>.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">3. Sem garantia de resultado</h2>
      <p>
        <strong>Não garantimos aprovação, deferimento ou prazo do órgão.</strong> Nosso compromisso
        é com o cuidado no preparo, na conferência e no acompanhamento — não com o resultado da
        análise, que não está sob nosso controle.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">4. Suas responsabilidades</h2>
      <p>
        Fornecer informações corretas e completas, manter os pré-requisitos em dia (cadastro ativo,
        acervo regular, conta Gov.br funcionando) e responder quando precisarmos de uma ação sua.
        Dados incorretos podem inviabilizar o processo.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">5. Valores</h2>
      <p>
        O valor do serviço é informado <strong>antes do pagamento</strong> e já inclui a{" "}
        <strong>GRU — taxa do órgão competente</strong>, que recolhemos por você. O que você paga a
        nós <strong>não é</strong> uma cobrança oficial do órgão. Detalhes de devolução em{" "}
        <strong>Reembolso</strong>.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">6. Limites</h2>
      <p>
        Não realizamos consulta, alteração ou qualquer ato em sistemas oficiais sem que uma pessoa
        autorizada o faça manualmente. Não guardamos credenciais do Gov.br. Não prometemos
        interferir na análise do órgão.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">7. Ambiente atual</h2>
      <p>
        A plataforma está em <strong>desenvolvimento</strong>, com dados fictícios. Não há
        atendimento real, cobrança real nem protocolo real nesta etapa.
      </p>
    </LegalPage>
  );
}
