# 11 — Painel Admin e Operação Interna (MVP Guia de Tráfego)

> **O que é este documento.** Especifica o **painel administrativo** e a
> **operação interna** que sustentam o MVP da Guia de Tráfego descrito em
> `docs/10-mvp-guia-de-trafego.md`. É o "lado de dentro": como a equipe recebe,
> revisa, executa no SINARM/CAC, protocola, paga a GRU e acompanha os processos.
>
> **Ainda NÃO é código.** Nada aqui é implementado, automatizado ou prototipado.
> Só especificação.
>
> **Última atualização:** 2026-07-17
> **Base:** `docs/00-contexto-atual.md`, `docs/09-reconhecimento-sinarm-cac.md`,
> `docs/10-mvp-guia-de-trafego.md`, `docs/05-logs-auditoria-lgpd.md`.

---

## 1. Objetivo do painel admin

Dar à equipe interna as ferramentas para **operar o MVP com segurança e revisão
humana**, cobrindo:

- **Receber** processos pagos e consentidos (fila).
- **Revisar** dados antes de qualquer ato irreversível.
- **Executar** o fluxo assistido no SINARM/CAC até **"Dados da GRU"**.
- **Validar** o checkpoint e clicar **"Gerar GRU e Salvar"** com revisão humana.
- **Capturar** protocolo + PDF da GRU e **pagar a GRU** (empresa, manual).
- **Comunicar** o usuário e **auditar** cada passo.

**Princípio-guia:** o MVP é **assistido**, não autônomo. O painel **reduz erro
humano** e **registra tudo** — nunca "empurra" um protocolo no escuro.

---

## 2. Perfis internos

| Perfil | Função principal |
|--------|------------------|
| **Admin** | Configura o sistema, gerencia usuários internos e permissões, vê tudo, resolve exceções. |
| **Operador** | Executa o fluxo no SINARM/CAC, preenche formulário, aplica checklists, captura protocolo/GRU. |
| **Financeiro** | Confere Pix do cliente, paga a GRU da empresa, registra comprovantes, trata reembolsos. |
| **Suporte** | Atende o usuário, esclarece pré-requisitos, acompanha status, encaminha exceções. |

> No MVP, uma mesma pessoa pode acumular perfis, **mas** as **permissões** e os
> **logs** devem distinguir a **ação por perfil** (quem fez o quê).

---

## 3. Permissões por perfil

| Ação | Admin | Operador | Financeiro | Suporte |
|------|:-----:|:--------:|:----------:|:-------:|
| Ver fila de processos | ✅ | ✅ | ✅ | ✅ |
| Ver detalhe do processo | ✅ | ✅ | ✅ | ✅ |
| Ver PII completa (CPF, docs) | ✅ | ✅ (no atendimento) | ✅ (no necessário) | ⚠️ mínimo necessário |
| Executar fluxo no SINARM/CAC | ✅ | ✅ | ❌ | ❌ |
| Aplicar/registrar checklist de revisão | ✅ | ✅ | ❌ | ❌ |
| Clicar **"Gerar GRU e Salvar"** | ✅ | ✅ (com revisão) | ❌ | ❌ |
| Confirmar **Pix do cliente** | ✅ | ❌ | ✅ | ❌ |
| Registrar **pagamento da GRU** (empresa) | ✅ | ❌ | ✅ | ❌ |
| Aprovar **reembolso** | ✅ | ❌ | ✅ | ❌ |
| Enviar **mensagens** ao usuário | ✅ | ✅ | ✅ | ✅ |
| Gerenciar **usuários internos/permissões** | ✅ | ❌ | ❌ | ❌ |
| Ver **logs/auditoria** | ✅ | ✅ (próprios) | ✅ (financeiros) | ✅ (próprios) |

> **Segregação de funções:** quem **executa** o protocolo idealmente **não é** o
> mesmo que **libera o pagamento** — importante para os primeiros processos.

