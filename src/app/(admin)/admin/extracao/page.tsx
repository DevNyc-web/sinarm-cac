import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Notice } from "@/components/ui/Notice";
import { requirePermission } from "@/server/auth/guards";
import { ROLE_LABELS } from "@/server/auth/roles";
import {
  enqueueExtractionsAction,
  runExtractionBatchAction,
  runExtractionReapAction,
} from "./actions";

/**
 * Painel de operacao da extracao (PR #47D-3A).
 *
 * ACIONAMENTO MANUAL, e so isso: nao ha agendamento, intervalo nem gatilho
 * automatico. Esta pagina NAO importa o lote nem a varredura — quem os chama sao
 * as server actions, o unico ponto autorizado. Aqui so ha formulario e numeros.
 *
 * NENHUMA PII: nao lista documentos, nao mostra id de documento ou de tentativa,
 * nao exibe campos extraidos, nome de arquivo nem chave de storage. O que a tela
 * mostra sao CONTAGENS.
 */

/** Rotulos do que cada contagem significa — sem isso os numeros nao se explicam. */
const RESULTADO_LOTE = [
  ["scanned", "lidas da fila"],
  ["processed", "processadas"],
  ["skipped", "ignoradas (outra execucao venceu)"],
  ["failed", "sem veredito"],
] as const;

const RESULTADO_FILA = [
  ["candidates", "elegíveis"],
  ["requested", "criadas"],
  ["reused", "já existia"],
  ["failed", "falhas"],
] as const;

/**
 * Le um numero da query string.
 *
 * `Number()` + descarte de `NaN` de proposito: a URL e controlavel por quem
 * acessa, e a pagina EXIBE o que vem dela. Coagir para numero garante que nada
 * de texto arbitrario chegue ao render — a barreira nao depende so do escape do
 * React.
 */
function numeroDaQuery(valor: string | undefined): number | null {
  if (valor === undefined) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export default async function AdminExtracaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // A ROTA tambem e protegida, nao so a acao: sem isso, um perfil sem permissao
  // veria a tela e os botoes, e so descobriria a recusa ao clicar.
  const actor = await requirePermission("extraction.run");

  const params = await searchParams;
  const valor = (chave: string): string | undefined => {
    const bruto = params[chave];
    return Array.isArray(bruto) ? bruto[0] : bruto;
  };

  const acao = valor("acao");
  const houveErro = valor("erro") === "1";
  const duracao = numeroDaQuery(valor("ms"));
  const reaped = numeroDaQuery(valor("reaped"));

  return (
    <Container>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Operação de extração</h1>
        <Badge>mock/dev</Badge>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Acionamento manual. Perfil: {ROLE_LABELS[actor.role]}.
      </p>

      <Notice tone="warning" className="mt-4" title="O que esta tela faz — e o que não faz">
        A extração usa uma engine <strong>mock</strong>: não há leitura óptica real, não se lê o
        arquivo enviado e nada é consultado no Gov.br, no SINARM ou na Polícia Federal. Esta tela
        também <strong>não cria novas tentativas</strong> — ela apenas processa o que já está na
        fila e encerra o que ficou abandonado. Enquanto nada colocar documentos na fila, o
        resultado do lote será <strong>0</strong>, e isso é o esperado, não um defeito.
      </Notice>

      <Card className="mt-6">
        <h2 className="text-base font-medium">Criar tentativas pendentes</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Cria fila para até 10 documentos elegíveis: os que já foram{" "}
          <strong>enviados ou estão em análise</strong> e ainda não têm tentativa ativa. Os mais
          antigos entram primeiro.
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          <strong>Não processa automaticamente.</strong> Depois de criar, use “Processar fila de
          extrações”, abaixo. Criar a fila não faz leitura óptica real, não lê o arquivo enviado,
          não consulta Gov.br, SINARM ou Polícia Federal e não envia dados para fora — o
          processamento continua mock e manual.
        </p>
        <form action={enqueueExtractionsAction} className="mt-4">
          <Button type="submit">Criar tentativas pendentes</Button>
        </form>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-base font-medium">Processar fila de extrações</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Consome um lote pequeno de tentativas pendentes e executa cada uma. Acionar duas vezes
            seguidas é seguro: a segunda execução ignora o que a primeira já pegou.
          </p>
          <form action={runExtractionBatchAction} className="mt-4">
            <Button type="submit">Processar fila de extrações</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-base font-medium">Limpar extrações abandonadas</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Encerra tentativas que ficaram travadas em processamento por tempo demais, liberando o
            documento. Repetir a ação não muda nada — a limpeza é idempotente.
          </p>
          <form action={runExtractionReapAction} className="mt-4">
            <Button type="submit" variant="secondary">
              Limpar extrações abandonadas
            </Button>
          </form>
        </Card>
      </div>

      {acao ? (
        <Card className="mt-6">
          <h2 className="text-base font-medium">Último resultado</h2>

          {houveErro ? (
            <p className="mt-2 text-sm text-amber-800">
              A ação não pôde ser concluída. Nada foi alterado. Tente novamente; se persistir,
              verifique o banco de dados.
            </p>
          ) : acao === "lote" ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              {RESULTADO_LOTE.map(([chave, rotulo]) => {
                const n = numeroDaQuery(valor(chave));
                return (
                  <div key={chave}>
                    <dt className="text-neutral-500">{rotulo}</dt>
                    <dd className="text-lg font-medium text-neutral-900">{n ?? "—"}</dd>
                  </div>
                );
              })}
            </dl>
          ) : acao === "fila" ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              {RESULTADO_FILA.map(([chave, rotulo]) => {
                const n = numeroDaQuery(valor(chave));
                return (
                  <div key={chave}>
                    <dt className="text-neutral-500">{rotulo}</dt>
                    <dd className="text-lg font-medium text-neutral-900">{n ?? "—"}</dd>
                  </div>
                );
              })}
            </dl>
          ) : acao === "limpeza" ? (
            <dl className="mt-3 text-sm">
              <dt className="text-neutral-500">tentativas encerradas</dt>
              <dd className="text-lg font-medium text-neutral-900">{reaped ?? "—"}</dd>
            </dl>
          ) : (
            // Literal desconhecido na URL: nao exibimos o valor, so ignoramos.
            <p className="mt-2 text-sm text-neutral-500">Nenhum resultado a mostrar.</p>
          )}

          {duracao !== null && !houveErro ? (
            <p className="mt-3 text-xs text-neutral-500">Duração: {duracao} ms.</p>
          ) : null}
        </Card>
      ) : null}
    </Container>
  );
}
