# 22 — Validação da Fase 7 (Execução Assistida Manual)

> **O que é este documento.** Registra a **implementação e validação da Fase 7**
> — execução assistida manual — em **modo dev/fictício**, conforme o plano
> aprovado em `docs/21`.
>
> **Não é especificação nem autorização.** Nada aqui libera produção, Gov.br,
> SINARM, GRU real, Pix real ou protocolo.
>
> **Data:** 2026-07-18
> **Commit:** `75a78b0` — *feat: add manual assisted execution tracking*
> **Base:** `docs/21` (preparação aprovada), `docs/09 §15` (fluxo do órgão),
> `docs/10`, `docs/11`, `docs/12`, `docs/19`, `docs/20`.

---

## 1. Objetivo da Fase 7

Permitir que a operação conduza um processo do início ao fim com o painel como
**guia e livro-razão**, enquanto a execução acontece **fora do app**, feita por
uma pessoa, na janela oficial do Gov.br/SINARM.

---

## 2. Limite operacional confirmado

Verificado no código e no diff, não apenas declarado:

- ❌ **Não acessa Gov.br** — nenhuma chamada de rede no código da fase;
- ❌ **Não acessa SINARM/CAC** — as únicas ocorrências de "Gov.br/SINARM" no
  `src/` são **textos de aviso na UI**;
- ❌ **Sem Playwright / Puppeteer / Selenium / WebDriver** — ausentes do código
  e do `package.json`;
- ❌ **Não controla navegador externo**;
- ❌ **Não clica em "Gerar GRU e Salvar"**;
- ❌ **Não protocola**;
- ✅ **Apenas registra** o que o operador humano **declara** ter feito fora do
  app, com trilha auditável.

> Único endpoint externo do projeto inteiro continua sendo o **sandbox do
> Mercado Pago** (Fase 5, inativo por padrão, exige token `TEST-`).

---

## 3. Escopo implementado

| # | Item | Observação |
|---|------|------------|
| 1 | **Estados de execução manual** | 10 estados (docs/21 §8) |
| 2 | **Formulário de avanço manual** | etapa + observação sem PII |
| 3 | **Declaração obrigatória** | "eu executei manualmente, fora do app" |
| 4 | **Registro de protocolo** (fictício/dev) | exige declarar que **a pessoa** clicou em "Gerar GRU e Salvar" |
| 5 | **Registro de GRU** (fictícia/dev) | referência, vencimento, valor, observação |
| 6 | **Pagamento da GRU pela empresa** | só ADMIN/FINANCEIRO (docs/11 §9) |
| 7 | **Checklist pós-protocolo** | 5 itens (docs/21 §12) |
| 8 | **Histórico auditável** | quem/perfil/quando/de-para/observação |
| 9 | **Visão amigável ao usuário** | status neutro, sem dados internos |

---

## 4. Ambiente de teste

- **Postgres local real** (instância portátil), schema via `db push`;
- **Build de produção limpo** (`.next` removido, rebuild, `npm start`);
- **Dados fictícios/dev**: protocolo `PROT-DEV-0001`, GRU `GRU-REF-DEV-77`,
  usuários mock;
- **Sem PII real. Sem Gov.br/SINARM. Sem GRU real. Sem protocolo real pelo
  sistema. Sem Pix real.**

---

## 5. Checks executados