---

## 4. Fila de processos

Lista central de trabalho. Cada item mostra (sem expor PII além do necessário):

- **ID do processo** e **serviço** (Guia de Tráfego).
- **Status interno** (§10) e **status visível ao usuário** (§11).
- **Estado do pagamento** (Pix do cliente) e da **GRU**.
- **Sinalizadores:** aguardando login Gov.br, sessão expirada, instabilidade,
  revisão humana pendente, exceção.
- **Tempo na fila / SLA** (prazo estimado 14 dias — doc 00).
- **Responsável atual** (operador/financeiro/suporte).

**Recursos:**
- **Filtros** por status, sinalizador, responsável, data.
- **Ordenação** por prioridade/tempo.
- **Atribuição** de responsável.
- Destaque para **exceções** e **revisão humana pendente** (primeiros 50–100).

---

## 5. Tela de detalhe do processo

Visão completa de um processo. Blocos:

1. **Resumo:** ID, serviço, status interno/visível, responsável, datas.
2. **Dados do usuário** (mínimo necessário; PII protegida — §19).
3. **Dados coletados no app** (destino/evento, arma/PCE indicada, justificativa).
4. **Documento** anexado (Documento de Identificação Pessoal) + validação.
5. **Pagamento Pix do cliente** (status, valor, comprovante).
6. **Dados da GRU** (contribuinte, UG/Gestão, código, valor 20,00, vencimento) —
   lidos do sistema, quando disponíveis.
7. **Checklists** (§6 e §7) com quem/quando marcou cada item.
8. **Protocolo + PDF da GRU** (quando gerados).
9. **Pagamento da GRU pela empresa** (status, comprovante).
10. **Linha do tempo / eventos** (auditoria — §18).
11. **Mensagens** trocadas com o usuário.
12. **Ações** disponíveis conforme perfil (§3).

---

## 6. Checklist de revisão antes do protocolo

Aplicado pelo **operador** durante o preenchimento no SINARM/CAC, **antes** de
chegar à ação final. Cada item é **marcado e registrado** (quem/quando):

- [ ] Pré-requisitos do usuário confirmados (Gov.br ativo; CR/arma; foto se exigida).
- [ ] **Pagamento Pix do cliente confirmado**.
- [ ] **Consentimentos/LGPD** registrados.
- [ ] Serviço correto: **Emitir Guia de Tráfego Pessoa Física (CAC)**.
- [ ] Atividade: **Tiro Desportivo - Atirador Desportivo**; Finalidade:
      **TREINAMENTO TIRO DESPORTIVO**; Tipo de PCE: **ARMA DE FOGO**.
- [ ] **Documento de Identificação Pessoal** anexado e legível.
- [ ] **Endereço SIGMA** (origem) correto.
- [ ] **Destino** (nome do evento, UF, cidade, logradouro, número) completo e coerente.
- [ ] **Arma/PCE** selecionada do acervo é a **certa** (validação forte — §15).
- [ ] **Justificativa** preenchida ("Guia para treino" ou editada).
- [ ] Nenhum sinal de **instabilidade/sessão expirada** pendente.

> Qualquer item **não** confirmado → **não avançar**; tratar a exceção.

---

## 7. Checklist antes de clicar "Gerar GRU e Salvar"

Aplicado na tela **"Dados da GRU"** — **último ponto seguro** (doc 09 §15.11;
doc 10 §13). **"Gerar GRU e Salvar" é irreversível.**

- [ ] Checklist §6 **totalmente** concluído.
- [ ] **Valor da GRU: 20,00**.
- [ ] **Contribuinte** e **CPF** corretos.
- [ ] **UG/Gestão** 167086/00001.
- [ ] **Unidade favorecida:** Fundo do Exército.
- [ ] **Código de Recolhimento:** 11300-0.
- [ ] **Vencimento** (lido do sistema) coerente.
- [ ] **Instruções** corretas ("Tx de Fisc Prod Contr EB" / "Guia de Tráfego (CAC)").
- [ ] **Revisão humana** feita (obrigatória nos primeiros 50–100 processos).
- [ ] **Confirmação explícita** do operador de que pode protocolar.

