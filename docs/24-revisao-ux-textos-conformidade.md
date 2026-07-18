# 24 — Revisão de Produto, UX e Textos (Conformidade)

> **O que é este documento.** Revisão da **comunicação** do MVP — tela por tela,
> texto por texto — para achar o que pode parecer órgão oficial, prometer
> aprovação, sugerir automação inexistente, confundir Pix com GRU ou criar risco
> jurídico/LGPD.
>
> **Nenhuma tela foi alterada.** Aqui só se **aponta e propõe**. As correções
> dependem de confirmação explícita.
>
> **Data:** 2026-07-18
> **Base revisada:** telas atuais em `src/app/` (commit `a6a1ac9`), `README.md`,
> `docs/10 §14/§15/§16`, `docs/11 §11/§19`, `docs/21`, `docs/23`.

---

## 1. Objetivo da revisão

Garantir que **nada do que escrevemos** induza o usuário a acreditar que:

- somos órgão público ou agimos em nome dele;
- o processo será **aprovado**;
- o **sistema** acessa Gov.br/SINARM e protocola sozinho;
- o valor pago é a **taxa do órgão** (GRU);
- não há **pessoas** envolvidas na execução.

E que nenhum texto exponha **dado interno**, **jargão técnico** ou **PII**.

---

## 2. Princípios de comunicação

1. **Honestidade acima de conversão.** Se a frase vende melhor mentindo, ela sai.
2. **Serviço privado, sempre explícito.** Nunca insinuar vínculo oficial.
3. **Nunca prometer resultado.** Prometemos *cuidado no preparo*, não aprovação.
4. **A pessoa aparece.** Dizer que **um operador humano** executa — é diferencial,
   não vergonha.
5. **Dinheiro é claro.** O que o usuário paga a nós ≠ taxa do órgão.
6. **Sem jargão interno** na cara do usuário (fase, mock, sandbox, enum, stack).
7. **Erro não culpa o usuário** nem expõe entranhas do sistema.
8. **Tom adulto e direto** — nada de eufemismo que esconda risco.

---

## 3. Frases proibidas ou perigosas

| ❌ Não escrever | Por quê |
|---|---|
| "Emitimos sua Guia de Tráfego" | sugere que **nós** emitimos; quem emite é o órgão |
| "Protocolamos seu processo automaticamente" | falsa automação |
| "Nosso sistema acessa o SINARM" | falso e perigoso |
| "Aprovação garantida" / "100% de aprovação" | promessa de resultado |
| "Processo aprovado em X dias" | promessa de prazo do órgão |
| "Taxa da plataforma: R$ 100 (GRU)" | confunde nosso preço com a GRU |
| "Portal oficial", "sistema do Exército/PF" | aparência de órgão |
| "Faça login com seu Gov.br aqui" | sugere que capturamos credencial |
| "Automatizamos todo o processo" | falso |
| "Seus dados ficam seguros conosco para sempre" | promessa vaga, conflita com retenção |
| "Rascunho — Fase 3", "mock/dev", "sandbox" | jargão interno vazando |

---

## 4. Frases recomendadas

- "**Serviço privado de assistência.** Não somos órgão público."
- "**Não garantimos aprovação.** Quem defere é o órgão competente."
- "Preparamos e conferimos seus dados; **a execução no sistema oficial é feita
  por uma pessoa da nossa equipe**."
- "**Você faz o login na janela oficial do Gov.br. Nunca vemos sua senha.**"
- "O valor do nosso serviço é **R$ X** e **já inclui a GRU de R$ 20**, que é uma
  **taxa do órgão**, não nossa."
- "Se não conseguirmos concluir, **você é reembolsado** conforme a política."
- "Precisamos de um ajuste no seu processo — veja o que fazer."

---

## 5. Riscos de parecer órgão oficial

| Risco | Situação atual |
|---|---|
| Uso de brasão/identidade oficial | ✅ **não ocorre** — marca neutra |
| Nome do produto sugerir vínculo | ⚠️ "**Plataforma CAC / SINARM**" (README) e title "Plataforma CAC" — "SINARM" no nome aproxima demais do órgão |
| Ausência de aviso "serviço privado" | ✅ landing tem; ⚠️ **demais telas não têm** |
| Linguagem burocrática imitando o órgão | ✅ não ocorre |

**Ação:** manter marca neutra sem "SINARM" no nome do produto; repetir o aviso
"serviço privado, não somos órgão público" no **rodapé de todas as telas**.

---

## 6. Riscos de promessa de aprovação

- ✅ Landing já diz **"não prometemos aprovação"** — bom.
- ⚠️ **Nenhuma outra tela repete isso**, inclusive a de pagamento — que é
  justamente onde a expectativa se forma.
