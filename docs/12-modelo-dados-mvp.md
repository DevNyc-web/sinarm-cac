# 12 — Modelo de Dados do MVP (Guia de Tráfego)

> **O que é este documento.** Modela os **dados do MVP da Guia de Tráfego** —
> entidades, tabelas, campos, relacionamentos, estados e regras LGPD — como base
> para, **depois**, virar schema real.
>
> **Ainda NÃO é código.** Nada aqui é migration, schema Prisma, DDL ou dependência.
> Só especificação de dados.
>
> **Última atualização:** 2026-07-17
> **Base:** `docs/04-modelo-dados.md` (convenções), `docs/05-logs-auditoria-lgpd.md`,
> `docs/09-reconhecimento-sinarm-cac.md`, `docs/10-mvp-guia-de-trafego.md`,
> `docs/11-painel-admin-operacao.md`.
>
> **Convenções herdadas do doc 04:**
> - **PII sensível cifrada em repouso**; para busca/deduplicação, usar **hash
>   separado** (ex.: `cpf_hash`).
> - **Enums** guardados como **enum no código + coluna string** no banco.
> - **Bytes em storage** (por adapter), **metadados no banco**; integridade por
>   **sha256**.
> - **Nada ambíguo é autoclassificado**; exceção/dúvida → **revisão humana**.

---

## 1. Objetivo do modelo de dados

Representar, de ponta a ponta, **um processo de Guia de Tráfego** do CAC final:
quem é o usuário, o que ele enviou, o pagamento, a execução assistida no
SINARM/CAC, a **GRU**, o **protocolo**, a operação interna, o **suporte** e a
**auditoria/LGPD** — com **rastreabilidade** e **minimização de dados**.

Metas:
- Suportar os **fluxos** dos docs 10 e 11 (usuário, admin, SINARM).
- Tornar **auditável** cada ato sensível (especialmente "Gerar GRU e Salvar").
- Manter **PII protegida** e **retenção controlada** (LGPD).
- Ser **estável o bastante** para virar schema depois, sem decidir ORM agora.

---

## 2. Entidades principais

```
User 1───1 UserProfile
User 1───* Process
Process *───1 ProcessType
Process 1───* ProcessStatusEvent
Process 1───* ProcessDocument
Process 1───1 Destination
Process 1───* FirearmPce            (seleção de arma/PCE para a guia)
Process 1───* Payment              (Pix do cliente)
Process 1───1 GruRecord            (GRU gerada no SINARM)
Process 1───* GovSession           (login Gov.br/SINARM assistido)
Process 1───* SupportThread 1───* SupportMessage
Process 1───* Consent
Process 1───* AuditLog
AdminUser 1───* AdminAction ───* (Process | Payment | GruRecord | ...)
DataRetentionJob ───* (varre entidades p/ expurgo)
```

> Regra: **PII do usuário** concentra-se em `users`/`user_profiles`/
> `process_documents`; as demais tabelas referenciam por **id**, não duplicam PII.

---

## 3–5. Tabelas sugeridas, campos e relacionamentos

> Convenção: `id` = UUID (PK). `created_at`/`updated_at` em todas. FKs indicadas.
> `(cifrado)` = cifrado em repouso. `(enum→string)` = enum no código, string no banco.

### 3.1 `users`
Conta do usuário CAC final (autenticação do **nosso** app — não é o Gov.br).
```
id
email                 (login do app)
phone                 (cifrado, opcional)
cpf_hash              (hash p/ busca/dedupe — NÃO o CPF em claro)
status                (ATIVO | INATIVO | BLOQUEADO)          (enum→string)
created_at / updated_at
```
Rel.: `1───1 user_profiles`, `1───* processes`, `1───* consents`.

### 3.2 `user_profiles`
PII do usuário, separada da conta.
```
id
user_id               -> users
full_name             (cifrado)
cpf                   (cifrado)   -- espelhado por users.cpf_hash p/ busca
birth_date            (cifrado, opcional)
uf                    -- domicílio; útil p/ operação
city                  (opcional)
is_cac_confirmed      (bool)      -- declarou/possui CR/arma
govbr_photo_ok        (SIM | NAO | DESCONHECIDO)             (enum→string)
created_at / updated_at
```
Rel.: `*───1 users`.

