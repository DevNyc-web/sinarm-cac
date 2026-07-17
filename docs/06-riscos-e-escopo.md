# 06 — Riscos e Escopo

## 15. Riscos técnicos, jurídicos e LGPD

### Riscos técnicos
- **Fragilidade do scraping.** Sites gov mudam layout sem aviso → roteiros
  quebram. Mitigação: um provedor por arquivo, fixtures, trace em falha,
  monitoramento de saúde por provedor.
- **Captcha / anti-bot** (Cloudflare, reCAPTCHA). Pode inviabilizar automação em
  parte dos provedores. Mitigação: human-in-the-loop; e aceitar que alguns
  provedores serão manuais/assistidos.
- **Instabilidade e indisponibilidade** dos sites externos. Mitigação: timeouts,
  backoff, circuit breaker, dead-letter, retentativa.
- **Bloqueio por IP / rate limiting.** Concorrência controlada, não paralelizar
  agressivo contra o mesmo provedor.
- **Classificação incorreta.** Um "positiva" lido como "negativa" é gravíssimo no
  contexto CAC. Mitigação: só classificar com âncora textual explícita;
  ambíguo → revisão humana; nunca inferir negativa por ausência de erro.
- **Erro de identidade.** Homônimos / dados trocados. Mitigação: validar CPF/RG,
  conferir dados retornados contra o input.

### Riscos jurídicos
> **Não sou advogado. Isto é levantamento de risco para consulta jurídica, não
> parecer legal.** Estes pontos precisam de validação de um advogado antes de
> qualquer automação ir ao ar.

- **Termos de Uso dos sites.** Vários sites gov proíbem acesso automatizado.
  Automatizar mesmo assim pode violar os ToS. → `automacaoPermitida` por
  provedor, revisado juridicamente, é bloqueante.
- **Atuação como despachante / representação.** Emitir certidões e protocolar em
  nome do CAC pode exigir procuração e configurar atividade regulada.
- **Captcha / antifraude.** Burlar captcha de forma automatizada pode ter
  implicação legal. Só via caminho permitido pelo provedor.
- **Acesso autenticado do titular.** Algumas certidões exigem o acesso pessoal/
  autenticado da própria pessoa — automatizar isso é diferente de acessar um
  serviço público aberto.
- **Responsabilidade sobre o resultado.** Se a plataforma classifica errado e o
  CAC toma decisão com base nisso, de quem é a responsabilidade? Definir em
  contrato e em disclaimers.

### Riscos LGPD
Detalhados em `05-logs-auditoria-lgpd.md §15`. Resumo: volume alto de PII
sensível ao contexto; exige base legal, minimização, cifragem, retenção,
trilha de acesso, DPA com terceiros, ROPA e resposta a incidentes desde o
laboratório.

## 16. O que NÃO construir agora

Regras firmes desta fase — qualquer uma delas pede confirmação explícita sua
antes de mudar:

- ❌ App/PWA completo ou telas finais de usuário
- ❌ Login Gov.br / integração OAuth Gov.br
- ❌ Pagamento Pix / integração com PSP
- ❌ Scanner / OCR / leitura de documentos
- ❌ Protocolo no SINARM / Guia de Tráfego
- ❌ Painel admin, suporte, notificações
- ❌ **Automação real de certidões** — só depois de você aprovar esta arquitetura
- ❌ Instalar dependências ou plugar serviços externos (incl. Supabase) sem antes
  explicar e você aprovar
- ❌ Processar dados reais de terceiros sem consentimento

### O que a Fase 1 (laboratório) SIM vai fazer, na sequência
1. Documentação e arquitetura (**este passo — feito**).
2. Inventário jurídico-técnico dos provedores (URL, campos, captcha,
   `automacaoPermitida`).
3. Protótipo isolado do engine (Playwright) para **1 provedor** que permita
   automação, com dados consentidos.
4. Classificação + storage + logs desse provedor.
5. Avaliar o resultado e decidir se expande para mais provedores.