- ⚠️ Status **"Protocolo registrado"** pode ser lido como "deu certo". Precisa de
  complemento: *"protocolado não significa aprovado; o órgão ainda analisa."*

---

## 7. Riscos de falsa automação

- ✅ **Painel admin está exemplar**: "O sistema não acessa Gov.br/SINARM", "O
  sistema não protocola", "apenas registra o que o operador fez fora do app".
- ✅ Tela do usuário diz: *"este aplicativo não opera os sistemas do órgão"*.
- ⚠️ O **rótulo de permissão "Executar fluxo no SINARM/CAC"** (herdado do
  docs/11 §3) sugere que se executa **pelo painel**. Trocar por **"Executar o
  fluxo no SINARM/CAC (fora do app)"**.
- ⚠️ Botão **"Gerar cobrança Pix"** é ação nossa (ok), mas na mesma tela que fala
  de GRU pode confundir — ver §8.

---

## 8. Riscos de confundir Pix do serviço com GRU

**Este é o risco financeiro mais concreto encontrado.**

Situação atual na tela de pagamento do usuário: mostra *"valor fictício de
R$ 100,00"* e **não explica o que esse valor cobre**. O usuário não vê que:

- **R$ 100** = nosso serviço (inclui a GRU);
- **R$ 20** = **GRU**, taxa do **órgão**, paga pela empresa em nome do processo;
- ele **não deve** pagar GRU separadamente por conta própria.

**Ação obrigatória antes de cobrar:** bloco fixo de composição de preço na tela
de pagamento (§13).

---

## 9. Riscos de LGPD / privacidade

| Item | Situação |
|---|---|
| Aviso "não envie documento real" (fase dev) | ✅ presente e claro |
| **Termos, privacidade e consentimento** nas telas | 🔴 **AUSENTES** — nenhuma menção em nenhuma tela do usuário |
| Aviso anti-PII em campos livres (notas) | ✅ presente no admin |
| Retenção comunicada ao usuário | 🔴 ausente |
| Senha Gov.br | ✅ nunca pedida; ⚠️ **falta dizer isso ao usuário** na tela |
| Direitos do titular (acesso/exclusão) | 🔴 ausente |

**Gap crítico:** cobrar e tratar dados **sem termos aceitos** não é aceitável no
piloto (docs/10 §16, docs/23 §7).

---

## 10. Revisão por tela (situação atual)

| # | Tela | Achados |
|---|------|---------|
| 1 | **Landing** (`(public)/page.tsx`) | ✅ "Serviço privado", "não somos órgão público e não prometemos aprovação" — **os melhores textos do app**. 🔴 rodapé "**Esqueleto — Fase 1. Sem dados reais.**" (jargão interno público). ⚠️ CTA "Começar" leva a tela que exige login → redireciona. |
| 2 | **Login** | ⚠️ 100% jargão dev ("Autenticação de desenvolvimento (Fase 2)", "Perfis fictícios", "mock/dev"). Aceitável **hoje**, **impossível** em produção. |
| 3 | **Dashboard** | 🔴 erro técnico exposto ao usuário: *"Configure o Postgres local (.env + npm run db:push && npm run seed)"*. ⚠️ "Usuário fictício de desenvolvimento (Fase 2)". ⚠️ "(sandbox)" no status de pagamento. |
| 4 | **Novo processo** | ⚠️ "Arma/PCE (catálogo fictício)". ✅ "O acervo real do SINARM não é acessado" (honesto). |
| 5 | **Sucesso do rascunho** | 🔴 **enum cru exibido**: `Status: RASCUNHO`. 🔴 "as próximas etapas ... chegam **nas fases seguintes**" (roadmap interno). ✅ "Isto NÃO é um protocolo". |
| 6 | **Revisão do processo** | ✅ **"este aplicativo não opera os sistemas do órgão"** — excelente. ✅ "não envie documento real". ⚠️ "Ambiente de desenvolvimento" repetido. |
| 7 | **Pagamento Pix** | ✅ "Pagamento fictício/sandbox. Não pague Pix real". 🔴 **não explica a composição do preço** (§8). |
| 8 | **Status do usuário** | ✅ rótulos amigáveis e neutros. ⚠️ "Protocolo registrado" sem ressalva de que não é aprovação. |
| 9–11 | **Painel / fila / detalhe admin** | ✅ **melhor conjunto de avisos do produto** (não acessa, não protocola, registra o que o humano fez). ⚠️ rótulo "Executar fluxo no SINARM/CAC" (§7). |
| 12 | **Mensagens/notas** | ✅ aviso anti-PII presente. ⚠️ falta orientação de **tom** ao escrever para o usuário. |
| 13 | **README** | 🔴 **desatualizado e falso**: "Status atual: **Fase 0** — planejamento... **Nenhum código de aplicação foi construído ainda**" e "Fase atual: Fase 1 — Laboratório de Certidões", quando as Fases 1–7 estão implementadas. |
| 14 | **Docs 10/11/21/23** | ✅ consistentes: reembolso (10 §15), consentimentos (10 §16), status ao usuário (11 §11), limite manual (21 §2), checklist (23). |

