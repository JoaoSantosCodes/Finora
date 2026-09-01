# Finora — Projeto

Plataforma de controle financeiro pessoal e familiar, evoluindo de um app V0 (React + Vite + LocalStorage) para um **SaaS multi-plataforma** (Web/PWA + Android futuro), com autenticação, grupos familiares (households), contas, transações, cartões, faturas, parcelamentos, orçamentos, metas, análises e planos (Free/Pro/Family).

- **App em produção (V0):** https://finora.joaocarlosrh23.workers.dev
- **Repositório:** JoaoSantosCodes/Finora
- **Hospedagem:** Cloudflare Workers (Web) · Supabase/PostgreSQL (backend — em provisionamento)

## Os quatro contratos

O projeto é guiado por quatro documentos que funcionam como contratos. Nenhum código de produto foge deles.

| Contrato | Documento | Papel |
|---|---|---|
| Produto | [`.kiro/specs/finora-saas/requirements.md`](.kiro/specs/finora-saas/requirements.md) | O que o Finora faz — requisitos EARS, papéis, planos, regras de negócio |
| Técnico | [`.kiro/specs/finora-saas/design.md`](.kiro/specs/finora-saas/design.md) | Como é construído — arquitetura, domínio, banco, RLS, API, billing |
| Execução | [`.kiro/specs/finora-saas/tasks.md`](.kiro/specs/finora-saas/tasks.md) | Ordem de implementação — tarefas com dependências e waves |
| Visual | [`docs/ux/UX-DESIGN.md`](docs/ux/UX-DESIGN.md) | Como se parece — layout, hierarquia, cores, componentes |

Documentação de apoio: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (estrutura do monorepo), [`supabase/README.md`](supabase/README.md) (fluxo de banco).

## Estrutura do repositório

```
apps/            aplicações finais (web/, mobile/) — V0 ainda vive na raiz (src/)
packages/        core/ (Financial Core puro), types/, validation/, api-client/, ui/, config/
supabase/        migrations/ (versionadas), functions/, seed/, config.toml
src/             app V0 atual (React + Vite) — funcional até a migração das telas
docs/            architecture/ (design) + ux/ (contrato visual)
.kiro/specs/     requirements.md · design.md · tasks.md
```

## Princípios que guiam o projeto

1. **Financial Core independente de UI** — regras financeiras em `packages/core`, TypeScript puro, sem React/DOM/HTTP/DB. Reusável por Web e Android.
2. **RLS como segurança real** — isolamento por `household_id` no PostgreSQL, fail-closed (RLS mal configurado nega tudo).
3. **Billing é domínio separado** — assinaturas SaaS não se misturam com transações financeiras.
4. **Backend é a fonte de verdade** — LocalStorage vira cache/offline com sync idempotente.
5. **Dinheiro em centavos** — `bigint`, nunca float.
6. **Migração incremental** — o V0 permanece funcional; nada é removido antes do substituto validado (DATA-001 antes de aposentar o LocalStorage).
7. **Cor nunca é o único indicador** — acessibilidade por padrão.

## Roadmap por fases

- **V1.0 (MVP):** Auth · Contas · Transações · Categorias · Pago/Pendente · Cartões/Faturas/Parcelamento · Dashboard · Metas · Billing Free/Pro
- **V1.1:** Recorrências · **V1.2:** Orçamentos · **V1.3:** Family · **V1.4:** Import/Export · **V1.5:** Android · **V2:** Finora Intelligence (IA)

## Como rodar (V0)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de produção
npm run test:db    # valida migrações (PGlite, sem Docker)
```