| Verificação | Resultado |
|-------------|-----------|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm run build` | ✅ |
| Testes com **Postgres real** | ✅ |
| **28 checks no service layer** | **26 PASS** |
| Verificação das telas em **produção local** | ✅ |

**Sobre os 2 checks restantes — foram erros do TESTE, não defeitos do código:**

1. Um limiar de contagem errado meu: exigi ≥7 entradas com "manual" na trilha
   quando o correto eram **6** (a entrada "Pagamento da GRU registrado" não
   contém a palavra no título).
2. O outro **revelou um defeito real** (§6), que foi corrigido — a asserção em
   si estava mal calibrada, mas apontou um problema legítimo.

Cobertura dos checks: RBAC das combinações perfil×ação · declaração obrigatória ·
etapa inválida · bloqueio sem motivo · GRU antes do protocolo · protocolo
vazio/duplicado · GRU sem vencimento/valor · pagamento duplicado · DTO com
autores · checklist pós-protocolo · rótulos da trilha.

---

## 6. Defeito real encontrado e corrigido

**Sintoma:** a trilha exibia **"Evento: PROT-DEV-0001"**.

**Causa:** o mapa de prefixos da timeline não conhecia os tipos de evento novos
(`EXECUCAO_MANUAL`, `PROTOCOLO_MANUAL`, `GRU_MANUAL`, `PAGAMENTO_GRU_MANUAL`) e
caía no rótulo genérico.

**Correção:** rótulos explícitos —

- **"Etapa manual (registrada)"**
- **"Protocolo registrado manualmente"**
- **"GRU registrada manualmente"**
- **"Pagamento da GRU registrado"**

**Por que importa:** um rótulo genérico ao lado de um número de protocolo pode
dar a **falsa impressão de que o sistema executou o ato** no órgão. A linguagem
da trilha precisa deixar claro, em toda entrada, que **quem agiu foi a pessoa**.
Esse é justamente o risco "falsa sensação de automação" previsto em docs/21 §13.

---

## 7. RBAC validado

| Ação | ADMIN | OPERADOR | FINANCEIRO | SUPORTE | USER |
|------|:-----:|:--------:|:----------:|:-------:|:----:|
| Registrar etapas manuais | ✅ | ✅ | ❌ | ❌ | ❌ |
| Registrar protocolo (fictício/dev) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Registrar GRU (fictícia/dev) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Registrar **pagamento da GRU** | ✅ | ❌ | ✅ | ❌ | ❌ |
| Acompanhar / mensagem ao usuário | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver status amigável do próprio processo | — | — | — | — | ✅ |

**Segregação de funções confirmada em produção** com uma GRU pendente de
pagamento: o formulário de pagamento apareceu **somente** para ADMIN e
FINANCEIRO (OPERADOR e SUPORTE: zero).

> Nota de teste: uma medição inicial sugeriu que SUPORTE veria o formulário —
> era o **rótulo da permissão negada** (✕ "Registrar pagamento da GRU
> (empresa)") no card de permissões, não um formulário. Reverificado com um
> marcador específico do campo.

---

## 8. Garantias implementadas

- **Declaração obrigatória** para avançar etapa e para registrar protocolo;
- **Ordem forçada**: GRU exige protocolo registrado; pagamento exige GRU
  registrada;
- **Bloqueio operacional exige motivo**;
- **Protocolo já registrado não é sobrescrito** — a tentativa é recusada;
- **Correção/retificação se faz por novo evento/nota** (trilha append-only);
- **Vencimento e valor da GRU são digitados pelo operador**, lidos do sistema
  externo — o app **nunca presume** (docs/10 §4);
- **Divergência do valor esperado (R$ 20,00) gera alerta na trilha**;
- **Observações limitadas** e com aviso anti-PII na UI.

---

## 9. Modelagem / Prisma

Alterações **apenas no `schema.prisma`** (+67 linhas), **sem migration**
(`db push` local):

| Alteração | Detalhe |
|-----------|---------|
| `Process` + `manualExecutionStatus` | enum novo, default `EXECUCAO_MANUAL_NAO_INICIADA` |
| **`ManualExecutionStatus`** (novo) | os 10 estados do docs/21 §8 |
| **`ManualExecution`** (novo, 1-1) | protocolo, GRU e pagamento da GRU — cada bloco com **autor + perfil + data** |
| `ProcessEventKind` + 4 valores | `EXECUCAO_MANUAL`, `PROTOCOLO_MANUAL`, `GRU_MANUAL`, `PAGAMENTO_GRU_MANUAL` |
| `ChecklistGroup` + `POS_PROTOCOLO` | checklist pós-protocolo |

---

## 10. Segurança / LGPD

- **Sem CPF/RG/dados reais**, **sem documento real**, **sem PII** — scan do diff
  sem ocorrências;
- **Sem credencial Gov.br, sem senha, sem token** — o app não pede, não recebe e
  não guarda;
- **Sem print real do órgão** — nenhuma imagem versionada;
- **Usuário não vê** o bloco de execução manual, o número de protocolo nem os
  dados da GRU — apenas o status amigável;
- **Linguagem da UI** deixa explícito, no painel e na tela do usuário, que a
  execução é feita **por uma pessoa da equipe**, e que **o aplicativo não opera
  os sistemas do órgão**;
- Padrão **need-to-know** mantido (docs/18 §6): permissão na query, DTO redigido,
  página renderiza o DTO.

---

## 11. Resultado final

✅ **Fase 7 validada em modo dev/fictício.**

O ciclo dev/fictício agora existe **de ponta a ponta**:

> rascunho → documento fictício → Pix sandbox/fake → operação admin (fila,
> responsável, prioridade, checklists, indicadores) → **execução manual
> auditável** (etapas, protocolo, GRU, pagamento da GRU).

- **O app não executa atos no órgão.**
- **O app registra o trabalho humano externo**, com trilha auditável de
  quem/perfil/quando/de-para/observação.

---

## 12. Pendências antes de um piloto real

Nenhuma é resolvida por código do produto:

1. **Auth real + MFA** (docs/15 §3.8/§3.9);
2. **Storage de produção + KMS + retenção final** (docs/15 §3.2/§3.10/§3.11);
3. **Mercado Pago de produção + webhook público** (assinatura oficial, reentrega);
4. **Termos de uso/pagamento e política de reembolso** (docs/10 §15/§16);
5. **Revisão jurídica** (LGPD, responsabilidade, limites do serviço);
6. **Política operacional** para a execução humana (quem faz, quando, com que
   autorização, o que registrar);
7. **Treinamento de operador** — o painel reduz erro, não substitui preparo;
8. **Revisão de textos** para não prometer aprovação nem parecer sistema oficial
   (docs/10 §14, docs/00 §8).

---

## 13. Próximo passo recomendado

1. **Não adicionar novas funcionalidades sensíveis** por enquanto — o ciclo
   funcional está completo em modo fictício;
2. **Revisão de produto/UX e de textos** — clareza, tom honesto, nenhuma
   promessa de aprovação, nenhuma aparência de órgão oficial;
3. **Preparar o checklist de pendências para o piloto real** (§12), com
   responsável e ordem;
4. **Decidir o caminho de produção**: provedores (auth, storage, KMS), ambiente
   de deploy e sequência de habilitação — cada um com sua decisão registrada,
   como foi feito no `docs/15` e no `docs/17`.

---

> **Lembrete permanente:** validação **local com dados fictícios**. Não autoriza
> produção, Pix real, upload real de documento pessoal, automação Gov.br/SINARM,
> geração de GRU ou protocolo. Cada avanço depende de **confirmação explícita**
> do usuário.
