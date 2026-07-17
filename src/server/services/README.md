# server/services

Camada de **casos de uso** (use-cases) do domínio.

Vazia na **Fase 1** (esqueleto). Os primeiros serviços chegam a partir da
**Fase 3** (cadastro do processo Guia de Tráfego), sempre validando entrada com
Zod e usando os repositórios (`server/repositories`) para acesso a dados.

> Nada aqui deve conter PII em claro, segredos ou lógica de Pix/automação na
> Fase 1 (ver `docs/16-fase-1-esqueleto-tecnico.md`).