### 3.3 `processes`
O coração do MVP: um pedido de Guia de Tráfego.
```
id
user_id               -> users
process_type_id       -> process_types
internal_status       (§6)                                   (enum→string)
user_facing_status    (§7)                                   (enum→string)
assigned_admin_id     -> admin_users (nullable)
service_name          -- "Emitir Guia de Tráfego Pessoa Física (CAC)"
activity_type         -- "Tiro Desportivo - Atirador Desportivo"
purpose               -- "TREINAMENTO TIRO DESPORTIVO"
pce_type              -- "ARMA DE FOGO"
justification         -- padrão "Guia para treino" (editável)
sigma_origin_address  (cifrado, opcional) -- Endereço SIGMA lido do acervo
guide_validity        (date, nullable)    -- validade LIDA do sistema (dinâmica)
protocol_number       (nullable)          -- surge após "Gerar GRU e Salvar"
price_charged_cents    -- preço ao cliente (embute GRU + serviço)
created_at / updated_at
```
Rel.: `*───1 users`, `*───1 process_types`, `1───* process_status_events`,
`1───* process_documents`, `1───1 destinations`, `1───* firearms_pce`,
`1───* payments`, `1───1 gru_records`, `1───* gov_sessions`,
`1───* support_threads`, `1───* consents`, `1───* audit_logs`.

### 3.4 `process_types`
Catálogo de processos (no MVP, só Guia de Tráfego).
```
id
code                  -- "GUIA_TRAFEGO_PF_CAC"
name                  -- rótulo amigável
base_fee_cents        -- taxa da GRU (2000 = R$ 20,00)
active                (bool)
created_at / updated_at
```
Rel.: `1───* processes`.

### 3.5 `process_status_events`
Histórico imutável de mudanças de status (trilha do processo).
```
id
process_id            -> processes
from_status           (nullable)                             (enum→string)
to_status                                                    (enum→string)
actor_type            (USER | ADMIN | SYSTEM)                (enum→string)
actor_id              (nullable) -- users.id ou admin_users.id
reason                (texto curto; SEM PII)
created_at
```
Rel.: `*───1 processes`. **Append-only** (não editar/apagar).

### 3.6 `process_documents`
Anexos do processo (no MVP: Documento de Identificação Pessoal).
```
id
process_id            -> processes
doc_type              (IDENTIFICACAO_PESSOAL | OUTRO)        (enum→string)
status                (§10)                                  (enum→string)
storage_key           -- bytes no storage, NÃO no banco
sha256                -- integridade
mime
size_bytes
rejection_reason      (nullable; SEM reproduzir PII do doc)
reviewed_by           -> admin_users (nullable)
created_at / updated_at
```
Rel.: `*───1 processes`.

### 3.7 `destinations`
Destino/clube/evento informado pelo usuário.
```
id
process_id            -> processes
event_name            -- Nome do Evento/Clube
uf
city
street                -- Logradouro
number                -- Número
extra                 (JSON, opcional) -- dados adicionais que aparecerem
is_validated          (bool)
created_at / updated_at
```
Rel.: `1───1 processes`.

### 3.8 `firearms_pce`
Arma/PCE selecionada do acervo para a guia (dados sensíveis).
```
id
process_id            -> processes
sigma_number          (cifrado)   -- Número SIGMA
pce_code              -- Código PCE
species               -- Espécie
brand                 -- Marca
model                 -- Modelo
caliber               -- Calibre
serial_number         (cifrado)   -- Nº de Série
lot_number            (cifrado, opcional) -- Nº de Lote
quantity              (int)
selection_confirmed_by -> admin_users (nullable) -- validação forte (§17)
created_at / updated_at
```
Rel.: `*───1 processes`.

### 3.9 `payments`
Pagamento **Pix do cliente** (usuário → empresa). NÃO é a GRU.
```
id
process_id            -> processes
method                (PIX)                                  (enum→string)
status                (§8)                                   (enum→string)
amount_cents
provider_ref          -- id da cobrança no provedor Pix
paid_at               (nullable)
proof_storage_key     (nullable) -- comprovante
created_at / updated_at
```
Rel.: `*───1 processes`.