> Só depois de **todos** marcados o operador clica em **"Gerar GRU e Salvar"**.
> Nunca clicar em ambiente de teste/reconhecimento.

---

## 8. Fluxo de pagamento Pix do cliente

1. App gera cobrança **Pix** (por processo; preço provável **R$ 100** — doc 00).
2. **Se Gov/SINARM instável antes do pagamento → bloquear cobrança** e avisar.
3. Pagamento confirmado → **Financeiro/Admin** valida no painel; processo vai para
   **fila de operação**.
4. Comprovante e valor ficam registrados no detalhe (§5).
5. **Não confundir** com a GRU (§9): este Pix é **usuário → empresa**.

---

## 9. Fluxo de pagamento manual da GRU pela empresa

1. Após **"Gerar GRU e Salvar"**, a **GRU (R$ 20, Fundo do Exército, 11300-0)**
   passa a existir com **número de referência/protocolo**.
2. **Financeiro** baixa o **PDF da GRU** e efetua o **pagamento manual**.
3. Registra **comprovante** e **data** no processo.
4. Atualiza status (`GRU paga (empresa)` → rumo a `Concluído`).
5. O **preço ao cliente** (§8) já embute o custo da GRU + serviço.
6. Futuro: conciliação/pagamento automático (fora do MVP — §20).

---

## 10. Status internos do processo

Uso da **operação** (mais granular que o visível ao usuário — §11). Alinhado ao
doc 10 §11:

| Status interno | Significado operacional |
|----------------|-------------------------|
| `Rascunho` | Usuário ainda preenchendo no app. |
| `Aguardando pagamento` | Cobrança Pix emitida, sem confirmação. |
| `Pago / em fila` | Pix confirmado; aguardando operador. |
| `Aguardando login Gov.br` | Depende do login/autorização do usuário. |
| `Sessão Gov.br expirada` | Sessão SINARM caiu (~60 min); precisa re-login. |
| `Em preenchimento (SINARM)` | Operador executando o formulário. |
| `Em revisão humana` | Checkpoint "Dados da GRU" aguardando validação. |
| `Bloqueado / instabilidade` | Gov/SINARM instável; aguardando janela. |
| `Exceção — doc inválido` | Documento reprovado (§14). |
| `Exceção — arma divergente` | Arma/PCE não confere (§15). |
| `Exceção — destino incompleto` | Dados de destino insuficientes (§16). |
| `Protocolado / GRU gerada` | "Gerar GRU e Salvar" executado; protocolo + PDF. |
| `GRU paga (empresa)` | Financeiro quitou a GRU. |
| `Concluído` | Guia emitida e entregue. |
| `Cancelado / reembolsado` | Encerrado conforme reembolso (doc 10 §15). |

---

## 11. Status visíveis para o usuário

Versão **simplificada e amigável** (o usuário não vê a granularidade interna):

| Status ao usuário | Corresponde internamente a |
|-------------------|----------------------------|
| **Recebido** | Rascunho / Aguardando pagamento |
| **Pagamento confirmado** | Pago / em fila |
| **Aguardando seu login Gov.br** | Aguardando login Gov.br / Sessão expirada |
| **Em andamento** | Em preenchimento / Em revisão humana |
| **Aguardando o sistema da PF** | Bloqueado / instabilidade |
| **Precisamos de um ajuste** | Exceções (doc/arma/destino) |
| **Protocolado** | Protocolado / GRU gerada |
| **Concluído** | GRU paga / Concluído |
| **Cancelado** | Cancelado / reembolsado |

> Mensagens de apoio em doc 10 §14. Tom honesto, **não** oficial, sem prometer
> aprovação.

