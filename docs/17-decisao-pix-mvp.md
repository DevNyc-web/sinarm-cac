# 17 — Decisão: Provedor Pix do MVP (Fase 5)

> **O que é este documento.** Resumo comparativo para fechar a decisão **3.4
> (Provedor Pix)** do `docs/15-decisoes-fase-0.md`, que bloqueia a **Fase 5
> (pagamento Pix)** do roadmap (doc 14 §8).
>
> **Ainda NÃO é código.** Nada aqui implementa integração, webhook, SDK ou
> altera schema. Só análise e recomendação.
>
> **Última atualização:** 2026-07-18
> **Base:** `docs/10 §9` (Pix antes do protocolo), `docs/11 §8` (fluxo interno),
> `docs/12 §3.9/§8` (payments/estados), `docs/13 §7` (stack), `docs/15 §3.4`.
>
> ⚠️ **Taxas e condições mudam.** Todos os valores citados são referência de
> pesquisa (2026-07) e devem ser **confirmados no site oficial** de cada
> provedor antes de contratar.

---

## 1. O que o MVP exige do provedor

Do fluxo especificado (doc 10 §9, doc 11 §8, doc 12 §3.9):

1. **Cobrança Pix por processo** (~R$ 100), **dinâmica** (QR Code + copia e cola),
   criada quando o usuário aceita o resumo.
