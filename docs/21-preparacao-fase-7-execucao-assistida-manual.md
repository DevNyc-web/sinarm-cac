# 21 — Preparação da Fase 7 (Execução Assistida Manual)

> **O que é este documento.** Prepara a **Fase 7** — execução assistida manual —
> **antes de escrever código**: o que o painel vai orientar, o que o operador
> humano registra e como isso vira trilha auditável.
>
> **Ainda NÃO é código.** Nada aqui implementa, automatiza ou autoriza acesso a
> Gov.br/SINARM. É o plano de execução da F7.
>
> **Última atualização:** 2026-07-18
> **Base:** `docs/09 §15` (reconhecimento do fluxo), `docs/10` (MVP),
> `docs/11` (painel/RBAC/checklists), `docs/12` (modelo de dados),
> `docs/19` e `docs/20` (validações das Fases 6 e 6.5).

---

## 1. Objetivo da Fase 7

Permitir que a operação **conduza um processo real do início ao fim** com o
painel como **guia e livro-razão** — enquanto **a execução acontece fora do
app**, feita por uma pessoa, na janela oficial do Gov.br/SINARM.

O painel deve responder: **o que fazer agora**, **o que já foi feito**, **quem
fez** e **o que ficou registrado** — sem nunca executar a ação no órgão.

---

## 2. Limite absoluto da Fase 7

**O sistema NÃO:**

- ❌ automatiza qualquer etapa;
- ❌ usa **Playwright** ou qualquer navegador headless;
- ❌ acessa **Gov.br**;
- ❌ acessa **SINARM/CAC**;
- ❌ **protocola** nada;
- ❌ clica em **"Gerar GRU e Salvar"**;
- ❌ recebe, pede ou armazena **credencial/senha/token Gov.br**;
- ❌ mantém sessão do órgão.

**O operador humano executa fora do app**, na janela oficial, com o próprio
login do usuário quando aplicável (docs/10 §16: o app **nunca** vê a senha).

> Esta seção é **inegociável** e vale para toda a F7. Qualquer item futuro que
> conflite com ela exige nova decisão explícita do usuário.

---

## 3. Conceito operacional

```
  APP GUIA          →  mostra o roteiro, os dados conferidos e o que falta
  HUMANO EXECUTA    →  fora do app, na janela oficial do Gov.br/SINARM
  HUMANO REGISTRA   →  volta ao painel e marca o que fez / digita o resultado
  APP AUDITA        →  grava quem, qual perfil, quando, de/para, observação
```

