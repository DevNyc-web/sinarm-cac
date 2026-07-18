# 20 — Validação da Fase 6.5 (Indicadores Operacionais)

> **O que é este documento.** Registra a **implementação e validação da Fase
> 6.5** — sinalizadores, SLA interno, prontidão operacional, pendências por
> responsável e auditoria consolidada — em **modo dev/fictício**.
>
> **Não é especificação nem autorização.** Nada aqui libera produção, Gov.br,
> SINARM, GRU real, Pix real ou protocolo.
>
> **Data:** 2026-07-18
> **Commit:** `79bc3b8` — *feat: add operational readiness indicators*
> **Base:** `docs/11` (painel/RBAC), `docs/12` (modelo), `docs/19` (Fase 6).

---

## 1. Objetivo da Fase 6.5

Completar o **detalhe operacional** do painel (docs/11 §4/§5) para que a equipe
responda, olhando uma tela: **o que falta**, **quem deve atuar**, **quão perto o
processo está** e **se ele está pronto para o protocolo manual** — sem que o
sistema protocole, automatize ou toque em Gov.br/SINARM.

---

## 2. Escopo implementado

| # | Item | Onde |
|---|------|------|
| 1 | **Sinalizadores de exceção** — documento pendente, destino incompleto, pagamento pendente, revisão pendente, pronto para checkpoint GRU, bloqueio manual | fila + detalhe |
| 2 | **SLA/prazos internos** — criação, tempo desde a criação, tempo desde o último evento, vencimento fictício, status (dentro do prazo/atenção/atrasado) | fila (resumo) + detalhe |
| 3 | **Auditoria consolidada** — última ação, autor, perfil, entradas na trilha, notas, checklist marcado, pagamento e documento atuais | detalhe |
| 4 | **Prontidão operacional** — 6 critérios → *Não pronto · Quase pronto · Pronto para protocolo manual* | fila + detalhe |
| 5 | **Pendências por responsável** — o que falta + perfil sugerido | detalhe |
| 6 | **Indicadores na fila** — colunas de prontidão, SLA e sinalizadores por linha | `/admin/processos` |
| 7 | **Indicadores no detalhe admin** — 5 blocos novos | `/admin/processos/[id]` |

**Critérios de prontidão (6):** documento aprovado · pagamento confirmado
(sandbox) · checklist de revisão concluído · checkpoint GRU concluído · sem
bloqueios ativos · responsável atribuído.

> **Prontidão NÃO protocola.** É um painel de conferência: o protocolo no SINARM
> continua **humano, manual e externo ao app** (docs/10 §17, docs/11 §20).

---

## 3. Decisão técnica importante

**Todos os indicadores são DERIVADOS em runtime. Nada foi persistido.**

- **Sem nova tabela, sem novo campo, sem migration, sem backfill.**
- **Motivo — evitar divergência de estado:** um sinalizador gravado em coluna ou
  JSON **envelhece**. Se o documento é aprovado e ninguém recalcula a flag, a
  tela mente. Derivado nunca diverge do estado real.
- **Menos complexidade:** não há recálculo a manter em cada transição, nem risco
  de esquecer um ponto de escrita.
- **`BLOQUEIO_MANUAL` reaproveita** o `operationalStatus = BLOQUEADO` que a
  equipe já controla desde a Fase 6 — nenhum estado novo para sincronizar.

**Fonte dos dados:** processo (status operacional, criação, responsável),
documentos, pagamentos, itens de checklist, eventos da trilha e notas.

**Implementação:** `src/server/processes/operationalSignals.ts` — **módulo
puro**, sem Prisma e sem I/O: recebe um retrato do processo e devolve
sinalizadores, prontidão, SLA e pendências. Isso o torna trivialmente testável e
reutilizável pela fila e pelo detalhe.

> **Quando reconsiderar:** se um dia for preciso **filtrar no banco** por
> sinalizador (ex.: "listar todos com pagamento pendente" via `WHERE`), aí vale
> materializar em coluna — com recálculo explícito nas transições.

---

## 4. Ambiente de teste

- **Postgres local real** (instância portátil), schema via `db push` — **sem
  migration**; nesta fase o schema **não mudou**.
- **Build de produção limpo** (`.next` removido, rebuild, `npm start`).
- **Dados 100% fictícios/dev**: usuários mock, clube de exemplo, arma de catálogo
  fictício, PDF fictício, Pix `fake`.
- **Sem PII real. Sem Gov.br. Sem SINARM/CAC. Sem GRU real. Sem protocolo real.
  Sem Pix real.**

---

## 5. Checks executados

