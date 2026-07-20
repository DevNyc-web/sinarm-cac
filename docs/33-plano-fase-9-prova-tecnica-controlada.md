# 33 — Plano da Fase 9: Prova Técnica Controlada

> **O que é este documento.** Planeja a **Fase 9 — Prova Técnica Controlada**: a
> primeira vez que a automação sairia do laboratório sintético para um ambiente
> real/autorizado, com **escopo mínimo, sem cliente real e sem escala**.
>
> **NÃO libera execução.** Este é o **plano**; a Fase 9 só começa após **aprovação
> explícita** deste documento (§19) e de um checklist de execução (§20). Enquanto
> isso: **não implementa automação real, não acessa Gov.br/SINARM, não usa dados
> reais.**
>
> **Data:** 2026-07-20
> **Commit base:** `914eff3` — *docs: record legal gate approval for automation*
> **Base:** `docs/32` (gate jurídico validado), `docs/26` (arquitetura/gates §19),
> `docs/30` (falha segura), `docs/29` (validação do laboratório), `docs/23`
> (pendências do piloto), `docs/25` (visão/segurança).

---

## 1. Objetivo da Fase 9

Realizar a **primeira prova técnica controlada** da automação em ambiente
real/autorizado — **um único processo**, em **conta própria/autorizada**, com
**escopo mínimo**, **sem cliente real inicial** e **sem escala**. O objetivo é
**aprender e provar segurança**, não operar comercialmente.

---

## 2. O que a Fase 9 deve provar

- Que a **arquitetura funciona fora do laboratório sintético** (num sistema real
  autorizado).
- Que a **sessão efêmera** funciona (criada, usada e **descartada**).
- Que a automação consegue **navegar/preencher com segurança**.
- Que a automação **sabe parar antes do ato irreversível** (§8).
- Que **logs/evidências são suficientes** para responder por cada passo.
- Que o fluxo consegue **falhar com segurança** (como no laboratório 8C).
- Que o **health check** reduz o risco de iniciar quando o serviço está instável.

---

## 3. Escopo mínimo permitido

- **Um único processo.**
- **Preferencialmente Guia de Tráfego** (fluxo já mapeado, checkpoint seguro).
- **Conta própria/autorizada** (do dono ou conta expressamente autorizada).
- **Dados próprios/autorizados** (nunca de terceiro).
- **Sem cliente real** no primeiro teste.
- **Sem escala**, **sem fila pública**, **sem marketing**.
- **Sem pagamento real do usuário** (o serviço não é cobrado nesta prova).
- **Sem produção aberta.**

---

## 4. Fora de escopo

A Fase 9 **não** inclui:

- ❌ Lançamento.
- ❌ Piloto amplo.
- ❌ Múltiplos clientes.
- ❌ Múltiplas regiões.
- ❌ Pagamento real de usuários.
- ❌ Automação de outros processos (CR, renovação, transferência…).
- ❌ Armazenamento definitivo de PII sem política final (storage/KMS/retenção).
- ❌ Servidor regional/por superintendência.
- ❌ IA decidindo atos sensíveis.

---

## 5. Pré-requisitos antes de executar a Fase 9

- [ ] **Confirmação jurídica registrada** (`docs/32`).
- [ ] **Ambiente técnico controlado** (máquina/servidor isolado e dedicado).
- [ ] **Consentimento próprio/autorizado** documentado.
- [ ] **Conta própria** ou conta **expressamente autorizada** por escrito.
- [ ] **Operador responsável presente** durante toda a execução.
- [ ] **Rollback definido** (§15).
- [ ] **Logs/auditoria ativos** (§10).
- [ ] **Storage temporário seguro** (efêmero, cifrado, descartável).
- [ ] **Sessão efêmera** garantida (§12).
- [ ] **Screenshots mascaradas** — ou **desativadas** quando houver dado sensível.
- [ ] **Checklist de dados** (o que será usado e conferido).
- [ ] **Critério de parada** claro (§14).
- [ ] **Plano de descarte** (§12).

> Sem **todos** os itens, a Fase 9 **não** começa.

---

## 6. Arquitetura da prova técnica

- **Backend/orquestrador:** comanda os passos, aplica os gates, decide "humano vs.
  seguir", persiste status/auditoria.