### 3.10 `gru_records`
GRU gerada no SINARM (dados lidos da tela "Dados da GRU").
```
id
process_id            -> processes
status                (§9)                                   (enum→string)
contributor_name      (cifrado)   -- Nome do Contribuinte/Recolhedor
contributor_cpf       (cifrado)   -- CPF/CNPJ Contribuinte
ug_gestao             -- "167086/00001"
favored_unit          -- "Fundo do Exército"
recolhimento_code     -- "11300-0"
reference_number      -- Número de Referência
due_date              (date)      -- vencimento LIDO do sistema
amount_principal_cents -- 2000
amount_total_cents     -- 2000
instructions          -- textos observados
pdf_storage_key       (nullable)  -- PDF da GRU capturado
company_paid_at        (nullable) -- empresa pagou a GRU (manual)
company_proof_key      (nullable) -- comprovante do pagamento da GRU
created_at / updated_at
```
Rel.: `1───1 processes`.

### 3.11 `gov_sessions`
Registro do **login Gov.br/SINARM assistido** — o **fato**, nunca a senha.
```
id
process_id            -> processes
status                (§11)                                  (enum→string)
authorized_at         (nullable) -- usuário autorizou compartilhamento
expires_at            (nullable) -- ~60 min após início
double_auth_observed  (bool)     -- comportamento instável conhecido
ended_reason          (EXPIROU | CONCLUIDA | ERRO | null)    (enum→string)
created_at / updated_at
```
Rel.: `*───1 processes`. **Nunca** guardar CPF/senha Gov.br aqui.

### 3.12 `admin_users`
Usuários internos (equipe).
```
id
email
name
role                  (ADMIN | OPERADOR | FINANCEIRO | SUPORTE)   (enum→string)
active                (bool)
created_at / updated_at
```
Rel.: `1───* admin_actions`, referenciado por `processes.assigned_admin_id` etc.

### 3.13 `admin_actions`
Ações sensíveis da operação, atribuíveis (quem/quando/qual perfil).
```
id
admin_user_id         -> admin_users
role_at_time          (enum→string)  -- perfil no momento
action                (§12: ex. PIX_CONFIRMADO, CHECKLIST_ITEM,
                        GERAR_GRU_SALVAR, GRU_PAGA, REEMBOLSO, ...) (enum→string)
target_type           (PROCESS | PAYMENT | GRU | DOCUMENT | ...)   (enum→string)
target_id
detail                (JSON; SEM PII em claro)
created_at
```
Rel.: `*───1 admin_users`. **Append-only.**

### 3.14 `support_threads`
Conversa de suporte vinculada a um processo.
```
id
process_id            -> processes
status                (ABERTO | AGUARDANDO_USUARIO | RESOLVIDO)   (enum→string)
assigned_admin_id     -> admin_users (nullable)
created_at / updated_at
```
Rel.: `*───1 processes`, `1───* support_messages`.

### 3.15 `support_messages`
Mensagens dentro de um thread.
```
id
thread_id             -> support_threads
sender_type           (USER | ADMIN | SYSTEM)                (enum→string)
sender_id             (nullable)
body                  -- texto; evitar PII desnecessária
created_at
```
Rel.: `*───1 support_threads`.

### 3.16 `audit_logs`
Trilha de auditoria transversal (visão legível dos eventos — doc 11 §18).
```
id
process_id            -> processes (nullable p/ eventos globais)
actor_type            (USER | ADMIN | SYSTEM)                (enum→string)
actor_id              (nullable)
event                 (§12)                                  (enum→string)
detail                (JSON; SEM PII em claro)
ip                    (nullable; ver LGPD)
created_at
```
Rel.: `*───1 processes`. **Append-only, imutável.**

### 3.17 `consents`
Consentimentos coletados (antes de abrir o Gov.br — doc 10 §16).
```
id
process_id            -> processes
user_id               -> users
consent_type          (TRATAMENTO_DADOS | CIENCIA_PF_RESPONSAVEL |
                        POLITICA_REEMBOLSO | TERMOS_USO)            (enum→string)
text_version          -- versão do texto aceito
granted               (bool)
granted_at
created_at
```
Rel.: `*───1 processes`, `*───1 users`.

