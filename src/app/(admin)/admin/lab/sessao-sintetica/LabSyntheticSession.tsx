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
import {
  applyLabRunAction,
  initialLabRunFlowState,
  labRunView,
  type LabRunAction,
} from "@/server/automation/synthetic/labSyntheticRunFlow";
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
];

/**
 * Cenarios de interrupcao.
 *
 * Nao existe botao de resolver, pular ou contornar captcha — e nao pode passar
 * a existir: o unico desfecho do bloqueio e humano.
 */
const DISRUPTION_ACTIONS: readonly { action: LabAction; label: string; testId: string }[] = [
  { action: { kind: "timeout" }, label: "Simular timeout", testId: "lab-action-timeout" },
  { action: { kind: "captcha" }, label: "Simular captcha", testId: "lab-action-captcha" },
  { action: { kind: "expire" }, label: "Expirar handle", testId: "lab-action-expire" },
  { action: { kind: "cancel" }, label: "Encerrar sessão (humano)", testId: "lab-action-cancel" },
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

  const [runFlow, setRunFlow] = useState(initialLabRunFlowState);
  const [runFailure, setRunFailure] = useState<(typeof SYNTHETIC_FAILURE_KINDS)[number]>("TIMEOUT");

  const runView = labRunView(runFlow);
  const dispatchRun = (action: LabRunAction) => setRunFlow((current) => applyLabRunAction(current, action));

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
              {view.humanFallbackNotice === null ? null : (
                <p
                  data-testid="lab-human-fallback"
                  className="rounded-md border border-orange-300 bg-orange-50 px-4 py-2 text-sm text-orange-900"
                >
                  {view.humanFallbackNotice}
                </p>
              )}
              {view.terminal ? (
                <p
                  data-testid="lab-terminal-notice"
                  className="rounded-md border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm text-neutral-800"
                >
                  Sessão encerrada. Ela não reabre e não se renova — continuar exige{" "}
                  <strong>iniciar uma nova sessão sintética</strong>.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Sessão nº (fictícia)" value={String(view.sessionNumber)} />
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

          <h3 className="mb-3 mt-6 text-sm font-semibold text-neutral-900">
            Interrupções sintéticas
          </h3>
          <div className="flex flex-wrap gap-3">
            {DISRUPTION_ACTIONS.map(({ action, label, testId }) => (
              <Button
                key={testId}
                variant="secondary"
                data-testid={testId}
                onClick={() => dispatch(action)}
              >
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
              data-testid="lab-action-new-session"
              onClick={() => dispatch({ kind: "new-session" })}
            >
              Iniciar nova sessão
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
            demonstra a violação tipada devolvida pelo lifecycle. “Iniciar nova sessão” preserva o
            histórico de eventos em memória; “Reiniciar laboratório” limpa tudo.
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
                  {event.reason === "" ? null : (
                    <div className="mt-1 text-xs text-neutral-700">motivo: {event.reason}</div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* ------------------------------------------------- execução sintética */}
        <Card>
          <h2 className="mb-1 text-base font-semibold text-neutral-900">Execução sintética</h2>
          <p className="mb-4 text-sm text-neutral-600">
            Coordenador puro sobre um plano fictício de 4 etapas — fila local, sem rede, sem
            persistência. Independente do fluxo de login/handoff acima.
          </p>

          <div className="mb-4 flex flex-wrap gap-3">
            <Button data-testid="lab-run-create" onClick={() => dispatchRun({ kind: "create-run" })}>
              Criar run sintético
            </Button>
            <Button
              variant="secondary"
              data-testid="lab-run-execute-next"
              onClick={() => dispatchRun({ kind: "execute-next" })}
            >
              Executar próxima etapa
            </Button>
            <Button
              variant="secondary"
              data-testid="lab-run-captcha"
              onClick={() => dispatchRun({ kind: "captcha" })}
            >
              Simular captcha
            </Button>
            <Button
              variant="secondary"
              data-testid="lab-run-cancel"
              onClick={() => dispatchRun({ kind: "cancel" })}
            >
              Cancelar run
            </Button>
            <Button data-testid="lab-run-new-run" onClick={() => dispatchRun({ kind: "new-run" })}>
              Iniciar novo run
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-700">Falha sintética na próxima etapa</span>
              <select
                data-testid="lab-run-failure-select"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
                value={runFailure}
                onChange={(event) =>
                  setRunFailure(event.target.value as (typeof SYNTHETIC_FAILURE_KINDS)[number])
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
              data-testid="lab-run-fail"
              onClick={() => dispatchRun({ kind: "fail", failure: runFailure })}
            >
              Simular falha na próxima etapa
            </Button>
          </div>

          {runView === null ? (
            <p data-testid="lab-run-empty" className="text-sm text-neutral-600">
              Nenhum run sintético. Use “Criar run sintético” para começar.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Run nº (fictício)" value={String(runView.runNumber)} />
                <Field label="Estado do run" value={runView.state} />
                <Field label="Plano" value={`${runView.planId} v${runView.planVersion}`} />
              </div>

              {runView.humanFallbackRequired ? (
                <p
                  data-testid="lab-run-fallback"
                  className="rounded-md border border-orange-300 bg-orange-50 px-4 py-2 text-sm text-orange-900"
                >
                  Bloqueio por captcha sintético: fallback humano necessário. Nenhuma etapa
                  posterior executa — o desfecho é cancelar, falhar ou deixar expirar.
                </p>
              ) : null}

              {runView.terminal ? (
                <p
                  data-testid="lab-run-terminal-notice"
                  className="rounded-md border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm text-neutral-800"
                >
                  Run encerrado ({runView.result?.outcome ?? runView.state}). Não reabre — continuar
                  exige <strong>iniciar um novo run</strong>.
                </p>
              ) : null}

              <div>
                <span className="text-xs text-neutral-500">Etapa atual</span>
                <p data-testid="lab-run-current-step" className="text-sm text-neutral-900">
                  {runView.currentStep === null
                    ? "nenhuma — fila vazia"
                    : `${runView.currentStep.stepId} (${runView.currentStep.type}) — ${runView.currentStep.description}`}
                </p>
              </div>

              <div>
                <span className="text-xs text-neutral-500">Fila pendente</span>
                <p data-testid="lab-run-pending" className="text-sm text-neutral-900">
                  {runView.pendingStepIds.length === 0
                    ? "vazia"
                    : runView.pendingStepIds.join(" · ")}
                </p>
              </div>

              <div>
                <span className="text-xs text-neutral-500">Etapas concluídas</span>
                <p data-testid="lab-run-completed" className="text-sm text-neutral-900">
                  {runView.completedStepIds.length === 0
                    ? "nenhuma"
                    : runView.completedStepIds.join(" · ")}
                </p>
              </div>

              <div>
                <span className="text-xs text-neutral-500">Evidências sintéticas</span>
                {runView.evidence.length === 0 ? (
                  <p data-testid="lab-run-evidence-empty" className="text-sm text-neutral-600">
                    Nenhuma evidência ainda.
                  </p>
                ) : (
                  <ol data-testid="lab-run-evidence" className="flex flex-col gap-2">
                    {runView.evidence.map((item) => (
                      <li
                        key={item.evidenceId}
                        className="rounded-md border border-neutral-200 px-4 py-2 text-sm text-neutral-800"
                      >
                        <div className="font-medium">
                          {item.type} · {item.stepId}
                        </div>
                        <div className="text-xs text-neutral-600">
                          {item.previousState} → {item.nextState} · {item.timestamp}
                        </div>
                        <div className="mt-1 text-xs text-neutral-700">{item.description}</div>
                        <div className="text-xs text-neutral-700">resultado: {item.outcome}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}

          {runFlow.violations.length === 0 ? (
            <p data-testid="lab-run-violations-empty" className="mt-4 text-sm text-neutral-600">
              Nenhuma violação.
            </p>
          ) : (
            <ul data-testid="lab-run-violations" className="mt-4 flex flex-col gap-2">
              {runFlow.violations.map((v, index) => (
                <li
                  key={`${v.code}-${index}`}
                  className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800"
                >
                  <strong>{v.code}</strong>
                  {v.field === null ? null : ` (${v.field})`} — {v.detail}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Container>
  );
}