| Verificação | Resultado |
|-------------|-----------|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run build` | ✅ |
| **18/18 checks na lógica derivada** (módulo puro) | ✅ |
| **Ciclo completo com Postgres real até PRONTO 6/6** | ✅ |
| Verificação das telas em **produção local** | ✅ |

Os 18 checks cobrem: processo novo, documento enviado, documento rejeitado +
bloqueio, sinalização do checkpoint GRU, prontidão total, SLA em três faixas,
destino incompleto e processo cancelado.

---

## 6. Fluxo validado (com banco real)

| Estágio | Resultado observado |
|---------|---------------------|
| Processo recém-criado | `NÃO PRONTO` 1/6 · 3 sinalizadores (documento, pagamento, revisão) |
| Documento enviado | pendência roteada para **OPERADOR** ("revisar e aprovar/rejeitar") |
| Pagamento confirmado (sandbox) | sinalizador `PAGAMENTO_PENDENTE` desaparece |
| Checklist de revisão completo | passa a sinalizar **`PRONTO_PARA_CHECKPOINT_GRU`** |
| Checkpoint GRU fictício completo + responsável atribuído | **`PRONTO PARA PROTOCOLO MANUAL` 6/6**, zero sinalizadores, zero pendências |
| Fila | reflete o mesmo estado na linha do processo |

---

## 7. Indicadores validados

- **Número/conteúdo dos sinalizadores** — corretos em cada estágio (3 → 2 → 1 → 0).
- **Pendências por responsável** — pagamento → **FINANCEIRO**; revisão e
  checkpoint → **OPERADOR**; envio/reenvio de documento e destino → **SUPORTE**;
  bloqueio e falta de responsável → **ADMIN** (respeitando docs/11 §2/§3).
- **Prontidão operacional** — 1/6 → 5/6 (*Quase pronto*) → 6/6 (*Pronto*).
- **SLA interno** — dentro do prazo · atenção · atrasado, com horas desde a
  criação e desde o último evento.
- **Última ação / autor / perfil** — preenchidos e coerentes com a trilha.
- **Entradas na trilha** — igual ao que o histórico exibe (20 vs 20).
- **Pagamento e documento atuais** — refletem o estado real (`PAGO`, `APROVADO`).

---

## 8. Ajustes de honestidade feitos

1. **`eventCount` corrigido e renomeado.** Contava apenas linhas de
   `process_status_events` (3) enquanto a trilha exibida logo abaixo tinha 20
   entradas — número menor que a própria tela, o que enganaria o operador.
   Passou a contar as **entradas da trilha consolidada** e o rótulo virou
   **"Entradas na trilha"**.
2. **Medições inválidas descartadas.** Dois "FAIL" iniciais eram **erro do
   teste, não do código**: escolhi um processo que nunca teve pagamento e
   assumi que estava pago; e esperei ≥5 eventos onde 3 era o correto. Os
   indicadores estavam certos ao apontar `PAGAMENTO_PENDENTE`.
3. **Testes refeitos** com um processo **levado até o fim** (upload → aprovação
   → pagamento → checklists → responsável), que é o cenário que valida a
   prontidão 6/6.
4. **Falso positivo registrado:** um grep por "Prontidao" na tela do usuário
   acusou vazamento — era o nome do clube fictício do teste ("Clube Prontidao"),
   não o bloco. Reverificado pelos títulos exatos dos blocos.

---

## 9. Segurança / LGPD

Padrão **need-to-know mantido** (docs/18 §6): permissão entra na query, service
monta DTO seguro, página renderiza o DTO.

- **`storageKey` não aparece em tela nem em listagem** — ausente de todas as
  páginas e services de leitura, em todos os perfis.
- **USER não recebe dados operacionais internos** — prontidão, SLA,
  sinalizadores, pendências e auditoria **não** existem na tela dele; ele vê
  apenas o status amigável e as mensagens marcadas como visíveis.
- **SUPORTE continua sem arma/PCE e sem metadados restritos** — vê os
  indicadores (nível de status, sem PII), mas os campos sensíveis seguem sem ser
  lidos do banco para o seu perfil.
- **Indicadores não expõem PII**: são status, contagens e rótulos.

---

## 10. Resultado final

✅ **Fase 6.5 validada em modo dev/fictício.**

O detalhe operacional agora responde, numa tela:

- **O que falta** → sinalizadores + critérios de prontidão não atendidos;
- **Quem atua** → pendências com perfil sugerido (segregação preservada);
- **Quão perto está** → prontidão *n*/6 e SLA interno;
- **Se está pronto para protocolo manual** → nível
  `PRONTO_PARA_PROTOCOLO_MANUAL` — que **sinaliza**, e **não protocola**.

---

## 11. Pendências antes de produção

Inalteradas (docs/19 §13), todas ainda **bloqueantes**:

1. **Auth real + MFA**.
2. **Storage de produção + KMS/criptografia + retenção final**.
3. **Conta Mercado Pago de produção + webhook público real** (assinatura oficial
   e teste de reentrega).
4. **Termos de uso/pagamento e política de reembolso**.
5. **Revisão jurídica** (LGPD, responsabilidade, comunicação ao usuário).
6. **Gov.br/SINARM**: apenas em **fluxo assistido futuro** — humano e manual,
   **nunca automatizado** no MVP.

---

## 12. Próximo passo recomendado

**Preparar a Fase 7 — execução assistida manual.**

- O painel deve **apenas registrar** o que o operador faz **fora do app**:
  roteiro do docs/09 §15, marcação de etapas cumpridas, captura manual de
  protocolo/GRU quando existirem, observações e evidências — **tudo digitado
  pela pessoa**.
- **Sem automação, sem Playwright, sem credenciais Gov.br, sem o sistema
  protocolar coisa alguma.**
- Aplicar desde o início: **permissão na query + DTO redigido** (docs/18 §6) e
  **preferir derivar a persistir** quando o dado puder ser calculado do estado
  (§3).

---

> **Lembrete permanente:** validação **local com dados fictícios**. Não autoriza
> produção, Pix real, upload real de documento pessoal, automação Gov.br/SINARM,
> geração de GRU ou protocolo. Cada avanço depende de **confirmação explícita**
> do usuário.