- **Playwright/browser real:** executa os passos determinísticos **na sessão
  autorizada** (headed, velocidade próxima do humano).
- **Sessão efêmera:** em memória, nunca persistida; descartada ao fim/erro/cancelamento.
- **Storage temporário:** cifrado, com expurgo; só o mínimo necessário.
- **Logs:** append-only, sem segredos (§10).
- **Evidências:** screenshots mascaradas / trace quando permitido, fora do git.
- **Painel/status:** etapa atual, tempo, falhas, motivo de parada (§17).
- **Pausa antes da GRU/protocolo:** ponto de parada obrigatório (§8).
- **Humano/operador:** acompanha em tempo real e confirma o ato sensível.

---

## 7. Fluxo planejado passo a passo

1. **Confirmar disponibilidade** do serviço externo (health check leve, §9).
2. **Preparar o ambiente** (máquina isolada, sessão limpa, logs ativos).
3. **Iniciar o processo controlado** (um só).
4. **Usuário/conta autorizada realiza login/autorização** (na janela oficial; o
   sistema nunca vê a senha).
5. **Automação navega** até o fluxo permitido.
6. **Automação preenche os dados mínimos.**
7. **Automação seleciona serviço/finalidade/PCE** conforme os dados autorizados.
8. **Automação anexa/valida documento** somente se permitido no escopo.
9. **Automação para antes da tela irreversível** (§8).
10. **Exibe o resumo** dos dados.
11. **Humano confirma ou cancela.**
12. **Se autorizado**, prossegue **conforme o escopo definido** (ver §8).
13. **Registra o resultado.**
14. **Descarta a sessão** (§12).
15. **Gera relatório interno.**

---

## 8. Ponto de parada obrigatório

- A automação **deve parar antes de gerar GRU/protocolo**, **salvo autorização
  explícita** (registrada) para ir além.
- **Para o primeiro teste**, avaliar **parar na tela "Dados da GRU"** — o checkpoint
  seguro mapeado (`docs/09 §15.11`) — **sem** clicar em "Gerar GRU e Salvar".
- **Nenhuma taxa** deve ser paga sem confirmação.
- **Nenhum protocolo** deve ser gerado sem **autorização registrada**.

> Decisão sugerida para o **primeiro** processo da Fase 9: **parar em "Dados da
> GRU"** e não protocolar — provar a navegação/preenchimento/parada antes de
> assumir qualquer ato irreversível. Ir além exige decisão explícita à parte.

---

## 9. Health check Gov/SINARM

- **Verificação leve** antes de iniciar (não sondar agressivamente).
- **Se instável → abortar antes** de qualquer pagamento/processo.
- **Registrar o motivo** do aborto.
- **Tentar novamente depois**, em janela melhor.

---

## 10. Logs e evidências

Registrar, sem segredos:

- **Horário de início/fim.**
- **Etapa atual.**
- **Autorização recebida** (o fato, não a credencial).
- **Dados confirmados** (pelo humano).
- **Erro** (tipo/mensagem dessensibilizada).
- **Retry** (tentativas e resultado).
- **Screenshot mascarada** (quando permitido).
- **Trace** (quando permitido; sem dado sensível).
- **Protocolo/GRU** se gerado (conforme §8).
- **Descarte de sessão** (confirmação).

---

## 11. Dados que podem ser usados

- **Somente dados próprios/autorizados.**
- **Sem cliente real** no teste inicial.
- **Sem dados de terceiro.**
- **Sem prints desnecessários.**
- **Sem credenciais armazenadas.**
- **Sem token/cookie persistido.**

---

## 12. Dados que devem ser descartados

Ao fim/erro/cancelamento, descartar:

- **Cookies.**
- **Tokens.**
- **Sessão.**
- **Cache do browser.**
- **Arquivos temporários.**
- **Screenshots sensíveis** não necessárias.
- **Traces sensíveis** não necessários.

> O descarte deve ser **verificável** (registrado no log, §10).

---

## 13. Critérios de sucesso

A Fase 9 só é bem-sucedida se **todos**:

- [ ] **Não houve acesso indevido.**
- [ ] **Não houve dado real indevido** (só o próprio/autorizado).
- [ ] **A sessão foi descartada.**
- [ ] **A automação parou no ponto definido** (§8).
- [ ] **Os logs foram suficientes.**
- [ ] **Não houve erro de dado.**
- [ ] **Não houve protocolo/GRU indevido.**
- [ ] **O relatório final foi gerado.**
- [ ] **O rollback funcionou** (se acionado).

