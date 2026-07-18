# 23 — Checklist do Piloto Real Controlado

> **O que é este documento.** Prepara o **piloto real controlado** do MVP Guia
> de Tráfego: o que precisa estar pronto, quem responde por cada parte, como o
> piloto roda, quando pausar e quando considerá-lo bem-sucedido.
>
> **Não autoriza nada.** Enquanto os itens de §5 não estiverem resolvidos,
> **não há piloto com cliente real**. Nenhuma nova funcionalidade sensível deve
> ser implementada nesta etapa.
>
> **Última atualização:** 2026-07-18
> **Base:** `docs/00` (regras permanentes), `docs/09 §15` (fluxo do órgão),
> `docs/10` (MVP, reembolso §15, LGPD §16), `docs/11` (operação), `docs/15`
> (decisões), `docs/22 §12` (pendências).

---

## 1. Objetivo do piloto real

Executar **poucos processos reais, de ponta a ponta, com supervisão total**,
para validar na prática:

- se o fluxo assistido **funciona com gente de verdade** (usuário e operador);
- se a **operação manual** é sustentável (tempo, erro, retrabalho);
- se **preço, reembolso e comunicação** se sustentam;
- se a **trilha auditável** registra o suficiente para responder por cada ato.

**Não é objetivo do piloto:** escalar, automatizar, testar volume ou validar
marketing.

---

## 2. Escopo do piloto

- **Um único serviço:** Guia de Tráfego Pessoa Física (CAC).
- **Volume:** **3 a 10 processos**, um de cada vez no início.
- **Perfil:** CAC já ativo, com CR/arma registrada e conta Gov.br funcionando.
- **Execução:** **100% assistida e manual** — o app orienta e registra; a pessoa
  executa na janela oficial (docs/21 §2).
- **Revisão humana obrigatória** em todos os processos do piloto (docs/10 §12).
- **Fora do escopo:** outros processos (CR, renovação, transferência, PJ),
  automação, cartão, certidões.

---

## 3. O que está pronto no MVP dev/fictício

| Área | Estado |
|------|--------|
| Cadastro do processo (destino, arma/PCE, justificativa) | ✅ Fase 3 |
| Revisão do processo pelo usuário | ✅ Fase 3.5 |
| Upload de documento | ✅ Fase 4 — **storage local/dev**, arquivos fictícios |
| Pagamento Pix | ✅ Fase 5 — **sandbox/fake**, webhook idempotente |
| Fila admin, atribuição, prioridade, status, notas/mensagens | ✅ Fase 6 |
| Sinalizadores, SLA interno, prontidão, pendências, auditoria | ✅ Fase 6.5 |
| Execução assistida manual (etapas, protocolo, GRU, pagamento da GRU) | ✅ Fase 7 |
| RBAC + need-to-know (permissão na query, DTO redigido) | ✅ Fases 2/6.5 |
| Trilha auditável append-only | ✅ Fases 3.6/7 |

> Tudo validado com **Postgres real** e **dados fictícios** (docs/18, 19, 20, 22).

---

## 4. O que ainda NÃO está pronto para produção

- **Autenticação real** — hoje é **mock/dev**: qualquer um "entra" escolhendo um
  perfil. **Isto sozinho impede qualquer piloto real.**
- **MFA** para perfis internos.
- **Storage de produção** — hoje grava em pasta local, sem criptografia,
  sem URL assinada.
- **Criptografia/KMS** de PII.
- **Retenção/expurgo** definidos e implementados.
- **Pix real** — hoje `fake`/sandbox.
- **Webhook público** com assinatura oficial verificada.
- **Termos de uso, contrato e política de reembolso** publicados e aceitos.
- **Base jurídica/LGPD** revisada por advogado.
- **Política operacional** escrita e **operador treinado**.

---

## 5. Pendências bloqueadoras (nenhum piloto real antes disto)

