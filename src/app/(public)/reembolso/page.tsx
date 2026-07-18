import { LegalPage } from "@/components/LegalPage";
import { formatBRL, GRU_ESTIMATED_CENTS, SERVICE_FEE_CENTS, SERVICE_TOTAL_CENTS } from "@/server/processes/pricing";

export const metadata = { title: "Reembolso — Assistente CAC" };

export default function ReembolsoPage() {
  return (
    <LegalPage
      title="Política de reembolso"
      summary="Quando devolvemos o valor, quanto devolvemos e por quê."
    >
      <h2 className="text-base font-medium text-neutral-900">O que você paga</h2>
      <p>
        O valor do serviço é <strong>{formatBRL(SERVICE_TOTAL_CENTS)}</strong> (referência), assim
        dividido: <strong>{formatBRL(SERVICE_FEE_CENTS)}</strong> de assistência +{" "}
        <strong>{formatBRL(GRU_ESTIMATED_CENTS)}</strong> referentes à{" "}
        <strong>GRU — taxa do órgão competente</strong>, que recolhemos por você. O pagamento feito
        a nós <strong>não é</strong> a GRU e <strong>não é</strong> cobrança oficial do órgão.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Regras por estágio</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Antes de começarmos</strong> (nada enviado, execução não iniciada):{" "}
          <strong>reembolso integral</strong>.
        </li>
        <li>
          <strong>Execução iniciada, antes do protocolo</strong>: reembolso{" "}
          <strong>conforme o estágio</strong>, informado com transparência antes de qualquer
          decisão.
        </li>
        <li>
          <strong>Depois do protocolo / GRU gerada</strong>: <strong>não reembolsável</strong> —
          houve custo e um ato irreversível no órgão. Nesse ponto, seguimos até onde for possível
          para concluir.
        </li>
        <li>
          <strong>Se a falha for nossa</strong> (erro de operação ou do sistema):{" "}
          <strong>devolvemos o valor</strong> independentemente do estágio.
        </li>
        <li>
          <strong>Instabilidade do órgão</strong>: pausamos, avisamos e retomamos quando possível —{" "}
          <strong>sem cobrar de novo</strong>.
        </li>
      </ul>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Importante</h2>
      <p>
        Reembolso não tem relação com aprovação: <strong>não garantimos deferimento</strong>, e o
        indeferimento pelo órgão não caracteriza, por si só, falha do nosso serviço. O que
        garantimos é cuidado no preparo e transparência no acompanhamento.
      </p>

      <h2 className="pt-2 text-base font-medium text-neutral-900">Ambiente atual</h2>
      <p>
        Em <strong>desenvolvimento</strong>: os pagamentos são fictícios/sandbox. Nenhuma cobrança
        real existe nesta etapa.
      </p>
    </LegalPage>
  );
}
