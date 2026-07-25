# 37 — Fase 8D: Log Seguro e Relatório de Execução do Laboratório

> **O que é este documento.** Registra a **Fase 8D** — a redação/sanitização
> segura e o **relatório estruturado de execução** do **laboratório sintético**
> criado nas Fases 8A/8B/8C.
>
> **Não amplia o laboratório e não libera nada.** A Fase 8D **não** cria um novo
> lab, **não** cria automação real, **não** toca Gov.br/SINARM, **não** usa
> credencial, **não** usa documento real, **não** faz upload/pagamento/protocolo
> real, **não** altera Prisma/schema/migration/seed e **não** altera nenhum
> processo real da cadeia CAC.
>
> **Data:** 2026-07-25
> **Base:** `docs/27` (8A — página fake), `docs/28` (8B — Playwright),
> `docs/29` (validação da Fase 8), `docs/30` (8C — exceções sintéticas),
> `docs/26 §19` (gates), `docs/00 §8` (regra de log sem PII).

---

## 1. Por que a Fase 8D existe

A validação da Fase 8 (`docs/29`) deixou o laboratório provando **navegação**,
**preenchimento**, **falha segura**, **retry explícito** e **prova negativa de
rede**. Faltavam **duas** garantias que existiam apenas como **promessa em
comentário**, não como teste que falha:

1. **Log seguro.** `src/lib/logger.ts` traz o comentário *"NUNCA registrar PII em
   claro"* — mas **nenhuma redação estava implementada**. A regra era intenção,
   não mecanismo.
2. **Relatório de execução.** Existia o relatório HTML do Playwright
   (`playwright-report/`, gitignored), mas **nenhum relatório estruturado** do
   próprio laboratório: cenário, passos, duração, artefatos, política de rede.

Havia ainda uma terceira lacuna silenciosa: *"nunca salvar senha/token/cookie/
OTP"* era verdade **por ausência** (o lab não coleta credencial), e ausência não
é garantia. A Fase 8D transforma as três em **código testado**.

---

## 2. Escopo

- **Alvo:** o laboratório sintético que **já existe** — `/admin/lab/guia-trafego`.
- **Entrega:** dois módulos **puros** + testes unitários + emissão de relatório
  no e2e já existente.
- **Fora de escopo:** automação real, Gov.br/SINARM, credenciais, documentos
  reais, upload real, fila/gate/readiness real, banco, Prisma, migration, seed,
  qualquer processo da cadeia CAC, e o **PR #1 (Fase 9)**.

---

## 3. O que foi criado

| Arquivo | Papel |
|---------|-------|
| `src/server/automation/lab/labRedaction.ts` | Redação/sanitização pura |
| `src/server/automation/lab/labRunReport.ts` | Montagem do relatório estruturado |
| `tests/unit/automation/labRedaction.test.ts` | 17 testes |
| `tests/unit/automation/labRunReport.test.ts` | 14 testes |
| `docs/37-fase-8d-log-seguro-e-relatorio.md` | Este documento |

Modificados, com diff mínimo:

| Arquivo | Mudança |
|---------|---------|
| `tests/e2e/lab-guia-trafego.spec.ts` | Emite o relatório e prova que ele não vaza; **nenhum teste existente removido ou alterado na lógica** |
| `package.json` | Registro dos dois arquivos de teste em `test:documents:unit` |

**Não foi necessário alterar** `playwright.config.ts` nem o `.gitignore` — a
regra `tests/e2e/artifacts/*` (com exceção do `.gitkeep`) já cobria o relatório.

---

## 4. `labRedaction` — o que ela garante

**Chave de segredo → o valor nunca é visitado.** Chaves como `senha`,
`password`, `pass`, `token`, `cookie`, `otp`, `authorization`, `secret`,
`credential`, `credencial` (e variações como `x-auth-token`, `govbrPassword`,
`setCookie`, `apiKey`, `sessionId`) são substituídas por `[REDACTED]`.

Duas decisões deliberadas:

- **Um contêiner com nome de segredo derruba a subárvore inteira.** `credentials:
  { senha, usuario }` vira `credentials: "[REDACTED]"` — o `usuario` também
  desaparece. É mais estrito do que mascarar folha a folha, e é o comportamento
  correto: o nome do contêiner já declara o conteúdo.
- **`passo`/`passos` não são confundidos com `pass`.** Termos curtos e ambíguos
  (`pass`, `otp`, `auth`) só batem como **token inteiro** da chave; termos
  inequívocos (`password`, `token`, `cookie`…) batem por substring.

**Valor sensível → mascarado.** CPF (com e sem pontuação), RG, e-mail, telefone
BR e sequências longas de dígitos. Erros são reduzidos a `{ name, message }` com
a mensagem mascarada — **o stack é descartado**, porque caminho de arquivo e
argv podem carregar segredo.