---

## 11. Textos que devem ser trocados

| Onde | Hoje | Proposta |
|---|---|---|
| Landing (rodapé) | "Esqueleto — Fase 1. Sem dados reais." | **remover**; em ambiente dev, usar faixa só visível fora de produção |
| Dashboard (erro) | "Configure o Postgres local (.env + npm run db:push…)" | "Não conseguimos carregar seus processos agora. Tente de novo em instantes — se persistir, fale com o suporte." |
| Dashboard (aviso) | "Usuário fictício de desenvolvimento (Fase 2)…" | faixa de ambiente, fora da área de conteúdo |
| Sucesso | "Status: RASCUNHO" | **rótulo amigável** ("Rascunho salvo") — nunca enum |
| Sucesso | "…chegam nas fases seguintes" | "As próximas etapas ficam disponíveis conforme o processo avança." |
| Status | "Protocolo registrado" | "Protocolo registrado — **protocolado não é aprovado**; o órgão ainda analisa." |
| Permissão | "Executar fluxo no SINARM/CAC" | "Executar o fluxo no SINARM/CAC (**fora do app**)" |
| README | "Fase 0 … nenhum código construído" | estado real: Fases 1–7 em dev/fictício, produção bloqueada |
| Nome/título | "Plataforma CAC / SINARM" | nome neutro **sem "SINARM"** |

---

## 12. Textos que estão adequados (manter)

- Landing: "Serviço privado · marca neutra" + "Não somos órgão público e não
  prometemos aprovação."
- Metadata: "Serviço privado de assistência a processos SINARM/CAC. Não é órgão
  oficial."
- Revisão do usuário: "**este aplicativo não opera os sistemas do órgão**".
- Upload: "**Não envie documento real** — nada de RG, CPF, CNH…".
- Pagamento: "**Pagamento fictício/sandbox. Não pague Pix real.**"
- Novo processo: "O acervo real do SINARM não é acessado."
- Sucesso: "**Isto NÃO é um protocolo.**"
- Admin: "O sistema não acessa Gov.br/SINARM", "O sistema não protocola", "apenas
  registra o que o operador fez fora do app".
- Admin: "&quot;Pronto para protocolo manual&quot; apenas sinaliza a fila."
- Notas: "**Não escreva PII** (CPF, RG, endereço, nº de série)".

> O padrão de honestidade do **painel admin** deve ser espelhado nas telas do
> usuário.

---

## 13. Sugestões de microcopy

**Pagamento**
> **R$ 100,00 — serviço de assistência**
> Inclui a **GRU de R$ 20,00**, que é uma **taxa do órgão** (não é nossa).
> Você **não precisa** pagar a GRU separadamente: nós recolhemos por você.
> Pagamento por Pix, antes do início da execução.
> *Este valor não garante aprovação — veja a política de reembolso.*

**Protocolo**
> **Protocolo registrado: {número}**
> O protocolo foi obtido **por um operador da nossa equipe**, no sistema
> oficial. **Protocolado não significa aprovado** — o órgão ainda vai analisar.

**GRU**
> **GRU (taxa do órgão) — R$ 20,00**
> Emitida pelo sistema oficial e **paga por nós**, já embutida no valor que você
> pagou. Vencimento: {data}.

**Execução manual**
> **Em execução.** Uma pessoa da nossa equipe está conduzindo seu processo no
> sistema oficial. **O aplicativo não opera esse sistema sozinho.** Se
> precisarmos que você faça login no Gov.br, avisamos aqui — **e nunca vemos sua
> senha**.

**Status**
> **Em revisão** — conferindo seus dados.
> **Em execução** — nossa equipe está trabalhando no seu processo.
> **Precisamos de um ajuste** — veja o que fazer.
> **Em acompanhamento** — protocolado; aguardando o órgão.

**Suporte**
> Alguma dúvida? **Fale com a gente** — respondemos em até {prazo}.
> Não pedimos senha do Gov.br por nenhum canal.

**Bloqueio**
> **Seu processo está pausado.** Motivo: {motivo em linguagem simples}.
> O que fazer: {ação}. Se preferir cancelar, veja a política de reembolso.

