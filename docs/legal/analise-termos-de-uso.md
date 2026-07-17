# Análise de Termos de Uso e Base Legal por Provedor

> **Aviso:** este documento é **levantamento de risco para consulta jurídica**,
> **não** parecer legal. Nenhum item aqui autoriza automação. A liberação de um
> provedor para automação real depende de análise de um(a) advogado(a)
> registrada como `status jurídico: APROVADO` no `docs/08-inventario-provedores.md`.

## Como usar este documento

Para cada provedor:
1. Localizar e **colar o link** do Termo de Uso / Aviso Legal / Política de
   Privacidade do site oficial.
2. Transcrever os trechos relevantes sobre: acesso automatizado/robôs,
   finalidade de uso, redistribuição do resultado, e tratamento de dados.
3. Registrar a **base legal LGPD** aplicável ao nosso tratamento.
4. Concluir com um dos estados: `APROVADO`, `REPROVADO`, `PENDENTE_JURIDICO`.

---

## Provedor: `pf-antecedentes` — Certidão de Antecedentes Criminais / Polícia Federal

**Status jurídico atual: `PENDENTE_JURIDICO`** (bloqueia automação real)

### Fontes consultadas até agora (pesquisa web, 2026-07-16)
- Portal de serviços gov.br:
  https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais
- Página institucional PF: https://www.gov.br/pf/pt-br/assuntos/antecedentes-criminais
- Endpoint do sistema: https://servicos.pf.gov.br/epol-sinic-publico/
  (retornou **HTTP 403** a acesso não-navegador)

### O que já se sabe
- Serviço público, **gratuito**, resultado em **PDF**, validade **90 dias**.
- Considera apenas **condenações com trânsito em julgado**; é **vedado** mencionar
  identificação criminal antes do trânsito em julgado — **Lei 12.037/2009, art. 6º**.
- Casos de homônimo/divergência de CPF exigem **atendimento presencial** (protocolo).

### O que PRECISA ser verificado antes de qualquer automação (PENDENTE)
- [ ] **Termo de Uso / Aviso Legal do próprio sistema** (`epol-sinic-publico`):
      existe? proíbe acesso automatizado, robôs, scraping ou uso por terceiros?
      → **colar link e trecho literal aqui**.
- [ ] **Captcha**: existe? qual tipo? (o HTTP 403 sugere proteção anti-bot).
- [ ] **Login/identificação**: exige Gov.br (prata/ouro) ou certificado digital?
      Fontes divergem — confirmar na origem.
- [ ] **Emissão por terceiro/representante**: os termos permitem que a plataforma
      emita a certidão **em nome do titular**? Precisa de procuração/mandato?
- [ ] **Redistribuição**: podemos armazenar e repassar o PDF ao titular/processo?

### Base legal LGPD (a definir com jurídico)
- Titular consente e solicita o serviço → base provável: **execução de contrato /
  procedimento a pedido do titular** (LGPD art. 7º, V) + **consentimento** para
  dado de contexto sensível. **Confirmar com jurídico.**
- Dado é altamente sensível (antecedentes criminais) → reforçar minimização,
  finalidade específica, retenção curta e trilha de acesso.

### Riscos jurídicos preliminares (para o jurídico avaliar)
- Possível violação de Termo de Uso se houver proibição de automação (403 é
  indício de que o órgão não deseja acesso automatizado).
- Atuação em nome de terceiro pode configurar representação/mandato.
- Responsabilidade sobre classificação incorreta do resultado.

### Reconhecimento visual (fonte para preencher esta análise)
A etapa de reconhecimento assistido está definida em
`docs/08-inventario-provedores.md §10`. Ela deve capturar, direto da interface:
- [ ] Existência e link do **Termo de Uso / Aviso Legal** do sistema `epol-sinic-publico`.
- [ ] Trecho literal sobre **acesso automatizado / robôs / scraping** (se houver).
- [ ] Se exige **login Gov.br** (e qual nível) ou certificado digital.
- [ ] Tipo de **captcha**, se houver.

Enquanto o reconhecimento não é executado e o termo não é lido, **nada aqui
autoriza automação**.

### Conclusão preliminar
Tecnicamente promissor (PDF, campos conhecidos, base nacional), mas **retido em
`PENDENTE_JURIDICO`** até: (a) leitura do termo/aviso do sistema (via §10),
(b) definição sobre emissão em nome de terceiro, (c) base legal LGPD confirmada.
Estudo técnico só com **dados consentidos** (sócios) enquanto isso.