### 3.18 `data_retention_jobs`
Controle de expurgo/retenção LGPD (§15).
```
id
target_entity         -- ex. "process_documents", "gov_sessions"
policy_code           -- ex. "DOC_ID_90D", "SESSION_LOG_180D"
scheduled_for         (timestamp)
executed_at           (nullable)
status                (PENDENTE | EXECUTADO | FALHA)         (enum→string)
affected_count        (nullable)
created_at / updated_at
```
Rel.: transversal (varre entidades).

---

## 6. Status internos do processo (`processes.internal_status`)

Alinhado ao doc 11 §10:
```
RASCUNHO
AGUARDANDO_PAGAMENTO
PAGO_EM_FILA
AGUARDANDO_LOGIN_GOVBR
SESSAO_GOVBR_EXPIRADA
EM_PREENCHIMENTO_SINARM
EM_REVISAO_HUMANA
BLOQUEADO_INSTABILIDADE
EXCECAO_DOC_INVALIDO
EXCECAO_ARMA_DIVERGENTE
EXCECAO_DESTINO_INCOMPLETO
PROTOCOLADO_GRU_GERADA
GRU_PAGA_EMPRESA
CONCLUIDO
CANCELADO_REEMBOLSADO
```

## 7. Status visíveis para o usuário (`processes.user_facing_status`)

Alinhado ao doc 11 §11:
```
RECEBIDO
PAGAMENTO_CONFIRMADO
AGUARDANDO_SEU_LOGIN_GOVBR
EM_ANDAMENTO
AGUARDANDO_SISTEMA_PF
PRECISAMOS_DE_UM_AJUSTE
PROTOCOLADO
CONCLUIDO
CANCELADO
```

## 8. Estados do pagamento Pix (`payments.status`)
```
CRIADO            -- cobrança gerada
AGUARDANDO        -- aguardando pagamento
CONFIRMADO        -- Pix recebido
EXPIRADO          -- cobrança venceu
CANCELADO
REEMBOLSADO       -- conforme política (doc 10 §15)
```

## 9. Estados da GRU (`gru_records.status`)
```
NAO_GERADA        -- antes de "Gerar GRU e Salvar"
GERADA            -- protocolo criado + PDF disponível
PAGA_EMPRESA      -- empresa quitou a GRU (manual)
COMPENSADA        -- pagamento compensado (se observável no pós-protocolo)
CANCELADA
```

## 10. Estados dos documentos (`process_documents.status`)
```
PENDENTE          -- aguardando envio
ENVIADO           -- usuário anexou
EM_VALIDACAO
APROVADO
REPROVADO         -- rejection_reason preenchido (§14 doc 11)
```

## 11. Estados de sessão Gov.br/SINARM (`gov_sessions.status`)
```
NAO_INICIADA
AGUARDANDO_AUTORIZACAO   -- na janela oficial Gov.br
AUTORIZADA               -- compartilhamento concedido
ATIVA                    -- sessão SINARM válida (~60 min)
EXPIRADA
ENCERRADA
ERRO
```

---

## 12. Eventos de auditoria obrigatórios

Registrar em `audit_logs` (e ações da equipe em `admin_actions`), com quem/quando:

- `CONSENTIMENTO_REGISTRADO`
- `PIX_COBRANCA_CRIADA`, `PIX_CONFIRMADO`, `PIX_REEMBOLSADO`
- `GOVBR_AUTORIZACAO_REGISTRADA`, `GOVBR_DUPLA_AUTORIZACAO`, `SESSAO_EXPIRADA`
- `DOC_ENVIADO`, `DOC_APROVADO`, `DOC_REPROVADO`
- `ARMA_SELECIONADA`, `ARMA_DIVERGENTE`, `ARMA_CONFIRMADA`
- `DESTINO_VALIDADO`, `DESTINO_INCOMPLETO`
- `CHECKLIST_REVISAO_ITEM` (§6 doc 11), `CHECKLIST_GRU_ITEM` (§7 doc 11)
- `GERAR_GRU_SALVAR` ⚠️ **ato irreversível — destaque na auditoria**
- `PROTOCOLO_CAPTURADO`, `GRU_PDF_CAPTURADO`
- `GRU_PAGA_EMPRESA`
- `STATUS_ALTERADO` (espelha `process_status_events`)
- `MENSAGEM_ENVIADA`
- `EXCECAO_ABERTA`, `EXCECAO_RESOLVIDA`
- `DADOS_EXPURGADOS` (retenção — §15)