**Reembolso**
> **Antes de começarmos:** reembolso integral.
> **Depois de iniciada a execução:** reembolso conforme o estágio.
> **Depois do protocolo/GRU gerada:** não reembolsável — houve custo e ato
> irreversível no órgão.
> Se a falha for **nossa**, devolvemos o valor independentemente do estágio.

---

## 14. Avisos obrigatórios sugeridos

Devem existir de forma **fixa e visível** (rodapé e/ou pontos-chave):

1. **Plataforma privada** de assistência.
2. **Não somos órgão oficial** nem temos vínculo com Gov.br, PF ou Exército.
3. **Não garantimos aprovação** — a decisão é do órgão competente.
4. **Execução assistida por operador humano** da nossa equipe.
5. **Gov.br/SINARM não são acessados automaticamente pelo sistema**; o login é
   feito por você, na janela oficial, e **nunca vemos sua senha**.
6. **GRU é taxa do órgão/entidade competente**, separada do nosso serviço (e já
   inclusa no preço).
7. **Documentos só devem ser enviados em ambiente de produção seguro** —
   enquanto estivermos em desenvolvimento, **não envie documento real**.

---

## 15. Checklist de conformidade textual antes do piloto

- [ ] Nenhuma tela do usuário contém "Fase N", "mock", "dev", "sandbox", "enum",
      nome de tabela ou comando de terminal.
- [ ] Nenhum **status cru** (enum) aparece para o usuário.
- [ ] Nenhuma mensagem de erro expõe **stack, env, banco ou caminho**.
- [ ] Os **7 avisos** do §14 estão visíveis.
- [ ] Composição do preço (serviço + GRU) exibida **antes** do pagamento.
- [ ] Política de **reembolso** exibida antes do pagamento e aceita.
- [ ] **Termos + privacidade + consentimento** publicados e aceitos no fluxo.
- [ ] "Protocolado ≠ aprovado" explícito no status.
- [ ] Nenhuma frase da lista §3 aparece em nenhum lugar.
- [ ] README e metadata refletem o **estado real** do produto.
- [ ] Revisão de português e consistência de termos (um nome por conceito).
- [ ] Textos de suporte e bloqueio prontos, sem culpar o usuário.

---

## 16. Alterações recomendadas antes de produção

**Prioridade alta (bloqueiam o piloto):**

1. Publicar e exigir aceite de **termos, privacidade e reembolso**.
2. Bloco de **composição de preço** (serviço + GRU) na tela de pagamento.
3. Remover **jargão dev** e **enums crus** das telas do usuário; erro genérico no
   dashboard.
4. Adicionar os **7 avisos obrigatórios** (§14).
5. "**Protocolado não é aprovado**" no status e na mensagem de conclusão.

**Prioridade média:**

6. Rótulo da permissão "Executar fluxo no SINARM/CAC **(fora do app)**".
7. Nome/título do produto **sem "SINARM"**.
8. Corrigir o **README** (hoje afirma que não há código).
9. Faixa de ambiente (dev/staging) fora da área de conteúdo, some em produção.

**Prioridade baixa:**

10. CTA da landing levando a um caminho que não redireciona para login.
11. Guia de tom para mensagens ao usuário (suporte/operação).

---

## 17. O que precisa de revisão jurídica

- **Termos de uso** e **contrato**: objeto, obrigações, limites, responsabilidade
  por erro no preenchimento/protocolo.
- **Política de privacidade**: base legal, finalidade, retenção, compartilhamento,
  direitos do titular.
- **Política de reembolso** (docs/10 §15) — especialmente o "não reembolsável
  após protocolo".
- **Texto de consentimento** antes do Gov.br (docs/10 §16), incluindo a ciência
  de que, após autorizar, **o responsável pelo tratamento é o órgão**.
- **Frases de marketing**: o que pode e o que não pode prometer.
- Uso do termo **"SINARM"/"CAC"** na marca e na comunicação (risco de
  associação indevida).
- Se a atuação configura **representação** do usuário perante o órgão e o que
  isso exige (procuração, autorização formal).

---

## 18. Próximo passo após esta revisão

1. **Você decide** quais correções entram — este documento só propõe.
2. Aplicar primeiro as de **prioridade alta** (§16), que são as que travam o
   piloto do `docs/23`.
3. Levar o §17 a um advogado **antes** de escrever a versão final dos textos
   legais.
4. Reexecutar o **checklist §15** com as telas corrigidas.
5. Só então retomar o `docs/23` e fechar as 12 pendências do piloto.

> Nada aqui foi alterado no código: as telas continuam exatamente como estavam.

---

> **Lembrete permanente:** revisão de comunicação **não** libera produção nem
> piloto. As pendências do `docs/23 §5` continuam valendo integralmente.