O app é **assistente e testemunha** — nunca ator no sistema do órgão
(docs/11 §1: "o painel reduz erro humano e registra tudo — nunca empurra um
protocolo no escuro").

---

## 4. Pré-condições para iniciar a execução manual

A execução manual só é liberada quando a **prontidão operacional** (docs/20 §2)
estiver em **6/6**:

- [ ] **Documento** (fictício/dev) **aprovado**;
- [ ] **Pagamento** (fake/dev) **confirmado**;
- [ ] **Checklist de revisão concluído** (docs/11 §6);
- [ ] **Checklist GRU fictício concluído** (docs/11 §7);
- [ ] **Responsável atribuído**;
- [ ] **Prontidão 6/6** — sem sinalizadores nem bloqueios ativos.

> O painel deve **impedir** o início do registro de execução enquanto a
> prontidão não estiver completa, exibindo o que falta e o perfil sugerido
> (docs/20 §7).

---

## 5. Etapas registráveis (base: `docs/09 §15`)

Cada item é **marcado pelo operador depois de fazer a ação fora do app**. O
painel **não sabe** o que acontece no órgão — ele registra a **declaração** de
quem executou.

| # | Etapa registrável | Referência |
|---|-------------------|------------|
| 1 | Operador **abriu Gov.br/SINARM fora do app** | docs/09 §15.1 |
| 2 | Operador **confirmou os dados do solicitante** | §15.2 (etapa 1) |
| 3 | Operador **selecionou o serviço** "Emitir Guia de Tráfego Pessoa Física (CAC)" | §15.3 |
| 4 | Operador **selecionou atividade / finalidade / tipo de PCE** | §15.3 |
| 5 | Operador **conferiu o Endereço SIGMA** (origem) | §15.6 |
| 6 | Operador **preencheu o destino** (evento/clube) | §15.7 |
| 7 | Operador **selecionou a arma/PCE** do acervo | §15.8 |
| 8 | Operador **anexou o documento** de identificação | §15.4 |
| 9 | Operador **preencheu a justificativa** | §15.9 |
| 10 | Operador **chegou à tela "Dados da GRU"** | §15.10/§15.11 |
| 11 | Operador **conferiu os dados da GRU** (checkpoint) | §15.11 |
| 12 | Operador **clicou manualmente em "Gerar GRU e Salvar" FORA do app** | §15.11 |
| 13 | Operador **registrou o número de protocolo** | §15.11 |
| 14 | Operador **registrou os dados da GRU** | §15.11 |
| 15 | Operador **registrou/anexou o PDF da GRU** (fictício/dev) ou referência manual | §15.14 |

> **Etapa 12 é declaração de ato irreversível já ocorrido.** O painel deve pedir
> **confirmação explícita** antes de aceitar essa marcação (§14) e deixar claro
> na interface que **quem clicou foi a pessoa, no site do órgão**.

---

## 6. Campos que o operador pode registrar

| Campo | Observação |
|-------|------------|
| **Número de protocolo** | digitado por humano; validar formato quando conhecido |
| **Número de referência da GRU** | §15.11 |
| **Data de vencimento da GRU** | **lida do sistema**, nunca fixada pelo app (docs/10 §4) |
| **Valor da GRU** | esperado R$ 20,00 — conferir, não presumir |
| **Observações** | texto curto, **sem PII** (§7) |
| **Status manual** | um dos estados do §8 |
| **Evidência textual** | descrição do que foi observado (ex.: "GRU gerada, protocolo exibido na tela") |
| **Nome do operador mock** | vem da sessão mock, não digitado |
| **Data/hora** | do servidor, não digitada |

> Em modo dev/fictício, **todos os valores são fictícios**. Nenhum protocolo ou
> GRU real deve ser digitado enquanto a fase estiver em dev.

---

## 7. O que NÃO registrar nesta fase

- ❌ **Senha Gov.br** — jamais, em nenhuma hipótese, nem "temporariamente";
- ❌ **Token/sessão Gov.br**;
- ❌ **Print/imagem com CPF, RG ou qualquer PII real** (docs/11 §19);
- ❌ **Documento real** de pessoa real;
- ❌ **GRU real de produção**;
- ❌ **Qualquer dado sensível desnecessário** ao registro (minimização,
  docs/12 §14).

> O campo de observação é **texto livre** — a UI deve avisar explicitamente para
> não escrever PII, e a política de revisão deve tratar violação como incidente.

---

## 8. Estados manuais sugeridos

Trilha da execução manual (separada do `operationalStatus` da fila, ou como
extensão dele — decidir na implementação):

| Estado | Significado |
|--------|-------------|
| `EXECUCAO_MANUAL_NAO_INICIADA` | prontidão ok, ninguém começou |
| `GOVBR_ABERTO_PELO_OPERADOR` | operador declarou ter aberto o Gov.br |
| `SINARM_ABERTO_PELO_OPERADOR` | operador declarou ter aberto o SINARM/CAC |
| `FORMULARIO_PREENCHIDO_MANUALMENTE` | etapas 2–9 do §5 concluídas |
| `CHECKPOINT_DADOS_GRU_CONFERIDO` | tela "Dados da GRU" conferida (§15.11) |
| `PROTOCOLO_MANUAL_REGISTRADO` | protocolo digitado no painel após o ato |
| `GRU_MANUAL_REGISTRADA` | dados/PDF da GRU registrados |
| `AGUARDANDO_PAGAMENTO_GRU_EMPRESA` | GRU existe; financeiro precisa pagar (docs/11 §9) |
| `GRU_PAGA_MANUALMENTE_DEV` | pagamento da GRU registrado (fictício/dev) |
| `BLOQUEADO_OPERACIONALMENTE` | parou por exceção; exige motivo |

> Nenhum desses estados faz o sistema agir no órgão — todos descrevem o que **a
> pessoa** relatou ter feito.

---

## 9. Auditoria obrigatória

Cada registro grava (append-only, docs/11 §18, docs/12 §3.5):

- **quem** registrou (usuário mock);
- **qual perfil** (ADMIN/OPERADOR/FINANCEIRO/SUPORTE);
- **quando** (timestamp do servidor);
- **de qual estado → para qual estado**;
- **observação** (quando houver);
- **campos alterados** (protocolo, GRU, vencimento, valor…);
- **motivo**, obrigatório em caso de **bloqueio**.

> A trilha **nunca** é editada ou apagada. Correção se faz com **novo evento**
> que registra a retificação — inclusive para protocolo digitado errado (§13).

---

## 10. RBAC da Fase 7

| Ação | ADMIN | OPERADOR | FINANCEIRO | SUPORTE | USER |
|------|:-----:|:--------:|:----------:|:-------:|:----:|
| Iniciar/registrar execução manual | ✅ | ✅ | ❌ | ❌ | ❌ |
| Marcar etapas do §5 | ✅ | ✅ | ❌ | ❌ | ❌ |
| Registrar protocolo e dados da GRU | ✅ | ✅ | ❌ | ❌ | ❌ |
| Registrar **pagamento da GRU pela empresa** | ✅ | ❌ | ✅ | ❌ | ❌ |
| Bloquear/desbloquear operacionalmente | ✅ | ✅ (com motivo) | ❌ | ❌ | ❌ |
| Acompanhar status e mandar mensagem ao usuário | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver status amigável do próprio processo | — | — | — | — | ✅ |

**Segregação preservada** (docs/11 §3): quem **executa** o protocolo não é quem
**libera o pagamento** da GRU.

---

## 11. Status visível ao usuário

Tom honesto, sem prometer aprovação (docs/10 §14, docs/11 §11):

| Estado interno | Usuário vê |
|----------------|------------|
| pré-execução / revisão | **Em revisão** |
| pagamento (do cliente) confirmado | **Pagamento confirmado** |
| execução manual em andamento | **Em execução** |
| protocolo registrado | **Protocolo registrado** |
| aguardando pagamento da GRU | **Aguardando pagamento da GRU** |
| pós-protocolo / acompanhamento | **Em acompanhamento** |
| bloqueio operacional | **Bloqueado — precisa de ajuste** |

> O usuário **não** vê estados internos, SLA, sinalizadores nem observações da
> equipe (docs/20 §9).

---

## 12. Checklists da Fase 7

1. **Checklist pré-execução** — confirma as pré-condições do §4 e que o
   operador está na janela oficial, com o usuário autenticado por ele mesmo.
2. **Checklist "Dados da GRU"** — o do docs/11 §7 / docs/09 §15.11: serviço
   correto, valor 20,00, contribuinte, UG/Gestão 167086/00001, Fundo do
   Exército, código 11300-0, vencimento lido do sistema, instruções, origem,
   destino, arma/PCE, documento, justificativa, consentimento, **revisão humana**.
3. **Checklist pós-protocolo** — protocolo capturado, PDF da GRU
   obtido/registrado, status atualizado, usuário notificado (docs/09 §15.14).
4. **Checklist pagamento da GRU pela empresa** — GRU localizada, valor conferido,
   pagamento efetuado, comprovante registrado, data registrada (docs/11 §9).

> Nos **primeiros 50–100 processos**, os checklists 2 e 3 exigem **revisão
> humana adicional** (docs/10 §12).

---

## 13. Riscos

| Risco | Descrição |
|-------|-----------|
| **Erro humano** | etapa marcada sem ter sido feita, ou feita sem ser marcada |
| **Divergência de arma/PCE** | operador seleciona arma errada no acervo (docs/11 §15) |
| **Destino incorreto** | dados do evento/clube divergentes (docs/11 §16) |
| **Dado sensível em observação** | PII digitada em campo livre |
| **Protocolo errado** | número digitado incorretamente |
| **GRU vencida** | pagamento da empresa após o vencimento |
| **Instabilidade Gov/SINARM** | sessão cai (~60 min) ou o sistema oscila (docs/09 §5/§6) |
| **Falsa sensação de automação** | alguém supor que o app "fez" o protocolo |

---

## 14. Mitigações

- **Revisão dupla** nos primeiros processos (docs/10 §12) — quem executa ≠ quem confere.
- **Campos obrigatórios** por estado (não avançar sem protocolo/GRU quando exigido).
- **Confirmação explícita** antes de marcar "Gerar GRU e Salvar" como executado,
  com texto deixando claro que **a pessoa** clicou, no site do órgão.
- **Logs append-only**; correção só por **novo evento de retificação**.
- **Aviso anti-PII** nos campos livres e orientação de **mascaramento** quando
  algo precisar ser descrito.
- **Checklists obrigatórios** antes das transições sensíveis.
- **Sinalizadores/prontidão** (docs/20) barram início prematuro.
- **Rótulos honestos na UI**: "registrado por humano", "executado fora do app".

---

## 15. Critério para liberar a implementação da F7

- [ ] **Este documento aprovado** pelo usuário;
- [ ] **Escopo manual confirmado** — o app orienta e registra, não executa;
- [ ] **Sem automação** (sem Playwright, sem navegador headless, sem robô);
- [ ] **Sem dados reais** (sem PII, sem CPF/RG, sem documento real);
- [ ] **Sem GRU real de produção**;
- [ ] Implementação segue em **modo dev/fictício**, com Postgres local.

> Sem esses seis itens, a F7 **não começa**.

---

## 16. Próximo passo após este documento

Mediante **confirmação explícita**, implementar a **F7 em modo dev/fictício**:

1. **Estados de execução manual** (§8) e suas transições, com pré-condição de
   prontidão 6/6 (§4);
2. **Formulário de registro manual** (§5/§6) com campos obrigatórios e avisos
   anti-PII (§7);
3. **Trilha auditável** (§9) — append-only, com retificação por novo evento;
4. **Visão do usuário** (§11) — status amigável, sem dados internos;
5. **RBAC** (§10), com a segregação executor ≠ pagador;
6. Padrão obrigatório do projeto: **permissão na query + DTO redigido**
   (docs/18 §6) e **preferir derivar a persistir** quando possível (docs/20 §3).

---

> **Lembrete permanente:** este documento **não** autoriza implementar código,
> instalar dependências, acessar Gov.br/SINARM, automatizar ou protocolar. É
> preparação. A Fase 7 só começa após **confirmação explícita** do usuário — e,
> mesmo então, **o sistema nunca executa no órgão**.
