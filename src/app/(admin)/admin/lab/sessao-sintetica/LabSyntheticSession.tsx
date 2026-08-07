"use client";

/**
 * Fase 2 — tela do laboratorio de login e handoff sinteticos.
 *
 * Casca fina sobre `labSyntheticFlow.ts`: o componente so despacha acoes e
 * renderiza o resultado. NENHUMA regra de maquina de estados mora aqui — nao ha
 * lista de transicoes, nome de evento montado a mao nem decisao sobre o que e
 * permitido. Estado atual, descricao e acoes possiveis vem de `labSessionView`,
 * que le o contrato.
 *
 * Roda 100% no cliente com `useState`: sem fetch, sem Server Action, sem
 * endpoint, sem cookie, sem localStorage. Recarregar a pagina zera tudo.
 *
 * O `sessionHandle` nao chega ate aqui: `LabSessionView` nao o expoe.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import {
  LAB_SYNTHETIC_NOTICE,
  applyLabAction,
  initialLabFlowState,
  labSessionView,
  type LabAction,
} from "@/server/automation/synthetic/labSyntheticFlow";
import { SYNTHETIC_FAILURE_KINDS } from "@/server/automation/synthetic/sessionLifecycle";

/** Botoes do fluxo, na ordem da jornada. */
const FLOW_ACTIONS: readonly { action: LabAction; label: string; testId: string }[] = [
  { action: { kind: "login" }, label: "Simular login sintético", testId: "lab-action-login" },
  { action: { kind: "handoff" }, label: "Gerar handoff sintético", testId: "lab-action-handoff" },
  {
    action: { kind: "confirm-handoff" },
    label: "Confirmar recebimento do handoff",
    testId: "lab-action-confirm-handoff",
  },
  {
    action: { kind: "next-step" },
    label: "Registrar próxima etapa",
    testId: "lab-action-next-step",
  },
  { action: { kind: "complete" }, label: "Concluir jornada", testId: "lab-action-complete" },
  { action: { kind: "expire" }, label: "Expirar handle", testId: "lab-action-expire" },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-900">{value}</span>
    </div>
  );
}

export function LabSyntheticSession() {
  const [flow, setFlow] = useState(initialLabFlowState);
  const [failure, setFailure] = useState<(typeof SYNTHETIC_FAILURE_KINDS)[number]>("TIMEOUT");

  const view = labSessionView(flow);
  const dispatch = (action: LabAction) => setFlow((current) => applyLabAction(current, action));

  return (
    <Container>
      <div className="flex flex-col gap-6 py-8">
        <header className="flex flex-col gap-2">
          <Badge>Ambiente sintético</Badge>
          <h1 className="text-xl font-semibold text-neutral-900">
            Laboratório — login e handoff sintéticos
          </h1>
          <p
            data-testid="lab-synthetic-notice"
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
          >
            {LAB_SYNTHETIC_NOTICE}
          </p>
          <p className="text-sm text-neutral-600">
            Não é solicitado nenhum dado de acesso: sem CPF, sem senha, sem código de verificação e
            sem qualquer credencial. O login abaixo apenas emite um identificador fictício local.
          </p>
        </header>

        {/* ------------------------------------------------------ estado atual */}
        <Card>
          <h2 className="mb-4 text-base font-semibold text-neutral-900">
            Estado da sessão sintética
          </h2>
          {view === null ? (
            <p data-testid="lab-session-empty" className="text-sm text-neutral-600">
              Nenhuma sessão sintética. Use “Simular login sintético” para começar.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <p data-testid="lab-session-state" className="text-sm text-neutral-900">
                {view.description}
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Processo (fictício)" value={view.processId} />
                <Field label="Código sintético" value={view.processCode} />
                <Field label="Ambiente" value={view.environment} />
                <Field label="Emitido em" value={view.issuedAt} />
                <Field label="Expira em" value={view.expiresAt} />
                <Field label="Correlação" value={view.correlationId} />
              </div>
              <div>
                <span className="text-xs text-neutral-500">Ações permitidas neste estado</span>
                <p data-testid="lab-allowed-transitions" className="text-sm text-neutral-900">
                  {view.allowedTransitions.length === 0
                    ? "nenhuma — estado terminal"
                    : view.allowedTransitions.join(" · ")}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* ----------------------------------------------------------- acoes */}
        <Card>
          <h2 className="mb-4 text-base font-semibold text-neutral-900">Fluxo sintético</h2>
          <div className="flex flex-wrap gap-3">
            {FLOW_ACTIONS.map(({ action, label, testId }) => (
              <Button key={testId} data-testid={testId} onClick={() => dispatch(action)}>
                {label}
              </Button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-700">Falha sintética</span>
              <select
                data-testid="lab-failure-select"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                value={failure}
                onChange={(event) =>
                  setFailure(event.target.value as (typeof SYNTHETIC_FAILURE_KINDS)[number])
                }
              >
                {SYNTHETIC_FAILURE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              data-testid="lab-action-fail"
              onClick={() => dispatch({ kind: "fail", failure })}
            >
              Aplicar falha sintética
            </Button>
            <Button
              variant="secondary"
              data-testid="lab-action-reset"
              onClick={() => dispatch({ kind: "reset" })}
            >
              Reiniciar laboratório
            </Button>
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            Os botões ficam sempre ativos de propósito: pedir uma ação fora de ordem é o que
            demonstra a violação tipada devolvida pelo lifecycle.
          </p>
        </Card>

        {/* ------------------------------------------------------- violacoes */}
        <Card>
          <h2 className="mb-4 text-base font-semibold text-neutral-900">
            Violações da última ação
          </h2>
          {flow.violations.length === 0 ? (
            <p data-testid="lab-violations-empty" className="text-sm text-neutral-600">
              Nenhuma violação.
            </p>
          ) : (
            <ul data-testid="lab-violations" className="flex flex-col gap-2">
              {flow.violations.map((violation, index) => (
                <li
                  key={`${violation.code}-${index}`}
                  className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800"
                >
                  <strong>{violation.code}</strong>
                  {violation.field === null ? null : ` (${violation.field})`} — {violation.detail}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ---------------------------------------------------------- eventos */}
        <Card>
          <h2 className="mb-4 text-base font-semibold text-neutral-900">
            Eventos sintéticos emitidos
          </h2>
          {flow.events.length === 0 ? (
            <p data-testid="lab-events-empty" className="text-sm text-neutral-600">
              Nenhum evento ainda.
            </p>
          ) : (
            <ol data-testid="lab-events" className="flex flex-col gap-2">
              {flow.events.map((event, index) => (
                <li
                  key={`${event.event}-${index}`}
                  className="rounded-md border border-neutral-200 px-4 py-2 text-sm text-neutral-800"
                >
                  <div className="font-medium">{event.event}</div>
                  <div className="text-xs text-neutral-600">
                    {event.previousState ?? "—"} → {event.nextState} · {event.timestamp}
                    {event.step === null ? null : ` · etapa: ${event.step}`}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </Container>
  );
}
