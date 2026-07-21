# 34 — Checklist de Execução da Fase 9

> **O que é este documento.** O **checklist operacional final** para **aprovar ou
> bloquear** a execução da Fase 9 (Prova Técnica Controlada), item a item, **antes**
> de qualquer linha de automação real. É o **último documento** antes de código
> contra ambiente real.
>
> **NÃO autoriza execução sozinho.** A execução só começa com o **bloco de aprovação
> explícita** (§16) preenchido e assinado. Enquanto isso: **não implementa
> automação, não acessa Gov.br/SINARM, não usa dados reais.**
>
> **Data:** 2026-07-20
> **Commit base:** `57921fb` — *docs: plan phase 9 controlled technical proof*
> **Base:** `docs/33` (plano da Fase 9), `docs/32` (gate jurídico), `docs/30`
> (falha segura), `docs/26` (arquitetura/gates §19).

---

## 1. Objetivo do checklist

Servir de **portão final**: aprovar ou bloquear a execução da Fase 9 **antes** de
qualquer código contra ambiente real. Nenhum item pulado; qualquer item aberto
**bloqueia** a execução.

---

## 2. Regra principal da Fase 9

- A automação **pode navegar/preencher até o checkpoint**.
- **Ponto de parada obrigatório: a tela "Dados da GRU"**.
- ❌ **NÃO clicar "Gerar GRU e Salvar".**
- ❌ **NÃO gerar protocolo real.**
- ❌ **NÃO pagar GRU/taxa.**
- ❌ **NÃO usar cliente real** no primeiro teste.

> Esta é a regra inegociável da Fase 9. Ir além exige **nova** decisão explícita,
> registrada à parte.

---

## 3. Escopo aprovado para a primeira execução

| Campo | Valor |
|-------|-------|
| Processo | Guia de Tráfego |
| Conta | própria/autorizada |
| Cliente real | **não** |
| Quantidade | **1 processo** |
| Região/superintendência | _preencher antes_ |
| Ambiente | controlado |
| Responsável técnico | _preencher antes_ |
| Responsável operacional | _preencher antes_ |
| Data/hora planejada | _preencher antes_ |

---

## 4. Pré-check jurídico

- [ ] Retorno jurídico **registrado** em `docs/32`.
- [ ] Escopo da Fase 9 **compatível** com `docs/32`.
- [ ] **Sem cliente real.**
- [ ] **Sem promessa de aprovação.**
- [ ] **Sem pagamento real** de usuário.
- [ ] **Sem ato irreversível** (para em "Dados da GRU").
- [ ] **Consentimento/autorização própria registrada.**
- [ ] **Dúvidas jurídicas resolvidas** antes da execução.

---

## 5. Pré-check técnico

- [ ] Repo **clean** (`git status` limpo).
- [ ] **Branch correta.**
- [ ] **Variáveis de ambiente controladas** (fora do repo).
- [ ] **Playwright instalado.**
- [ ] **Navegador/binary disponível** (Chromium).
- [ ] **Execução isolada** (máquina/servidor dedicado).
- [ ] **Logs habilitados.**
- [ ] **Artifacts configurados.**
- [ ] **Artifacts gitignored.**
- [ ] **Sem URL hardcoded** além das permitidas.
- [ ] **Sem credenciais no código.**
- [ ] **Sem screenshots sensíveis versionadas.**

---

## 6. Pré-check de segurança da sessão

- [ ] **Não armazenar senha.**
- [ ] **Não armazenar OTP.**
- [ ] **Não persistir cookie/token** em banco.
- [ ] **Sessão efêmera.**
- [ ] **Descarte de sessão planejado.**
- [ ] **Cache/browser context descartável.**
- [ ] **Logs sem segredo.**
- [ ] **Screenshots mascaradas** ou desativadas.
- [ ] **Trace sensível desativado ou expurgado.**

---

## 7. Pré-check de dados

- [ ] **Dados próprios/autorizados.**
- [ ] **Sem dados de cliente real.**
- [ ] **Sem dados de terceiro.**
- [ ] **Documento autorizado** (se usado no teste).
- [ ] **Arma/PCE conferida.**
- [ ] **Destino conferido.**
- [ ] **Finalidade conferida.**
- [ ] **Justificativa conferida.**
- [ ] **Nenhum dado real entra no git.**
- [ ] **Nenhum artifact sensível entra no git.**

---

## 8. Health check antes da execução

- [ ] Verificar disponibilidade de forma **leve**.
- [ ] **Não** fazer teste agressivo.
- [ ] Se **instável → abortar**.
- [ ] **Registrar o motivo** do abort.
- [ ] **Não iniciar** o fluxo se houver erro externo.

---

## 9. Critérios de parada obrigatória

**Parar imediatamente** se ocorrer qualquer um:

- 🔴 Captcha inesperado.
- 🔴 Login/autorização divergente.
- 🔴 Tela diferente do esperado.
- 🔴 Campo obrigatório ausente.
- 🔴 Arma/PCE ambígua.
- 🔴 Dado não bate.
- 🔴 Documento não aceito.
- 🔴 Serviço instável.
- 🔴 Erro inesperado.
- 🔴 Qualquer dúvida operacional/jurídica.

---

## 10. Checklist de execução passo a passo

Marcar **durante** a execução:

- [ ] Iniciar gravação/log.
- [ ] Abrir navegador controlado.
- [ ] Iniciar sessão.
- [ ] Usuário/conta autorizada realiza **login** (janela oficial).
- [ ] Navegar ao **serviço correto**.
- [ ] Selecionar **Guia de Tráfego**.
- [ ] Preencher **destino**.
- [ ] Selecionar **finalidade**.
- [ ] Selecionar **PCE/arma**.
- [ ] **Anexar/validar documento**, se aplicável ao teste.
- [ ] Preencher **observação**.
- [ ] Chegar à tela **"Dados da GRU"**.
- [ ] **PARAR.**
- [ ] Registrar evidência.
- [ ] ❌ **NÃO clicar "Gerar GRU e Salvar".**
- [ ] Encerrar sessão.
- [ ] Descartar contexto.
- [ ] Gerar relatório interno.

---

## 11. Evidências permitidas

- Log textual por etapa.
- Timestamp.
- Resultado de cada etapa.
- Screenshot **mascarada** da tela de parada, **se seguro**.
- Relatório interno.
- Motivo de parada.
- Confirmação de **descarte de sessão**.

---

## 12. Evidências proibidas

- ❌ Senha.
- ❌ OTP.
- ❌ Cookie.
- ❌ Token.
- ❌ Print com dado sensível desnecessário.
- ❌ Documento real em artifact.
- ❌ Arquivo temporário com credencial.
- ❌ Vídeo/trace com dado sensível sem expurgo.
- ❌ **Qualquer evidência versionada no git.**

---

## 13. Rollback / abort

- [ ] **Como cancelar antes do irreversível:** interromper em qualquer etapa
      anterior a "Dados da GRU".
- [ ] **Como fechar o navegador.**
- [ ] **Como descartar a sessão** (cookies/tokens/cache).
- [ ] **Como limpar artifacts sensíveis.**
- [ ] **Como registrar a falha** (motivo/etapa/horário).
- [ ] **Como garantir que nenhum protocolo foi gerado.**
- [ ] **Como garantir que nenhuma taxa foi paga.**

---

## 14. Critérios de sucesso da execução

A execução só é **sucesso** se **todos**:

- [ ] Chegou à tela **"Dados da GRU"**.
- [ ] **Parou antes** do ato irreversível.
- [ ] **Não gerou protocolo.**
- [ ] **Não pagou taxa.**
- [ ] **Sessão foi descartada.**
- [ ] **Logs foram gerados.**
- [ ] **Nenhum dado sensível foi versionado.**
- [ ] **Relatório interno produzido.**

---

## 15. Critérios de falha aceitável

Falhas **aceitáveis** (o sistema parou com segurança):

- Tela mudou.
- Sessão expirou.
- Campo mudou.
- Serviço instável.
- Erro inesperado.
- **A automação parou com segurança.**

> **Falhar parando é aceitável. Avançar sem certeza é inaceitável.** No dúvida,
> para — como no laboratório 8C (`docs/30`).

---

## 16. Aprovação explícita antes de executar

> **A execução só começa com este bloco preenchido e assinado.** Sem ele, o
> checklist **não** autoriza nada.

```
Aprovado por: ______________________________
Data: _______________________________________
Escopo aprovado: ____________________________
Conta autorizada: ___________________________
Ponto de parada: "Dados da GRU" (sem gerar GRU/protocolo)
Observações: ________________________________
Assinatura/registro interno: ________________
```

---

## 17. Checklist pós-execução

- [ ] Confirmar **descarte da sessão**.
- [ ] **Verificar artifacts.**
- [ ] **Remover artifacts sensíveis.**
- [ ] **Registrar o resultado.**
- [ ] **Atualizar docs de validação** (`docs/37`, §19).
- [ ] **Decidir** se repete, ajusta ou cancela.
- [ ] **Não** avançar para cliente real automaticamente.

---

## 18. O que NÃO fazer depois da Fase 9

Mesmo se der certo:

- ❌ Não lançar.
- ❌ Não aceitar cliente real automaticamente.
- ❌ Não liberar pagamento real.
- ❌ Não escalar.
- ❌ Não remover a pausa antes do irreversível.
- ❌ Não automatizar outros processos sem novo plano.

---

## 19. Próximo documento após execução

- `docs/37-validacao-fase-9-prova-controlada.md` — **somente depois** da execução
  autorizada, para registrar o que aconteceu, evidências e decisão de continuar/
  ajustar/parar.

> **Nota de numeração:** o `docs/36` passou a registrar a **preparação/infra segura**
> da Fase 9 (config, módulo, runner bloqueado — 2026-07-21); por isso a **validação da
> execução real** foi remanejada para o **`docs/37`**.

---

## 20. Conclusão

- Este checklist **protege a primeira aproximação real**.
- A **execução continua bloqueada** até a **aprovação explícita** (§16).
- O **ponto de parada obrigatório é "Dados da GRU"** — sem gerar GRU/protocolo.
- **A Fase 9 não é produção nem piloto** — é uma prova técnica controlada, única, em
  conta própria/autorizada.

---

> **Lembrete permanente:** este documento é um **checklist de aprovação**, não a
> autorização. Não implementa automação, não toca Gov.br/SINARM, não usa dados
> reais. A execução depende do **bloco §16 assinado**; produção/piloto dependem das
> pendências do `docs/23 §5` / `docs/32 §7`. Regras permanentes (`docs/00 §8`) e
> bloqueios de fase (`docs/15`) seguem íntegros.