| # | Pendência | Bloqueia | Responsável |
|---|-----------|----------|-------------|
| 1 | **Auth real** (usuário e admin) | tudo | Técnico |
| 2 | **MFA admin** | acesso interno | Técnico |
| 3 | **Storage de produção** (bucket privado) | upload de documento real | Técnico |
| 4 | **KMS/criptografia** de PII | guardar qualquer PII | Técnico |
| 5 | **Retenção final** definida | guardar documento | Jurídico + Produto |
| 6 | **Mercado Pago produção** (conta PJ validada) | cobrar de verdade | Financeiro |
| 7 | **Webhook público** com assinatura verificada | confirmar pagamento | Técnico |
| 8 | **Termos de uso** publicados e aceitos | cobrar e tratar dados | Jurídico |
| 9 | **Política de reembolso** publicada (docs/10 §15) | cobrar | Jurídico + Financeiro |
| 10 | **Revisão jurídica** (LGPD, responsabilidade, limites) | tudo | Jurídico |
| 11 | **Política operacional** escrita | execução manual | Produto + Operação |
| 12 | **Treinamento do operador** | execução manual | Produto + Operação |

> **Regra:** o piloto só começa com **todos os 12 fechados**. Não há "resolve
> durante o piloto".

---

## 6. Checklist técnico

- [ ] Auth real implementada e testada (login, logout, sessão, expiração).
- [ ] MFA obrigatório para ADMIN/OPERADOR/FINANCEIRO/SUPORTE.
- [ ] RBAC revisado contra `docs/11 §3` com auth real (não mock).
- [ ] Storage de produção: **bucket privado**, sem acesso público, URLs
      assinadas e curtas.
- [ ] Criptografia de PII em repouso + chave em KMS/secret manager.
- [ ] `DATABASE_URL` de produção com backup automático e restauração **testada**.
- [ ] Migrations reais (sai o `db push`) e schema congelado para o piloto.
- [ ] Webhook Pix público com **assinatura verificada** e **reentrega testada**.
- [ ] Idempotência do webhook revalidada em produção.
- [ ] Logs sem PII; nível de log revisado.
- [ ] Monitoramento básico: erro 5xx, falha de webhook, fila parada.
- [ ] `.env` de produção fora do repositório; segredos em cofre.
- [ ] Ambiente de staging separado do de produção.

---

## 7. Checklist jurídico / LGPD

- [ ] **Termos de uso** e **contrato de prestação de serviço** publicados.
- [ ] **Política de privacidade** com base legal, finalidade e prazo de retenção.
- [ ] **Consentimentos** coletados antes do Gov.br (docs/10 §16):
      tratamento de dados · ciência de que após autorizar o responsável é a PF ·
      ciência do reembolso.
- [ ] **Política de retenção** definida (proposta: conclusão + 30 dias,
      docs/15 §3.11) e implementada.
- [ ] Registro de **quem acessou** PII (need-to-know auditável).
- [ ] Canal para **titular exercer direitos** (acesso, correção, exclusão).
- [ ] Confirmação de que **nunca** se pede/armazena senha Gov.br.
- [ ] Revisão de advogado sobre: responsabilidade por erro no protocolo,
      limites do serviço, e o que prometer (nada de aprovação).

---

## 8. Checklist financeiro / Pix / reembolso

- [ ] Conta PJ ativa no **Mercado Pago produção**; credenciais em cofre.
- [ ] Preço definido e exibido **antes** do pagamento (com a GRU embutida).
- [ ] **Política de reembolso publicada** (docs/10 §15):
      100% antes do envio/execução · parcial conforme estágio ·
      **não reembolsável após protocolo/GRU gerada**.
- [ ] Fluxo de reembolso **testado** (mesmo que manual).
- [ ] Conferência: **Pix do cliente ≠ GRU da empresa** (docs/11 §8/§9).
- [ ] Saldo/provisão para pagar as GRUs do piloto.
- [ ] Emissão fiscal (nota) definida.
- [ ] Conciliação: quem confere, com que frequência, onde registra.