---

## 12. Tratamento de falhas Gov/SINARM

- **Antes do pagamento:** se instável → **bloquear cobrança** e avisar (doc 10 §9).
- **Depois do pagamento:** processo vai para `Bloqueado / instabilidade`, entra em
  **fila de retomada**, usuário vê **"Aguardando o sistema da PF"**.
- **Dupla autorização Gov.br** (comportamento instável conhecido — doc 09 §5):
  **não** tratar o primeiro retorno à tela como erro definitivo; **repetir**.
- **Captcha** (não observado, mas possível — doc 09 §9): **não burlar**; encaminhar
  para atendimento humano.
- Registrar cada ocorrência na auditoria (§18) com carimbo de tempo.

---

## 13. Tratamento de sessão expirada

- Sessão SINARM/CAC expira em **~60 min** (doc 09 §6).
- Ao detectar expiração → status `Sessão Gov.br expirada`; usuário vê
  **"Aguardando seu login Gov.br"**.
- Operação **solicita novo login** do usuário na **janela oficial** (o app nunca
  vê a senha).
- **Não** persistir credenciais para "reautenticar sozinho".
- Retomar o preenchimento **do ponto seguro** — **nunca** a partir de um estado
  ambíguo próximo ao protocolo.

---

## 14. Tratamento de documento inválido

- Validar o **Documento de Identificação Pessoal** (formato, legibilidade,
  correspondência com o solicitante) **antes** do login no SINARM.
- Reprovado → status `Exceção — doc inválido`; usuário vê **"Precisamos de um
  ajuste"** com instrução clara do que reenviar.
- **Não** anexar documento reprovado; **não** protocolar sem documento válido.
- Registrar motivo da reprovação (sem versionar a PII do documento — §19).

---

## 15. Tratamento de arma/PCE divergente

- A seleção de arma/PCE é **ponto de risco crítico** (doc 09 §15.8; doc 10 §18).
- Se a arma indicada pelo usuário **não** corresponde ao **acervo** exibido, ou
  há **ambiguidade** → status `Exceção — arma divergente`; **parar**.
- **Revisão humana obrigatória** para confirmar a arma correta antes de prosseguir.
- **Nunca** selecionar "a mais parecida" por conta própria — confirmar com o usuário.
- Registrar a decisão e quem confirmou (§18).

---

## 16. Tratamento de destino incompleto/incorreto

- Dados de destino: **Nome do Evento, UF, Cidade, Logradouro, Número** (doc 09 §15.7).
- Se incompletos/incoerentes → status `Exceção — destino incompleto`; usuário vê
  **"Precisamos de um ajuste"** e é solicitado a completar/corrigir.
- **Não** inventar/inferir endereço de destino.
- Revalidar antes de retomar o preenchimento no SINARM.

---

## 17. Suporte ao usuário

- Canal de **suporte humano** (doc 00) acessível a partir do processo.
- **Suporte** pode: esclarecer pré-requisitos, explicar status, orientar
  re-login/reenvio de documento, encaminhar exceções ao operador/financeiro.
- **Suporte não** executa o SINARM nem paga GRU (§3).
- Toda interação relevante vira **evento auditável** (§18) e pode virar **mensagem**
  ao usuário (§11, doc 10 §14).
- Casos **ambíguos/inconclusivos** → **revisão humana** (regra permanente doc 00 §8).

---

## 18. Logs e auditoria operacional

Base: `docs/05-logs-auditoria-lgpd.md`.

Registrar, com **quem / quando / qual perfil**:
- Confirmação de **Pix do cliente**.
- Abertura/uso de **sessão Gov.br/SINARM** (fato, não credenciais).
- Cada item de **checklist** (§6/§7) marcado.
- Clique em **"Gerar GRU e Salvar"** (ato irreversível) — destaque na auditoria.
- **Protocolo** e **PDF da GRU** capturados.
- **Pagamento da GRU** pela empresa.
- **Exceções** (doc inválido, arma divergente, destino, instabilidade, expiração).
- **Mensagens** ao usuário e **mudanças de status**.
- **Reembolsos**.