2. **Webhook de confirmação confiável** — o pagamento confirmado é o gatilho
   para `PAGO_EM_FILA`; precisa de **idempotência** (doc 15 §7 #10).
3. **Sandbox/homologação** para a Fase 5 rodar **sem dinheiro real**.
4. **Conciliação simples** (extrato/API) — financeiro confere Pix antes de
   liberar a operação (segregação de funções, doc 11 §3).
5. **Liberação rápida** do valor (Pix tende a ser imediato/D+0 nos PSPs BR).
6. **Reembolso via API** — política de reembolso por estágio (doc 10 §15).
7. Integração razoável em **Next.js/Node** (SDK ou REST simples).
8. Aceitar **serviço digital pago antecipadamente** (pagamento antes do
   protocolo) sem atrito de risco/chargeback — Pix não tem chargeback, mas o
   PSP pode reter/analisar contas novas.

---

## 2. Comparativo

| Critério | Mercado Pago | Efí (ex-Gerencianet) | Asaas | Stripe | Pagar.me (Stone) |
|---|---|---|---|---|---|
| **1. Facilidade p/ MVP** | Alta — SDK Node, conta rápida | Média — API Pix robusta, mas setup com certificado/chave | **Alta** — REST simples, conta digital PJ | **Baixa no BR** (ver §3) | Média |
| **2. QR Code / copia e cola** | ✅ | ✅ (especialista Pix) | ✅ | ✅ (quando habilitado) | ✅ |
| **3. Webhook de confirmação** | ✅ (assinatura/x-signature) | ✅ (via mTLS ou skip-mtls) | ✅ (token simples, reenvio automático) | ✅ (excelente) | ✅ |
| **4. Sandbox/testes** | ✅ contas de teste | ✅ ambiente de homologação | ✅ sandbox completo | ✅ test mode exemplar | ✅ |
| **5. Documentação** | Boa, extensa (às vezes dispersa) | Boa, focada em Pix | **Boa e direta** | Excelente | Razoável |
| **6. Conciliação** | Painel + API; volume grande de recursos | Extrato Pix via API | **Forte** (conta digital + extrato + API) | Painel bom; menos comum p/ Pix BR | Painel Stone |
| **7. Liberação (Pix)** | Imediata/D+0 típico — confirmar | Imediata (cai na conta Efí) — confirmar | Imediata/D+0 típico — confirmar | **~2 dias úteis** | Confirmar |
| **8. Taxa Pix (referência)** | ~0,99% — **confirmar no site** | ~1,19% — **confirmar no site** | até ~0,99% — **confirmar no site** | tarifa local — **confirmar no site** | **confirmar no site** |
| **9. Risco operacional** | Baixo (gigante consolidado); suporte impessoal | Baixo/médio (PSP certificado Bacen, forte em Pix) | Baixo/médio (fintech consolidada em cobranças PJ) | **Alto p/ este caso** (Pix por convite no BR) | Médio (foco em volume maior) |
| **10. Serviço digital, pgto antes do protocolo** | ✅ comum na plataforma | ✅ | ✅ (foco em cobranças de serviços) | ✅ em tese, se habilitado | ✅ |
| **11. Complexidade no Next.js** | Baixa/média (SDK oficial Node) | Média (certificado .p12/mTLS no servidor) | **Baixa** (REST + API key + webhook token) | Baixa (se disponível) | Média |

**Outra alternativa relevante:** **OpenPix/Woovi** — especialista Pix,
dev-friendly (API/webhook simples, plugins), bom para MVP; menos conhecido
como marca frente ao cliente e ao banco. Vale manter como **plano B técnico**
se MP/Asaas apresentarem atrito no cadastro.

---

## 3. Por que o Stripe não serve para este MVP

Confirmado em pesquisa (2026-07): para **empresas sediadas no Brasil**, o Pix
no Stripe está **"apenas para convidados"** — exige histórico de processamento
nos últimos 60 dias e adimplência, com repasse em **~2 dias úteis** (vs.
imediato nos PSPs BR). Uma empresa nova, sem histórico Stripe, começaria
**sem Pix** — exatamente o único meio de pagamento do MVP. **Descartado para a
Fase 5**; pode ser reavaliado quando houver cartão (pós-MVP).

---

## 4. Recomendação final

**Recomendação para o MVP: Mercado Pago** (recomendação principal).

- Conta PJ rápida de abrir, marca que o pagador reconhece (reduz desconfiança
  num serviço novo que cobra **antes** do protocolo).
- Pix dinâmico + webhook assinado + sandbox com contas de teste.
- SDK Node oficial; integração direta em route handler do Next.js.
- Taxa de referência ~0,99% sobre R$ 100 = ~R$ 1/processo — irrelevante para a
  margem do MVP (**confirmar no site oficial**).

**Alternativa aceitável: Asaas** — API/webhook mais simples do mercado,
conciliação forte para PJ; escolher se o cadastro/risco do Mercado Pago criar
atrito, ou se a conta digital integrada simplificar o financeiro.

**Plano B técnico:** OpenPix/Woovi. **Efí**: sólido em Pix, mas o manejo de
certificado mTLS adiciona complexidade sem benefício claro para este volume.
**Stripe**: descartado (§3).

> A escolha **não** trava a arquitetura: o código da F5 deve nascer atrás de um
> **payment adapter** (mesmo padrão do storage adapter da F4), com o webhook
> idempotente — trocar de PSP depois custa pouco.

---

## 5. Condições para a Fase 5 (mesmo com provedor escolhido)

**A Fase 5 começa em sandbox/dev:**
- Cobrança e webhook **apenas em sandbox/homologação**; **nenhum Pix real**.
- Dados fictícios; sem CPF real no payload de cobrança.
- Estados de `payments` (doc 12 §8) e idempotência (doc 15 §7 #10) modelados
  nessa fase.

**Pix REAL em produção só depois de:**
1. **Conta PJ validada** no provedor escolhido.
2. **Webhook testado** ponta a ponta (incluindo reentrega/idempotência).
3. **Política de reembolso revisada** (doc 10 §15) e refletida na integração.
4. **Termos de uso/consentimentos prontos** (doc 10 §16) exibidos antes do pagamento.
5. Regras permanentes intactas: **bloquear cobrança** se Gov/SINARM instável
   (doc 10 §9); **nunca** confundir Pix do cliente com a GRU (doc 11 §8/§9).

---

## 6. Próximos passos

1. **Usuário confirma** o provedor (recomendação: Mercado Pago).
2. Registrar a escolha no `docs/15` §3.4 (feito como recomendação; vira
   **DECIDIDO** com a confirmação).
3. Abrir conta/sandbox no provedor escolhido (fora do repositório).
4. Só então planejar a implementação da F5: payment adapter + cobrança +
   webhook idempotente + estados de `payments` — **em sandbox**.

---

> **Lembrete permanente:** nada neste documento autoriza implementar código,
> instalar dependências, criar conta ou integrar provedor. É análise para
> decisão. A implementação da Fase 5 só começa após **confirmação explícita**
> do usuário.