---

## 13. Dados pessoais e classificação LGPD

| Dado | Onde | Classificação | Tratamento |
|------|------|---------------|-----------|
| Nome completo | user_profiles, gru_records | PII comum | **cifrado** |
| CPF | user_profiles, gru_records | PII sensível/identificador | **cifrado** + `cpf_hash` p/ busca |
| Telefone | users | PII comum | **cifrado** |
| Documento de identificação (arquivo) | storage (process_documents) | PII sensível | **bytes cifrados no storage**, sha256, acesso mínimo |
| Nº SIGMA / Nº série da arma | firearms_pce | Dado sensível (segurança) | **cifrado**; nunca em log em claro |
| Endereço SIGMA (origem) | processes | PII comum | **cifrado** |
| Destino/evento | destinations | Dado comum | sem cifra (não é PII forte), mas minimizar |
| Autorização Gov.br | gov_sessions | Metadado de consentimento | **fato**, nunca senha |
| Senha Gov.br | — | **NUNCA armazenar** | inexistente no modelo (§18) |
| IP/logs | audit_logs | Dado pessoal (log) | retenção limitada; ver §15 |

> **Após a autorização no Gov.br**, o responsável pelo tratamento passa a ser a
> **PF** (doc 09 §4). Guardamos só o **fato** da autorização.

---

## 14. Estratégia de minimização de dados

- Coletar **apenas** o necessário para emitir a Guia de Tráfego.
- **Não duplicar PII** entre tabelas — referenciar por `id`.
- **Não persistir** dados de acervo além do que a guia exige.
- Logs guardam **evento + referência**, **não** o conteúdo sensível em claro.
- `reason`/`detail` de eventos: **texto sem PII**.
- Campos "extra" (JSON) só para o **estritamente observado**, nunca "por via das dúvidas".

---

## 15. Estratégia de retenção/exclusão

Base: `docs/05-logs-auditoria-lgpd.md`. Políticas por tipo (valores a definir):

| Dado | Retenção sugerida (a confirmar) | Observação |
|------|-------------------------------|------------|
| Documento de identificação (arquivo) | curto após conclusão (ex.: 30–90d) | apagar do storage; manter metadado/sha256 |
| Comprovantes Pix / GRU | prazo fiscal/contábil | manter enquanto exigido |
| PDF da GRU | enquanto útil ao usuário/auditoria | política própria |
| `gov_sessions` | curto (ex.: 180d) | é metadado, não credencial |
| `audit_logs` / `admin_actions` | longo (rastreabilidade) | **imutável**; expurgo só por política |
| PII de usuário inativo | conforme solicitação/lei | direito de exclusão |

- Expurgo orquestrado por **`data_retention_jobs`** (agendado + auditado).
- Exclusão de arquivo no storage **preserva** o metadado mínimo p/ auditoria
  (sem reconstituir a PII).

---

## 16. Índices importantes

- `users`: único em `email`; índice em `cpf_hash`.
- `processes`: índices em `user_id`, `internal_status`, `user_facing_status`,
  `assigned_admin_id`, `process_type_id`, `created_at`.
- `process_status_events`: índice em `process_id`, `created_at`.
- `process_documents`: índice em `process_id`, `status`.
- `payments`: índice em `process_id`, `status`; único em `provider_ref`.
- `gru_records`: único em `process_id`; índice em `status`, `protocol`/`reference_number`.
- `gov_sessions`: índice em `process_id`, `status`, `expires_at`.
- `admin_actions` / `audit_logs`: índices em `created_at`, `event`/`action`,
  `target_type`+`target_id` / `process_id`.
- `consents`: índice em `process_id`, `user_id`, `consent_type`.
- `data_retention_jobs`: índice em `status`, `scheduled_for`.