> A linha do tempo do processo (§5.10) é a **visão legível** desses logs.
> **Não** registrar senha Gov.br; **minimizar** PII nos logs.

---

## 19. Regras LGPD para operadores

Base: `docs/05-logs-auditoria-lgpd.md` e doc 10 §16.

- **Nunca armazenar/pedir a senha Gov.br.** Login sempre na **janela oficial**.
- **Acesso mínimo necessário** à PII (need-to-know por perfil — §3).
- **Após a autorização no Gov.br**, o responsável pelo tratamento é a **PF**;
  registrar apenas o **fato** da autorização.
- **Minimização:** guardar só o necessário para o processo.
- **Não commitar/print com PII** (CPF, nome, empresa, nº de série, endereço).
- Operadores agem sob **consentimento** já coletado do usuário (doc 10 §16).
- Ações sensíveis são **atribuíveis** (log por perfil/pessoa — §18).

---

## 20. O que fica FORA do painel no MVP

- **Automação ponta a ponta** do SINARM/CAC (o painel é **assistido**).
- **Pagamento automático/conciliação** da GRU (empresa paga manual — §9).
- **Pagamento por cartão** (só Pix no MVP).
- **Módulo de certidões (M1)** e telas correlatas (fora do MVP — doc 10 §17).
- **Outros processos** (CR novo, renovação, transferência, PJ).
- **Relatórios/BI avançados**, automações de mensagens em massa.
- **Gestão fiscal/contábil** além do registro de comprovantes.

---

## 21. Critérios para dizer que o painel está pronto

1. **Fila** (§4) mostra processos com status, sinalizadores e responsável.
2. **Detalhe** (§5) reúne dados, documento, GRU, checklists, protocolo e timeline.
3. **Perfis e permissões** (§2/§3) aplicados, com **segregação de funções**.
4. **Checklists** §6 e §7 são **obrigatórios** e **registrados** antes do protocolo.
5. Operação executa o fluxo SINARM (doc 09 §15) até **"Dados da GRU"** e clica
   **"Gerar GRU e Salvar"** **só** após checklist + revisão humana.
6. **Pix do cliente** (§8) e **GRU da empresa** (§9) têm registro e comprovante.
7. **Status interno ↔ visível** (§10/§11) sincronizados com mensagens ao usuário.
8. **Exceções** (§12–§16) têm status próprio e caminho de resolução.
9. **Logs/auditoria** (§18) cobrem todos os atos sensíveis, com atribuição.
10. **LGPD** (§19) respeitada; nenhuma regra permanente de segurança violada
    (doc 00 §8).
11. **Revisão humana** garantida nos **primeiros 50–100 processos**.

---

## 22. Próximos passos

1. **Modelar os dados** do painel/processo a partir de `docs/04-modelo-dados.md`
   (estados, checklists, eventos de auditoria).
2. **Mapear o pós-protocolo** (doc 09 §15.14) para completar o detalhe do processo
   (onde baixar GRU, "Listar Processo", "Acompanhamento da GRU", compensação).
3. Definir **wireframes** de fila e detalhe (ainda sem código).
4. Especificar **notificações** ao usuário (canais e gatilhos por status).
5. Evoluir de **assistido** para **semiautomático** por módulos (validar o mais
   difícil primeiro: preenchimento e seleção de armamento).
6. Planejar **conciliação/pagamento automático** da GRU e **cartão** (pós-MVP).

---

> **Lembrete permanente:** nada neste documento autoriza implementar código,
> instalar dependências, automatizar Gov.br/SINARM ou protocolar processo real.
> É especificação. Próximas ações dependem de **confirmação explícita** do usuário.