---

## 9. Checklist operacional

- [ ] **Política operacional escrita**: quem executa, quando, com que autorização.
- [ ] **Operador treinado** no fluxo do `docs/09 §15` e no painel.
- [ ] **Segregação de funções** ativa: quem executa ≠ quem libera pagamento.
- [ ] **Revisão dupla** obrigatória em 100% dos processos do piloto.
- [ ] Janela de atendimento definida (horário em que há gente disponível).
- [ ] Plano para **sessão Gov.br expirada** (~60 min) e **instabilidade**.
- [ ] Roteiro de exceções: documento inválido · arma divergente · destino
      incompleto (docs/11 §14–§16).
- [ ] Combinação clara: **nada é protocolado sem checklist completo**.

---

## 10. Checklist de UX / textos

- [ ] Nenhum texto promete **aprovação** ou prazo garantido.
- [ ] Nenhuma tela parece **órgão oficial**; marca neutra, sem brasão/identidade
      do Gov/PF/Exército.
- [ ] Está explícito que é **serviço privado de assistência**.
- [ ] Está explícito que **a execução é feita por uma pessoa da equipe**, não
      pelo sistema.
- [ ] Login Gov.br: deixa claro que acontece **na janela oficial** e que **nunca
      vemos a senha**.
- [ ] Preço, o que está incluso (GRU) e reembolso visíveis **antes** de pagar.
- [ ] Mensagens de status honestas (docs/10 §14, docs/11 §11).
- [ ] Texto de erro não expõe dado interno nem culpa o usuário.
- [ ] Revisão de português e consistência de termos.

---

## 11. Checklist de segurança

- [ ] MFA ativo para todos os perfis internos.
- [ ] Princípio do menor privilégio revisado por perfil.
- [ ] Senhas/segredos fora do repositório; rotação planejada.
- [ ] HTTPS obrigatório; cookies `httpOnly`, `secure`, `sameSite`.
- [ ] Rate limit em login e endpoints públicos (webhook).
- [ ] Backup testado (restauração real, não só o dump).
- [ ] Trilha auditável **append-only** confirmada em produção.
- [ ] Plano de resposta a incidente: quem avisa, em quanto tempo, o que se faz.
- [ ] Revisão: nenhum print/log com PII; `.gitignore` conferido.

---

## 12. Checklist de suporte ao usuário

- [ ] Canal de suporte definido (e quem responde).
- [ ] Tempo de resposta prometido — e realista.
- [ ] Roteiro para as dúvidas previsíveis: pré-requisitos, Gov.br, prazo,
      reembolso, documento reprovado.
- [ ] Instrução clara de **reenvio de documento**.
- [ ] Combinado de escalonamento: suporte → operador → admin.
- [ ] Registro de toda interação relevante na trilha do processo.
- [ ] Texto pronto para o caso ruim: **não conseguimos concluir e vamos
      reembolsar**.

---

## 13. Critérios para selecionar o primeiro cliente/processo

Aceitar apenas quem cumpre **todos**:

- [ ] **CAC ativo**, com **CR e arma registrada** (tem Endereço SIGMA e acervo).
- [ ] **Conta Gov.br funcionando**, com a pessoa disponível para autorizar.
- [ ] Precisa de **Guia de Tráfego para treino** — caso simples, sem
      particularidade.
- [ ] **Destino completo e conhecido** (nome do evento, UF, cidade, logradouro,
      número).