**Dois modos.** `"full"` (padrão) aplica identificadores **e** heurísticas;
`"identifiers"` aplica só os de alta confiança (e-mail/CPF/RG). O modo restrito
existe por um motivo concreto encontrado durante a implementação: o timestamp de
13 dígitos no nome do screenshot (`lab-final-1784987585333.png`) casava com o
padrão de telefone e o caminho do artefato virava `lab-final-17[TELEFONE].png` —
seguro, porém **inútil**, já que não localizava mais o arquivo. Em nome de
arquivo a contenção estrutural (§5) já limita o risco, então mascara-se só o que
é inequivocamente PII.

A função também devolve **contagem** (`redactedKeys`, `maskedValues`, `total`),
para que o relatório declare quanto foi redigido. A contagem cobre `scenario`,
nomes de passo, `meta`, `warnings` e `errors` — um relatório que redigiu algo
não pode exibir resumo zerado.

---

## 5. `labRunReport` — o que ele garante

Função **pura e determinística**: sem `Date.now()`, sem `Math.random()`, sem
leitura de ambiente, sem I/O. O mesmo input produz sempre o mesmo relatório —
existe teste estático que barra a reintrodução dessas chamadas.

O relatório contém `scenario`, `status`, `startedAt`, `finishedAt`, `durationMs`,
`steps`, `artifacts`, `syntheticProtocol`, `networkPolicy`, `redactionSummary`,
`warnings` e `errors` sanitizados. Sobre as garantias:

- **Auto-declaração.** Todo relatório carrega `kind: "LAB_SINTETICO"`,
  `synthetic: true` e um `disclaimer` explícito. Nenhum consumidor pode confundir
  com execução real.
- **Falha nunca produz protocolo.** A porta é **allow-list**: só `SUCESSO`
  admite protocolo. Qualquer outro valor — inclusive um status novo que venha a
  ser adicionado, ou um chamador JavaScript sem tipos — cai em `null` e registra
  o descarte em `warnings`. Listar os status de falha deixaria a porta aberta por
  omissão.
- **Só protocolo sintético.** Mesmo no sucesso, só o prefixo `PROT-FICT-` é
  aceito. Um número fora do padrão é recusado — o relatório **não inventa** e não
  aceita número real.
- **Artefato só dentro do lab.** Caminho precisa ser relativo e começar em
  `tests/e2e/artifacts/`. Absoluto, unidade do Windows, `..`, esquema de URL ou
  qualquer coisa fora da raiz vira `[ARTEFATO_FORA_DO_LAB]`. Não há
  `storageKey`, `originalFileName` nem hash real.
- **Rede sempre local.** `externalAccessAllowed` é `false` no tipo de saída;
  pedir `true` no input é recusado e vira aviso. URLs de `offenders` têm a query
  string removida antes de entrar, porque token viaja em query.

---

## 6. O que o e2e passou a provar

O spec existente (`tests/e2e/lab-guia-trafego.spec.ts`) manteve seus **10 testes
originais intactos** e ganhou:

- emissão do relatório no **caminho feliz** (com protocolo sintético e artefato);
- emissão do relatório na **falha da GRU** — provando que `syntheticProtocol` é
  `null` e que `PROT-FICT-0001` não aparece nem quando a execução insiste em
  passá-lo;
- um teste novo de **envenenamento deliberado**: um passo com `senha`, `token`,
  `cookie`, `otp`, `authorization`, CPF e e-mail fictícios no `meta`, provando
  que nada disso sobrevive à serialização.

Sobre a checagem de segredo no relatório serializado: uma **chave** redigida pode
nomear o segredo (`"token": "[REDACTED]"`) — isso é **auditoria, não vazamento**.
Por isso a asserção remove os pares já redigidos e exige que o **resto** do
documento esteja limpo. O termo não pode aparecer em nenhum outro lugar.

A prova negativa de escopo também foi ajustada para ser sobre **URL**, não sobre
palavra: o disclaimer cita "Gov.br" e "SINARM" **de propósito**, para declarar
que não os acessa. O teste verifica que toda URL citada no relatório é local.

---

## 7. Relação com o PR #1 (Fase 9) — intocado e separado

O PR #1 (`feat/phase-9-controlled-proof`) **não foi tocado, não foi mergeado e
não teve código copiado**. A implementação da Fase 8D é **própria e
independente**: há teste estático nos dois módulos barrando qualquer import de
`phase9`.

Isso é deliberado, e não formalidade:

- PR #1 é infra de **Fase 9** — fora do laboratório, com `PHASE9_REAL_EXECUTION_ENABLED`
  fixo em `false` e o gate `docs/34 §16` pendente. Misturar as duas coisas
  embaralharia gates distintos.