---

## 17. Regras de integridade

- Todo `process` referencia **um** `process_type` válido (no MVP, Guia de Tráfego).
- `gru_records` é **1:1** com `process` (uma GRU por processo no MVP).
- `protocol_number` só é preenchido **após** `GERAR_GRU_SALVAR` (evento auditado).
- `process_status_events` e `audit_logs`/`admin_actions` são **append-only**.
- `payments.status = CONFIRMADO` é **pré-condição** para sair de `PAGO_EM_FILA`
  rumo à execução (regra de negócio, validada na aplicação).
- Não avançar para protocolo sem: documento `APROVADO`, arma `CONFIRMADA`,
  destino `validado`, consentimentos concedidos (regra de aplicação; refletir em
  checklist — doc 11 §6/§7).
- Exclusão de `user` deve tratar processos vinculados (bloquear ou anonimizar
  conforme retenção — não deletar auditoria).
- `cpf` (cifrado) e `cpf_hash` devem ser **consistentes** entre `users`/`user_profiles`.

---

## 18. O que NÃO armazenar

- ❌ **Senha Gov.br** (nunca — o usuário digita na janela oficial).
- ❌ **PDF/arquivo como blob** no banco (bytes vão para o storage).
- ❌ **PII em claro em logs** (`reason`, `detail`, `body`).
- ❌ **Nº de série / SIGMA em claro** fora do campo cifrado.
- ❌ **Screenshots/prints com PII** versionados.
- ❌ Dados de acervo **não usados** pela guia.
- ❌ Tokens/credenciais do SSO Gov.br.

---

## 19. Campos que devem ser criptografados ou protegidos

**Cifrados em repouso:**
`user_profiles.full_name`, `user_profiles.cpf`, `users.phone`,
`user_profiles.birth_date`, `gru_records.contributor_name`,
`gru_records.contributor_cpf`, `firearms_pce.sigma_number`,
`firearms_pce.serial_number`, `firearms_pce.lot_number`,
`processes.sigma_origin_address`.

**Protegidos por acesso mínimo + storage seguro:**
`process_documents` (arquivo), `payments.proof_storage_key`,
`gru_records.pdf_storage_key`, `gru_records.company_proof_key`.

**Hash (não reversível) para busca:**
`users.cpf_hash`.

**Integridade (sha256):** todo arquivo em storage (documento, comprovantes, PDF GRU).

---

## 20. Dúvidas em aberto antes de virar schema real

1. **Pós-protocolo** (doc 09 §15.14): formato exato do **protocolo**, campos do
   **PDF da GRU**, e como aparece **compensação/pagamento** → afeta `gru_records`.
2. **Certidões:** confirmadas como **fora do MVP** (doc 10 §17); se entrarem,
   precisará de entidade própria (reaproveitar doc 04) — não modelar agora.
3. **Múltiplas armas por guia:** modelado como `1───*` (`firearms_pce`); confirmar
   se a Guia de Tráfego aceita **mais de uma arma** por processo.
4. **Retenção:** prazos concretos por tipo (§15) dependem de decisão jurídica/LGPD.
5. **Cadastro inicial PF** (fallback — doc 10 §3): se virar fluxo, pode exigir
   tabela/campos próprios (latitude/longitude etc. — doc 09 §8).
6. **Multi-perfil interno:** um `admin_user` com vários papéis — manter `role`
   único ou tabela de papéis? (afeta `admin_users`/`admin_actions`).
7. **Reembolso parcial** (doc 10 §15 "depende do estágio"): modelar valor/estágio
   do reembolso em `payments`?
8. **Provedor Pix:** campos exatos de `provider_ref`/webhook dependem do provedor
   escolhido (doc 08).
9. **Chave de cifra / KMS:** estratégia de gestão de chaves (fora deste doc).
10. **Idempotência** de eventos (webhooks Pix, retomadas) — definir chave natural.

---

> **Lembrete permanente:** nada neste documento autoriza implementar código, criar
> migrations, schema Prisma, instalar dependências ou automatizar Gov.br/SINARM.
> É modelagem. Próximas ações dependem de **confirmação explícita** do usuário.
