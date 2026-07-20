# 32 — Decisão: Gate Jurídico da Automação (retorno positivo)

> **O que é este documento.** Registra que o **gate jurídico** da automação
> (preparado em `docs/31`) recebeu **retorno positivo**, conforme reportado pelo
> dono do projeto após consulta ao jurídico. É o registro da **decisão** e do que
> ela destrava e do que **não** destrava.
>
> **Não é parecer jurídico** e **não é opinião legal do assistente.** Registra a
> **decisão informada pelo dono** com base no retorno do jurídico dele. O texto
> jurídico final (termos, privacidade, consentimento, responsabilidade) ainda
> precisa ser redigido/validado pelo advogado antes de produção.
>
> **Mesmo com o retorno positivo, este passo NÃO implementa automação real.** É
> apenas documentação da decisão.
>
> **Data:** 2026-07-20
> **Commit base:** `7ec9faf` — *docs: add legal gate material for automation*
> **Base:** `docs/31` (material do gate), `docs/26` (arquitetura/gates §19),
> `docs/30` (exceções sintéticas), `docs/25` (visão), `docs/23` (piloto).

---

## 1. Objetivo

Registrar que o **gate jurídico da automação recebeu retorno positivo**: o modelo
pretendido do projeto foi considerado **validável/aprovado** pelo jurídico do dono,
nos termos descritos em §3. Isso **destrava o planejamento** da fase técnica
controlada (Fase 9) — e **nada além disso** (§5/§6).

---

## 2. Contexto da decisão

Quando o retorno chegou, o projeto já tinha:

- **Laboratório sintético** da Guia de Tráfego (`docs/27`, Fase 8A);
- **Automação Playwright em `localhost`** contra a página fake (`docs/28`, Fase 8B);
- **Caminho feliz** validado (`docs/29`);
- **Exceções sintéticas** com **falha segura** (`docs/30`, Fase 8C);
- **Material jurídico organizado** para a consulta (`docs/31`).

Ou seja: existia **prova técnica sintética** madura e um **pedido de análise**
estruturado. O retorno positivo responde a esse pedido.

---

## 3. Escopo validado pelo jurídico (conforme retorno)

Pontos reportados como **aprovados/validados**:

- **Execução server-side** conduzida pela infraestrutura da plataforma.
- **Login/autorização Gov.br feitos pelo usuário** (a plataforma não vê a senha).
- **Sessão efêmera**, usada **apenas durante a execução**.
- **Não armazenamento** de senha Gov.br, OTP, cookie, token ou credencial
  permanente.
- **Descarte da sessão** após conclusão, erro, cancelamento ou expiração.
- **Retenção apenas do necessário** ao processo, auditoria, suporte, comprovantes,
  protocolo/GRU e obrigações LGPD.
- **Execução mediante consentimento** do usuário.
- **Confirmação explícita antes de atos sensíveis/irreversíveis.**
- **Diferenciação** entre pagamento do serviço e GRU/taxa do órgão.
- **Sem necessidade de procuração/mandato** para o modelo validado.
- **Atuação como serviço privado**, sem promessa de aprovação e sem aparência de
  órgão oficial.
- **Captcha/validações técnicas não bloqueiam o modelo**, desde que tratadas dentro
  do escopo aprovado e **sem expor credenciais** do usuário.

> **Observação de fidelidade:** este documento registra o **retorno reportado**. A
> **redação final** dos termos, política de privacidade, consentimento e cláusulas
> de responsabilidade ainda deve ser produzida/assinada pelo advogado antes de
> qualquer operação com cliente real.

---

## 4. O que continua proibido (mesmo com aprovação jurídica)

- ❌ **Armazenar senha Gov.br.**
- ❌ **Armazenar OTP/código.**
- ❌ **Persistir cookie/token de sessão** em banco/disco.
- ❌ **Usar dados reais / PII real em desenvolvimento.**
- ❌ **Parecer órgão oficial.**
- ❌ **Prometer aprovação.**
- ❌ **Avançar o processo sem confirmação** do usuário.
- ❌ **Esconder do usuário que há automação.**
- ❌ **Coletar mais dados** do que o necessário (minimização).
- ❌ **Iniciar produção** sem **auth real + MFA + storage + KMS + retenção**.
- ❌ **Burlar captcha** ou contornar anti-bot (premissa permanente — `docs/26 §9`).

---

## 5. O que este gate LIBERA