- [ ] **Uma arma só** (multi-arma segue pendente — docs/15 §7 #3).
- [ ] **Sem urgência**: prazo folgado, nada que dependa de data crítica.
- [ ] Pessoa **acessível** (responde rápido) e **ciente de que é um piloto**.
- [ ] Aceitou termos, privacidade e política de reembolso.
- [ ] Idealmente alguém conhecido/próximo, tolerante a falha.

---

## 14. Critérios para NÃO aceitar um processo no piloto

Recusar (com explicação honesta) se:

- ❌ Não tem CR/arma registrada, ou o acervo está inconsistente.
- ❌ Conta Gov.br com problema (sem foto válida, sem acesso, bloqueada).
- ❌ **Urgência** — viagem/evento próximo, prazo apertado.
- ❌ Mais de uma arma, ou arma com dúvida de identificação.
- ❌ Destino incerto, incompleto ou fora do padrão.
- ❌ Situação jurídica atípica (processo, restrição, pendência no órgão).
- ❌ Pessoa espera **garantia de aprovação** ou prazo fixo.
- ❌ Não aceita os termos ou não quer que seus dados sejam tratados.
- ❌ Qualquer item de §5 ainda aberto.

> Recusar é a decisão **barata**. Aceitar errado no piloto custa caro.

---

## 15. Fluxo do piloto real controlado

1. **Seleção** do candidato conforme §13; recusa conforme §14.
2. **Conversa prévia**: explicar que é piloto, o que pode dar errado, o
   reembolso e o prazo estimado.
3. **Aceite** de termos, privacidade e reembolso — registrado.
4. **Cadastro do processo** no app pelo usuário (dados reais, agora com auth
   real e criptografia ativas).
5. **Upload do documento** (real, em storage de produção cifrado).
6. **Pagamento Pix real**, com preço e reembolso já exibidos.
7. **Conferência do Financeiro**; processo entra na fila.
8. **Prontidão 6/6** verificada no painel (docs/20).
9. **Checklists** de revisão e do checkpoint "Dados da GRU" (docs/11 §6/§7),
   com **revisão dupla**.
10. **Execução manual** pelo operador, na janela oficial, com o usuário
    autorizando no Gov.br — **o app não executa nada** (docs/21).
11. **Registro** no painel de cada etapa, protocolo e dados da GRU.
12. **Pagamento da GRU** pela empresa (Financeiro) e registro do comprovante.
13. **Entrega ao usuário** + acompanhamento até a conclusão.
14. **Retrospectiva** do processo: o que travou, quanto tempo levou, o que
    corrigir antes do próximo.

> **Um processo por vez** até o terceiro concluído sem susto.

---

## 16. Responsáveis por etapa

| Etapa | Produto | Operador | Financeiro | Suporte | Jurídico | Técnico |
|-------|:-------:|:--------:|:----------:|:-------:|:--------:|:-------:|
| Seleção do piloto (§13/§14) | ✅ | | | ✅ | | |
| Termos, privacidade, reembolso | ✅ | | | | ✅ | |
| Ambiente/produção pronto (§6/§11) | | | | | | ✅ |
| Conferência do Pix do cliente | | | ✅ | | | |
| Checklists e revisão dupla | ✅ | ✅ | | | | |
| Execução manual no órgão | | ✅ | | | | |
| Registro de protocolo/GRU | | ✅ | | | | |
| Pagamento da GRU (empresa) | | | ✅ | | | |
| Comunicação com o usuário | | | | ✅ | | |
| Incidente/exceção | ✅ | ✅ | | ✅ | ✅ | ✅ |
| Retrospectiva | ✅ | ✅ | ✅ | ✅ | | ✅ |

---

## 17. Evidências que devem ser guardadas

- **Aceite** de termos, privacidade e reembolso (quem, quando, qual versão).
- **Registro do pagamento** do cliente (id da transação, valor, data).
- **Trilha do processo** completa (quem/perfil/quando/de-para).
- **Número de protocolo** e **dados da GRU**.
- **Comprovante do pagamento da GRU** pela empresa.
- **Checklists** marcados, com autoria e horário.
- **Mensagens** trocadas com o usuário.
- **Metadados do documento** (tipo, tamanho, sha256) — não o conteúdo além do
  prazo de retenção.
- **Retrospectiva** escrita de cada processo do piloto.

---

## 18. O que NÃO deve ser guardado

- ❌ **Senha ou token Gov.br** — jamais, por nenhum motivo.
- ❌ **Print da tela do órgão com PII** (nome, CPF, nº de série, endereço).
- ❌ **Cópia extra do documento** fora do storage cifrado.
- ❌ PII em **logs**, observações, notas internas ou mensagens.
- ❌ Documento **depois do prazo de retenção** (expurgar; manter só metadado +
  sha256).
- ❌ Dado que **não seja necessário** ao processo (minimização, docs/12 §14).
- ❌ Qualquer PII **no repositório** (código, fixture, screenshot, commit).

---

## 19. Plano de rollback / cancelamento

| Momento | Ação |
|---------|------|
| **Antes do pagamento** | cancelar sem custo; explicar o motivo. |
| **Pago, antes do envio/execução** | **reembolso de 100%** (docs/10 §15). |
| **Execução iniciada, antes do protocolo** | parar; reembolso **conforme estágio**, decidido com transparência. |
| **Após protocolo/GRU gerada** | **não reembolsável** — houve ato irreversível e custo; explicar com clareza e concluir o que for possível. |
| **Falha técnica nossa** | assumir; reembolsar independente do estágio, se o erro foi da operação. |
| **Instabilidade do órgão** | pausar, comunicar, retomar em janela melhor — sem cobrar de novo. |

Em qualquer cancelamento: **registrar motivo na trilha** e comunicar o usuário
por escrito.

---

## 20. Critério para encerrar o piloto com sucesso

- [ ] **3+ processos concluídos** de ponta a ponta, com Guia emitida.
- [ ] **Zero** incidente de segurança/LGPD.
- [ ] **Zero** protocolo errado ou arma/destino divergente.
- [ ] Todo processo com **trilha completa** e auditável.
- [ ] **Reembolsos** (se houve) executados conforme a política.
- [ ] Tempo médio e esforço do operador **medidos** e sustentáveis.
- [ ] Usuários **entenderam o serviço** — sem achar que somos órgão oficial ou
      que o sistema "faz sozinho".
- [ ] Retrospectivas escritas, com correções aplicadas ou agendadas.

---

## 21. Critério para pausar o piloto

Pausar **imediatamente** se ocorrer qualquer um:

- 🔴 **Incidente de segurança ou vazamento** de dado pessoal.
- 🔴 **Protocolo indevido** ou dado errado enviado ao órgão.
- 🔴 **Cobrança indevida** ou falha de conciliação.
- 🔴 **Dúvida jurídica** sobre legalidade/responsabilidade do serviço.
- 🔴 Erro que **se repete** (dois processos com o mesmo problema).
- 🔴 **Instabilidade prolongada** do Gov.br/SINARM.
- 🔴 Operador sem condição de manter a **revisão dupla**.
- 🔴 Qualquer sinal de que o usuário foi **induzido a erro** pela comunicação.

Ao pausar: comunicar os usuários em andamento, decidir reembolso, registrar o
motivo e só retomar após correção documentada.

---

## 22. Próximos passos após o piloto

1. **Retrospectiva consolidada**: o que quebrou, o que custou tempo, o que o
   usuário não entendeu.
2. **Corrigir o mais difícil primeiro** — provavelmente seleção de arma/PCE e
   comunicação de status.
3. Decidir sobre **escala**: mais processos por semana, mais operadores, ou
   pausa para ajustar.
4. Reavaliar **preço** com o custo real medido (tempo de operador + GRU + taxas).
5. Só então considerar **semiautomação** por módulos (docs/10 §20) — sempre
   validando o mais arriscado primeiro, e **nunca** o clique final sem humano.
6. Registrar tudo em um `docs/24-retrospectiva-piloto.md`.

---

> **Lembrete permanente:** este checklist **não** autoriza iniciar o piloto.
> Enquanto as pendências do §5 não estiverem fechadas, **não há cliente real,
> não há cobrança real e não há protocolo real**. Cada avanço depende de
> **confirmação explícita** do usuário.