---

## 14. Critérios de parada imediata

**Parar na hora** se ocorrer qualquer um:

- 🔴 **Captcha inesperado.**
- 🔴 **Login/autorização divergente.**
- 🔴 **Tela mudou** (layout diferente do mapeado).
- 🔴 **Serviço instável.**
- 🔴 **Dado não bate.**
- 🔴 **Arma/PCE ambígua.**
- 🔴 **Documento não reconhecido.**
- 🔴 **Erro inesperado.**
- 🔴 **Qualquer dúvida jurídica/técnica.**

---

## 15. Rollback / cancelamento

- **Como cancelar antes do irreversível:** interromper o fluxo em qualquer etapa
  anterior ao ato sensível, sem efeito no órgão.
- **Como descartar a sessão:** encerrar o browser, limpar cookies/tokens/cache
  (§12), registrar o descarte.
- **Como registrar a falha:** motivo, etapa, horário, decisão tomada.
- **Como evitar pagamento/protocolo indevido:** nada paga/protocola sem confirmação
  humana registrada (§8).
- **Como documentar a tentativa abortada:** relatório interno da tentativa (mesmo
  sem sucesso).

---

## 16. Segurança

- **MFA admin** ativo.
- **Acesso restrito** (need-to-know).
- **Máquina/servidor controlado** e dedicado.
- **Isolamento da execução** (por processo).
- **Logs sem segredo.**
- **Máscara de dados** em qualquer evidência.
- **Descarte de sessão** garantido.
- **Revisão humana** obrigatória.
- **Não versionar artifacts** (evidências fora do git).

> Consequência mantida (`docs/25 §8`): server-side detém sessão autenticada → alvo
> de alto valor; tratar a infra como ativo crítico.

---

## 17. Observabilidade mínima

- **Dashboard ou log simples** do processo.
- **Etapa atual.**
- **Tempo por etapa.**
- **Falha por etapa.**
- **Motivo de parada.**
- **Resultado final.**

---

## 18. Papel da IA

- **A IA NÃO controla o navegador** na Fase 9.
- **A IA NÃO decide ato sensível.**
- **A IA pode ajudar depois** a analisar logs/erros — **somente se não houver dado
  sensível** no material analisado.
- **Playwright é o executor principal** (determinístico).

---

## 19. O que precisa ser aprovado antes da implementação da Fase 9

- [ ] **Este plano.**
- [ ] **Escopo exato** (o processo específico e seus dados).
- [ ] **Conta usada** (própria/autorizada, com autorização documentada).
- [ ] **Ponto de parada** (§8 — sugestão: parar em "Dados da GRU").
- [ ] **Dados usados.**
- [ ] **Política de evidência** (o que capturar, o que mascarar, o que descartar).
- [ ] **Responsável** pela execução.
- [ ] **Rollback.**
- [ ] **Confirmação do jurídico se algo mudar** em relação ao `docs/32`.

---

## 20. Próximo passo após este documento

Depois de **aprovar o plano**:

1. Criar um **documento de execução/checklist** da Fase 9 (ex.: `docs/34`).
2. **Só então** implementar a **menor automação possível**.
3. **Primeiro** contra ambiente controlado/conta própria.
4. **Sem clientes reais.**

> Nada de código antes do plano aprovado **e** do checklist de execução.

---

## 21. Conclusão

- O **gate jurídico** (`docs/32`) destravou o **planejamento** — e é isto que este
  documento faz.
- A **Fase 9 ainda NÃO está autorizada para execução**.
- Este plano é **requisito** antes de qualquer código real.
- **Produção e piloto amplo continuam bloqueados** pelas pendências técnicas/
  operacionais (`docs/32 §7`, `docs/23 §5`).

---

> **Lembrete permanente:** este é o **plano** da Fase 9, não a autorização de
> execução. Não implementa automação, não toca Gov.br/SINARM, não usa dados reais.
> A execução depende de **aprovação explícita** (§19) + checklist (§20); produção/
> piloto dependem das pendências do `docs/23 §5`. Regras permanentes (`docs/00 §8`)
> e bloqueios de fase (`docs/15`) seguem íntegros.