Apenas **planejar** a próxima fase técnica controlada — **Fase 9 (prova técnica
controlada)**, ainda **antes** de implementá-la:

- **Preferencialmente em conta própria/autorizada** do dono.
- Com **dados próprios/autorizados** (não de cliente).
- Com **logs** e trilha auditável.
- Com **sessão efêmera**.
- Com **confirmação antes da GRU/protocolo**.
- Em **ambiente controlado**, um processo por vez.
- **Sem clientes reais ainda**, salvo decisão posterior explícita.

> Liberar **planejamento** não é liberar execução: a Fase 9 só começa com o plano
> aprovado e **confirmação explícita** do dono.

---

## 6. O que este gate NÃO libera

- ❌ **Lançamento público.**
- ❌ **Piloto com cliente real em massa.**
- ❌ **Armazenamento definitivo de PII** sem storage/KMS/retenção.
- ❌ **Pagamento real em escala.**
- ❌ **Automação sem observabilidade.**
- ❌ **Automação sem rollback/cancelamento.**
- ❌ **Automação sem termos finais** publicados e aceitos.
- ❌ **Escala nacional.**

---

## 7. Pendências que ainda travam produção/piloto

O gate jurídico é **uma** das travas; as demais (técnicas/operacionais) seguem
abertas (`docs/23 §5`, `docs/26 §19`):

- **Auth real** e **MFA admin**.
- **Storage seguro** e **KMS/criptografia**.
- **Retenção/expurgo** definidos e implementados.
- **Termos finais**, **política de privacidade**, **consentimento final**,
  **reembolso** — redigidos/assinados pelo advogado.
- **Mercado Pago produção** + **webhook público** verificado.
- **Política operacional** escrita e **treinamento** do operador.
- **Monitoramento** e **suporte** definidos.

> **Regra mantida:** produção/piloto só com **todas** as pendências fechadas — não
> há "resolve durante" (`docs/23 §5`).

---

## 8. Próximo passo recomendado

Criar um **plano da Fase 9** (ainda documento, sem implementar), cobrindo:

- **Escopo mínimo** (apenas Guia de Tráfego).
- **Conta própria/autorizada** do dono.
- **Um único processo** por vez.
- **Health check** do serviço externo **antes** de qualquer passo.
- **Sessão efêmera** (descarte garantido ao fim/erro/cancelamento).
- **Logs** e **screenshots mascaradas**.
- **Pausa obrigatória antes do ato irreversível** (confirmação humana).
- **Sem cliente real** inicialmente.
- **Rollback/cancelamento** claros em cada ponto.

> Esse plano deve ser **aprovado** antes de qualquer linha de automação real.

---

## 9. Riscos remanescentes (mesmo com jurídico validado)

- **Instabilidade do Gov/SINARM** (indisponibilidade, oscilação).
- **Mudança de tela/layout** do sistema do órgão (quebra a automação).
- **Erro de preenchimento** (dado incorreto).
- **Erro de arma/PCE** (seleção errada — risco crítico).
- **Indisponibilidade** do serviço externo.
- **Problema de sessão** (expira ~60 min, dupla autorização).
- **Confiança do usuário** (nicho desconfiado; boca a boca corta nos dois sentidos).
- **Segurança da infraestrutura** (server-side detém sessões autenticadas → alvo de
  alto valor).
- **Incidentes de dados** (vazamento — impacto reputacional e de segurança física
  dos titulares).
- **Mudança regulatória** no setor de armas (risco externo, independe do projeto).

> A validação jurídica **reduz** o risco jurídico do modelo; **não elimina** os
> riscos técnicos, operacionais e regulatórios acima.

---

## 10. Conclusão

- O **gate jurídico foi considerado aprovado**, conforme retorno reportado pelo dono.
- Isso **destrava o planejamento** da **Fase 9** (prova técnica controlada).
- **Não destrava produção** nem piloto amplo — as pendências do §7 seguem valendo.
- A próxima etapa deve ser **planejada com escopo mínimo e controle forte** (§8),
  com **confirmação explícita** antes de executar.

---

> **Lembrete permanente:** este documento registra uma **decisão**, não um parecer,
> e **não implementa nem autoriza a execução** de automação real. A Fase 9 só começa
> após o **plano aprovado**, e produção/piloto só após **todas** as pendências do §7
> — sempre com **confirmação explícita** do dono. Regras permanentes (`docs/00 §8`)
> e bloqueios de fase (`docs/15`) seguem íntegros.