- Puxar código de uma branch não mergeada acoplaria a `main` a algo que pode
  nunca entrar.
- **Colisão de numeração evitada:** PR #1 cria `docs/36-preparacao-infra-fase-9.md`.
  Por isso esta fase usa **`docs/37`**.
- **Direção da futura convergência:** se um dia as duas redações forem unificadas,
  o PR #1 é que deve passar a importar da `main` — nunca o contrário.

---

## 8. Riscos mitigados

| Risco | Mitigação |
|-------|-----------|
| Segredo em log/relatório | Chave de segredo removida, valor nunca visitado; teste com envenenamento deliberado |
| PII em claro (CPF/RG/e-mail/telefone) | Mascaramento por padrão, com testes por tipo |
| Stack trace vazando caminho/argv | Erro reduzido a `{ name, message }` |
| Relatório confundido com execução real | `kind`/`synthetic`/`disclaimer` obrigatórios |
| Protocolo fantasma após falha | Descarte por status + teste em todos os status de não-sucesso |
| Número de protocolo real | Só o prefixo `PROT-FICT-` é aceito |
| Artefato apontando para documento real | Contenção estrutural em `tests/e2e/artifacts/` |
| Token em query string de URL | Query removida antes de registrar `offenders` |
| Relatório versionado por engano | `.gitignore` já cobria; verificado com `git check-ignore` |
| Módulo deixar de ser puro/determinístico | Testes estáticos contra Prisma, `fetch`, URL, `fs`, navegador, `Date.now`, `Math.random` |

---

## 9. Limites conhecidos da Fase 8D

Encontrados em revisão, por sondagem adversarial. Nenhum é vazamento de segredo;
todos falham na direção segura (perda de dado, não exposição). Ficam registrados
como limite consciente desta fase — **não** são resolvidos aqui.

1. **Texto livre sob chave inocente.** A redação é por **chave**; um segredo
   escrito em linguagem natural dentro de um valor comum (por exemplo, uma nota
   livre que mencione a senha no meio da frase) pode não ser capturado. O e2e tem
   um *backstop*: verifica marcadores sensíveis no relatório final e falha se
   algum aparecer fora de um par já redigido. Para fase real/produção isso não
   basta — exigirá política mais forte na origem do dado.

2. **CPF com espaços.** Os formatos usuais (com pontuação e sem pontuação) são
   mascarados; separadores incomuns como `123 456 789 09` não. O escopo atual
   cobre os formatos usuais e os hostis usados nos testes.

3. **Colisão de chave após máscara.** Se duas chaves diferentes forem mascaradas
   para a mesma forma, a última sobrescreve a primeira. É **perda segura**, não
   vazamento.

4. **`Map`/`Set`.** Não são percorridos: viram objeto vazio. É **perda segura** —
   o laboratório não persiste dado real, então nada de valor se perde aqui.

---

## 10. O que continua NÃO liberado

A Fase 8D **não move nenhum gate** do `docs/26 §19`. Continuam bloqueados:

- ❌ Automação real, em qualquer processo.
- ❌ Gov.br, SINARM, qualquer serviço oficial ou site público real.
- ❌ Credenciais reais, sessão real, persistência de cookie/token.
- ❌ Dados e documentos reais; upload real; pagamento real; protocolo real.
- ❌ Cadastro Inicial, CR, Autorização de Compra e CRAF — seguem **bloqueados**;
  a Guia de Tráfego segue o **único** fluxo real/criável.
- ❌ Fase 9 e sua prova técnica controlada (gate `docs/34 §16` pendente).
- ❌ Bypass de captcha, ocultação de validação do usuário, evasão de detecção.

O laboratório continua sendo **página fake em `localhost`, com dados fictícios**.

---

## 11. Verificações executadas

| Comando | Resultado |
|---------|-----------|
| `npm run test:documents:unit` | **297 testes, 0 falhas** |
| `npm run typecheck` | limpo |
| `npm run lint` | sem warnings/erros |
| `npm run build` | build de produção concluído |
| `npm run test:e2e` | **11 testes, 11 passaram** |

Não foram executados `db:push` nem `seed`.

---

## 12. Conclusão

O laboratório sintético agora **prova**, e não apenas promete, que registra sem
vazar: segredo não sobrevive, PII é mascarada, falha não gera protocolo e todo
relatório se declara sintético. O próximo passo continua sendo **decisão do
dono** — a Fase 8D não pede nem autoriza avanço para a Fase 9.

> **Lembrete permanente:** Fase 8D é **laboratório sintético em `localhost`**.
> Não autoriza automação real, não toca Gov.br/SINARM, não usa dados reais. Cada
> avanço depende de **confirmação explícita** do dono e dos **gates do
> `docs/26 §19`**.
