# 75 — Plano de Capacidade, Carga e Infraestrutura

> **O que é este documento.** Plano técnico — **arquitetura e documentação, não
> implementação** — para decidir, **por medição** e não por preferência, onde e
> como hospedar o sistema à medida que o volume cresce: usuários simultâneos,
> processos em fila, futuras automações Playwright e boa experiência para
> cliente e admin em hospedagens de terceiros (Vercel, Hostinger VPS/Cloud ou,
> no futuro, servidor dedicado).
>
> - ❌ **NÃO implementa** código de carga, fila, worker ou métrica.
> - ❌ **NÃO altera** `src`, Prisma, migration, `package.json` ou
>   `package-lock.json`.
> - ❌ **NÃO cria** Playwright real nem abre execução real de nada.
> - ❌ **NÃO toca a Fase 9** — `PHASE9_REAL_EXECUTION_ENABLED` segue
>   `false as const` (`src/server/automation/phase9/safety.ts:32`).
> - ❌ **NÃO escolhe fornecedor definitivo.** O critério é medição, custo,
>   estabilidade e facilidade de operação — nesta ordem de descoberta, não de
>   preferência prévia.
> - ❌ **NÃO instala** nenhuma ferramenta de teste de carga agora.
>
> **Data:** 2026-08-06
> **Base da `main`:** `3de3b5b` — *feat: add synthetic session contract types (#144)*
> **Referências:** [`docs/13`](13-stack-tecnica-mvp.md) (stack técnica —
> BullMQ/Redis e deploy §10/§14), [`docs/03-stack-automacao.md`](03-stack-automacao.md),
> [`docs/26`](26-arquitetura-automacao-hibrida.md) (arquitetura híbrida e gates),
> [`docs/36`](36-preparacao-infra-fase-9.md) (infra segura da Fase 9),
> [`docs/60`](60-decisao-estrategia-automated-first-e-ux-cliente.md) (SaaS
> automatizado-first), [`docs/71`](71-decisao-arquitetura-sessao-fase-2.md)–
> [`docs/74`](74-maquina-estados-automacao-sintetica-fase-2.md) (laboratório
> sintético da Fase 2), `src/server/automation/automationQueue.ts` (fila de
> **prontidão**, hoje — ver nota §4.1).

---

## 1. Onde hospedar no início

| Camada | Opção | Por que serve para essa camada |
|---|---|---|
| **App web** (Next.js, frontend + backend leve, request/response curto) | **Vercel** | Deploy trivial, edge/CDN, escala automática para tráfego de página; ruim para processos longos (§8) |
| **Worker / fila / Playwright / processos longos** | **Hostinger VPS/Cloud** | Processo Node de vida longa, sem limite de tempo de execução por request, CPU/memória dedicada e previsível para automação futura |
| **Servidor dedicado/físico** | **Só em fase futura**, quando houver volume real que justifique | Custo fixo mais alto só compensa com carga estável e previsível; decidir sem dado é apostar |

**Regra desta seção:** nenhum fornecedor é escolhido agora. A escolha entre
Vercel, Hostinger VPS/Cloud e, no futuro, servidor dedicado é **resultado**,
não ponto de partida, dos testes de carga (§5) e das métricas (§6), julgados
por quatro critérios:

| Critério | Pergunta que responde |
|---|---|
| **Medição por teste de carga** | Aguenta a concorrência alvo com a latência aceitável (§6/§7)? |
| **Custo** | Custo por processo/usuário/mês em cada camada, incluindo pico, não só média |
| **Estabilidade** | Taxa de erro e de timeout sob carga sustentada, não só em pico curto |
| **Facilidade de operação** | Quem opera (deploy, rollback, logs, alertas) com o time atual, sem depender de um único especialista |

> A separação web/worker do §2 já reduz a decisão: a pergunta não é "Vercel ou
> Hostinger", é "web em X" **e** "worker em Y" — podem ser dois provedores
> diferentes desde o início, como o `docs/13 §14` já apontava (web na Vercel
> **ou** tudo num provedor só). Este documento adiciona Hostinger VPS/Cloud
> como candidato concreto ao lado de Railway/Render, para ser comparado com
> dado, não substituído por suposição.

**Como comparar, na prática:** quando houver dúvida entre Vercel, Hostinger
VPS, servidor dedicado ou outro provedor, a decisão deve ser tomada **rodando
o mesmo roteiro de carga nos ambientes candidatos**, com os **mesmos
cenários** (§5.1), **mesma massa de teste**, **mesmos limites de
concorrência** (§3/§4) e **mesmas métricas** (§6) — nunca escolher por
preferência ou suposição. Comparar provedor A contra provedor B com testes
diferentes não produz decisão, produz dois números incomparáveis.

---

## 2. Separação entre web e automação

**Regra:** a aplicação web **nunca** executa automação pesada (Playwright,
OCR, geração de PDF grande) dentro do ciclo de requisição do usuário. Um
request que abre navegador, resolve captcha sintético ou processa documento
grande é um request que trava o event loop, estoura timeout de função
serverless (§8) e degrada a experiência de **todo mundo**, não só de quem
pediu.

**Fluxo correto:**

```
usuário cria processo
   │
   ▼
sistema responde rápido (poucos segundos, sem automação inline)
   │
   ▼
job entra na fila (§4)
   │
   ▼
worker processa em background (Hostinger VPS/Cloud, §1)
   │
   ▼
usuário/admin acompanha status (polling ou atualização de tela, não espera bloqueante)
```

**Onde o projeto já está, hoje:** a etapa de automação SINARM/CAC **não
existe como execução automática** — é humana e manual (`docs/22`, `docs/60`),
e a "fila" que existe hoje (`automationQueue.ts`) é um **classificador de
prontidão** (pronto/bloqueado por destino, PCE, documento, pagamento), não um
motor de jobs com worker, retry ou timeout. Isso significa que a separação
web/automação **ainda não foi violada**, porque a automação pesada ainda não
existe em produção — mas também significa que ela **precisa ser desenhada
antes** da primeira automação real entrar no caminho crítico de um request,
não depois. É esse desenho que as §3–§4 tratam.

### 2.1 Nota de nomenclatura

O termo "fila" já é usado no produto para **duas coisas diferentes**:

1. **Fila de prontidão** (`automationQueue.ts`, painel `/admin/automacao`) —
   classifica processos por o que falta para ficarem prontos. Já existe,
   síncrona, sem worker.
2. **Fila de jobs** (§4 deste documento) — ainda não existe. É a fila de
   execução em background com status/retry/timeout/prioridade.

Manter os dois nomes sem diferenciá-los na implementação futura vai confundir
quem lê o código. Recomenda-se, quando a fila de jobs for implementada, um
nome distinto (ex.: `automationJobQueue`/`jobQueue`) — decisão para o PR
técnico, não para este documento.

---

## 3. Capacidade e concorrência

Cada eixo de carga tem um teto **diferente** e não deve ser confundido com os
outros:

| Eixo | O que mede | Ordem de grandeza esperada vs. usuários |
|---|---|---|
| **Requisições web simultâneas** | Navegação, dashboard, login, formulários | ≈ proporcional a usuários ativos (alto) |
| **Processos criados** | Registros novos de `Process` | Fração pequena dos requests (só quem finaliza o fluxo) |
| **Jobs pendentes** | Itens na fila de jobs (§4) aguardando worker | Pode acumular sem quebrar nada, se o worker for lento — é *elástico* |
| **Automações Playwright simultâneas** | Navegadores abertos ao mesmo tempo no worker | **Concorrência controlada**, muito menor que usuários (§3.1) |
| **Uploads/documentos** | Envio de arquivo | Picos curtos, dependem de tamanho de arquivo, não de contagem de usuários |
| **OCR/PDF** | Processamento de documento | CPU-bound, deve rodar no worker, nunca no request de upload |
| **Painel admin** | Consultas agregadas (fila, financeiro, relatórios) | Poucos usuários (equipe interna), mas queries potencialmente pesadas |

### 3.1 500 usuários simultâneos ≠ 500 Playwright abertos

Este é o ponto central desta seção. **500 pessoas usando o site ao mesmo
tempo** significa 500 sessões de navegador do **usuário**, fazendo requests
leves (ver processo, enviar documento, checar status). Isso **não** significa
500 instâncias de **Playwright** abertas simultaneamente no worker — a
automação de um processo específico (ex.: preencher a Guia de Tráfego) dura
minutos, não é acionada por request, e **não precisa** de um Playwright por
usuário conectado.

**Modelo correto:** o site aceita as 500 criações/ações normalmente (é
tráfego web comum, servido pela camada da §1). As automações desses
processos entram na fila de jobs (§4) e são processadas com **concorrência
máxima configurável** — por exemplo, 5 ou 10 Playwright rodando ao mesmo
tempo no worker, processando a fila em ordem/prioridade, não 500 de uma vez.
O tempo para "esvaziar" a fila é `jobs pendentes ÷ throughput do worker`, e
esse número — não a contagem de usuários no site — é o que dimensiona o
worker.

---

## 4. Estratégia de fila (proposta futura)

**Ferramenta:** `docs/13 §10` já decidiu **BullMQ + Redis**. Este documento
não reabre essa decisão, mas registra que, dado o volume inicial esperado
(dezenas a centenas de processos, não milhares por segundo), uma **tabela de
jobs no próprio Postgres** (padrão *DB-backed queue*, sem Redis) é uma
alternativa mais simples de operar em uma VPS/Cloud com uma peça a menos —
**a decidir com dado de carga (§5), não aqui.** As duas opções compartilham o
mesmo modelo de campos abaixo.

| Campo | Propósito |
|---|---|
| **id / processId** | Qual processo o job pertence |
| **type** | Tipo de automação/job (ex.: `AUTOMATE_GUIA_TRAFEGO`, `PROCESS_UPLOAD_OCR`) |
| **status** | `PENDING` → `RUNNING` → `COMPLETED` \| `FAILED` \| `CANCELLED` \| `EXPIRED` (nomenclatura deve conversar com a máquina de estados sintética do `docs/74`, sem confundir as duas — aquela é do laboratório, esta é do job de infraestrutura) |
| **attempts / maxAttempts** | Tentativas feitas vs. permitidas |
| **timeout** | Tempo máximo antes de marcar falha (evita job travado para sempre) |
| **priority** | Ordem de processamento dentro da fila (ex.: pago antes de rascunho) |
| **maxConcurrency** (config do worker, não do job) | Quantos jobs do mesmo tipo rodam ao mesmo tempo (§3.1) |
| **error** | Motivo da falha, redigido (sem PII/segredo — mesma regra do `labRedaction`, `docs/37`) |
| **evidence** | Referência a artefato produzido (screenshot/log/relatório), nunca o artefato bruto na linha do job |
| **retryAt / backoff** | Quando tentar de novo, com espaçamento crescente |
| **cancelledAt / cancelledBy** | Cancelamento explícito, auditável (quem e quando) |

> **Todo campo acima é desenho, não schema.** Nenhuma tabela, migration ou
> tipo é criada por este documento — fica para o PR técnico que implementar a
> fila, quando decidido.

---

## 5. Testes de carga (planejamento futuro)

### 5.1 Cenários a cobrir

| # | Cenário | O que valida |
|---|---|---|
| 1 | Navegação / login / dashboard | Latência da camada web sob concorrência de usuários reais |
| 2 | Criação de processo | Caminho de escrita mais comum do cliente |
| 3 | Upload de documento | Impacto de payload grande no request e no storage |
| 4 | Consulta de status | Leitura repetida (polling do cliente) |
| 5 | Painel admin | Queries agregadas (fila, financeiro) sob uso concorrente da equipe |
| 6 | Criação massiva de jobs | Fila aguenta um pico de criação sem perder job nem travar o web |
| 7 | Worker com N jobs | Throughput e tempo médio por job, isolado do tráfego web |
| 8 | Playwright sintético em concorrência 1, 2, 5, 10, 20… | Onde a curva de CPU/memória por instância de navegador deixa de ser linear (§8) — **sempre contra o laboratório sintético/`localhost`, nunca contra portal real** (§10) |

### 5.2 Ferramentas a avaliar (nenhuma instalada agora)

| Ferramenta | Para que serve | Observação |
|---|---|---|
| **k6** | Carga HTTP programável (JS), boa para cenários 1–6 | Métricas de p50/p95/p99 nativas |
| **Artillery** | Carga HTTP declarativa (YAML/JS) | Curva de aprendizado menor que k6 para cenários simples |
| **autocannon** | Benchmark HTTP simples (Node) | Bom para checagem rápida local, menos recurso para cenário complexo |
| **Playwright** | **Fluxo E2E** (cenário 8) — validar que a automação funciona sob concorrência | **Não** é ferramenta principal de carga; não serve para gerar milhares de requests HTTP |
| **Logs/metrics do provedor** | Vercel Analytics, métricas da VPS (CPU/mem/rede) | Ponto de verdade para o que o servidor viu, não só o que o gerador de carga mediu |
| **Métricas do banco** | `pg_stat_activity`, conexões, tempo de query | Detecta gargalo de banco antes que vire timeout no request |

Escolha final (k6 vs. Artillery vs. autocannon) fica para quando o teste for
de fato construído — critério: cobertura de cenário + facilidade de rodar em
CI, não preferência isolada.

---

## 6. Métricas a medir

| Categoria | Métricas |
|---|---|
| **Latência web** | p50 / p95 / p99 de resposta por rota |
| **Erro** | Taxa de erro (%), por rota e agregada |
| **Fluxo do cliente** | Tempo para criar processo, tempo para carregar dashboard |
| **Admin** | Tempo para carregar painel admin, tempo de filtro na fila |
| **Fila/worker** | Jobs por minuto, tempo médio por job, tamanho da fila (pendentes), concorrência efetiva de workers |
| **Infra** | Uso de CPU/memória (web e worker, separados), conexões abertas no banco |
| **Falhas** | Falhas por timeout (web e job, separados) |
| **Experiência** | Percepção de "travou" mesmo sem erro técnico — tempo até primeiro feedback visual |

> Métrica sem contexto de fase não decide nada: p95 de 2s é ótimo no cenário
> 1 (navegação) e péssimo no cenário 4 (consulta de status que deveria ser
> quase instantânea). O critério de aceitação (§7) é o que dá sentido ao
> número.

**Nenhum número de capacidade é prometido aqui.** Este documento **não
promete** um número fixo de requisições por segundo, usuários simultâneos ou
processos por minuto **antes de benchmark real** — nenhum desses números
existe hoje, e escrever um agora seria suposição vestida de dado. Qualquer
número de capacidade deve sair de **teste medido** (§5), com **ambiente,
banco, fila, worker, storage e limites de concorrência documentados** junto
do resultado — um número sem esse contexto não é reproduzível e não serve
para decidir nada.

---

## 7. Critérios de aceitação futuros

- Usuário consegue **criar processo em poucos segundos**, mesmo com fila
  cheia por trás.
- **Dashboard continua responsivo** independentemente de quantos jobs estão
  rodando no worker.
- **Admin consegue filtrar a fila** (prontidão e, no futuro, jobs) sem
  travar a tela.
- **Job pesado não trava a web** — a separação do §2 é a garantia estrutural
  disso, o teste de carga é a **prova**.
- **Fila preserva ordem e status** sob concorrência — nenhum job "some" ou
  troca de posição sem motivo registrado.
- **Falha vira estado legível** para o cliente ("em revisão", "não foi
  possível processar agora, tentando de novo"), **nunca** erro técnico cru
  (stack trace, código HTTP, mensagem de biblioteca) — mesma diretriz já
  registrada no `docs/24` para UX/textos.

---

## 8. Riscos

| Risco | Por quê importa | Direção de mitigação (futura) |
|---|---|---|
| **Playwright consome CPU/memória** | Cada instância de navegador é pesada; concorrência mal calibrada derruba o worker | Concorrência máxima configurável (§4), medida empiricamente (cenário 8, §5.1) |
| **Serverless não é ideal para execução longa** | Vercel tem limite de duração de função; automação/worker não cabe nesse modelo | Worker fora da Vercel, em VPS/Cloud (§1/§2) |
| **Banco pode virar gargalo** | Conexões e queries pesadas (admin, relatórios) competem com o tráfego do cliente | Monitorar conexões (§6), pool dimensionado, queries agregadas isoladas se necessário |
| **Uploads podem pesar** | Arquivo grande no request trava o event loop e o storage | Upload direto para storage (URL assinada) em vez de proxy pela aplicação, quando decidido |
| **OCR pode pesar** | CPU-bound, não deve rodar no request | Sempre no worker, nunca inline (§2) |
| **Falta de fila trava a experiência** | Sem fila, automação futura teria que rodar inline — reintroduz o problema do §2 | A fila (§4) é pré-requisito antes de qualquer automação real entrar em produção |
| **Excesso de concorrência derruba o servidor** | Sem teto de concorrência, um pico de criação de processo vira um pico de Playwright | Concorrência máxima é configuração do worker, não decisão por request (§3.1) |
| **Falta de observabilidade impede diagnóstico** | Sem métrica (§6), um problema de capacidade só aparece como reclamação de usuário, tarde demais | Instrumentação simples é o primeiro passo do caminho recomendado (§9), antes de qualquer teste de carga real |

---

## 9. Caminho recomendado

| Fase | O que é | Depende de |
|---|---|---|
| **1. Agora** | **Só este plano** — nenhum código, nenhuma ferramenta instalada | — |
| **2. Depois** | Instrumentar **métricas simples** (latência por rota, erro, contagem de processo/job) — o mínimo para ter dado antes de otimizar | Confirmação explícita do usuário para começar código |
| **3. Depois** | Criar **modelo de job sintético** — jobs de teste que não fazem automação real, só simulam duração/CPU/falha, reaproveitando o vocabulário e as travas já desenhadas no laboratório sintético da Fase 2 (`docs/71`–`docs/74`), sem abrir execução real | Fase 2 |
| **4. Depois** | **Teste local de carga** — cenários da §5.1 rodando na máquina de desenvolvimento, ferramenta ainda a escolher (§5.2) | Fase 3 |
| **5. Depois** | **Teste em staging** — mesmo teste, ambiente mais próximo de produção, dados fictícios (regra permanente do `docs/00 §8`) | Fase 4 |
| **6. Depois** | **Ajustar infra** — a partir do que o teste revelar (concorrência máxima real, gargalo de banco, tamanho de worker) | Fase 5 |
| **7. Depois** | **Escolher Vercel / Hostinger / servidor dedicado com dados** — decisão final de fornecedor, pelos critérios do §1 | Fase 6 |

Nenhuma fase pula a anterior. Em particular, **fase 7 nunca acontece antes da
fase 6** — escolher fornecedor sem ter medido é exatamente o que este
documento evita.

---

## 10. Regras de segurança (reafirmadas)

- ❌ **Sem execução real** de Gov.br/SINARM/PF em nenhum teste de carga —
  os testes miram a aplicação e, quando envolverem automação (cenário 8,
  §5.1), miram **o laboratório sintético/`localhost`**, nunca o portal real.
- ❌ **Sem dados reais** em teste de carga — nem cliente real, nem CPF real,
  nem documento real. Regra permanente do `docs/00 §8`.
- ❌ **Sem CPF real** em nenhum gerador de carga, fixture ou payload de teste.
- ❌ **Sem senha, cookie ou `storageState`** em nenhum job sintético, real ou
  de teste de carga — mesma lista de campos proibidos do `docs/73 §4`.
- ❌ **Fase 9 continua `false`** —
  `PHASE9_REAL_EXECUTION_ENABLED = false as const`
  (`src/server/automation/phase9/safety.ts:32`); nada neste documento é gate
  nem aproximação de gate.
- ❌ **Playwright real só em ambiente permitido no futuro** — hoje o único
  Playwright existente mira o laboratório fake (`docs/27`–`docs/30`) e a
  infra segura da Fase 9 (`docs/36`), ambos bloqueados para execução real.
- ❌ **Testes de carga não devem atingir portais externos** — nem Gov.br/
  SINARM/PF, nem Mercado Pago produção, nem qualquer serviço de terceiro real;
  o `networkGuard` que já bloqueia Gov.br/SINARM/PF mesmo via allowlist
  (`phase9/networkGuard.ts:22`, `docs/74 §15.5`) continua sendo a trava de
  referência — qualquer motor de teste de carga futuro deve respeitar a
  mesma lista de hosts proibidos.

---

## 11. Proibições deste documento

Este documento **não**:

- ❌ altera código, `src`, `prisma`, `tests`, `package.json` ou
  `package-lock.json`;
- ❌ cria migration nem usa `db:push`;
- ❌ instala ferramenta de teste de carga (k6, Artillery, autocannon ou
  qualquer outra);
- ❌ cria Playwright novo ou abre execução real de Playwright existente;
- ❌ escolhe fornecedor de hospedagem definitivo (Vercel, Hostinger ou
  servidor dedicado);
- ❌ altera a Fase 9, `PHASE9_REAL_EXECUTION_ENABLED`, allowlist ou
  `networkGuard`;
- ❌ acessa Gov.br, SINARM, PF ou qualquer portal externo real;
- ❌ usa CPF, senha, OTP, cookie, `storageState` ou credencial reais.

---

> **Fecho.** Este documento define **onde hospedar** por critério de medição
> (não escolha antecipada), a **separação obrigatória** entre web e
> automação, a diferença entre os **eixos de capacidade** (o ponto central:
> 500 usuários não são 500 Playwright), o **desenho de uma fila de jobs**
> futura (campos, sem schema), os **cenários e ferramentas de teste de
> carga** a avaliar (nenhuma instalada), as **métricas** e os **critérios de
> aceitação**, os **riscos** já conhecidos da stack (`docs/13 §19`) lidos sob
> a ótica de capacidade, um **caminho de 7 fases** que não pula etapa, e a
> reafirmação de que **nada disso abre execução real, toca a Fase 9 ou
> aproxima um gate** dos já existentes (`docs/26 §19`, `docs/23 §5`). É
> **plano, não implementação** — o próximo passo depende de **confirmação
> explícita** do usuário, fase a fase, como todo o resto do projeto.
