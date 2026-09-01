# Finora — Estrutura do Monorepo

Este repositório está evoluindo de um app V0 (React + Vite + LocalStorage) para uma plataforma SaaS multi-plataforma, conforme a spec em `.kiro/specs/finora-saas/`.

## Layout alvo

```
apps/
  web/            # Aplicação Web/PWA (React + Vite) — hoje o V0 vive na raiz e migra para cá em WEB-001+
  mobile/         # App Android (React Native) — fase V1.5
packages/
  core/           # Financial Core: TypeScript PURO, sem I/O. Fonte única das regras financeiras.
  types/          # Tipos de domínio compartilhados
  validation/     # Schemas de validação compartilhados (ex.: zod)
  api-client/     # Cliente da API REST /v1 (compartilhado Web/Mobile)
  ui/             # Componentes de UI compartilhados
  config/         # Config compartilhada (tsconfig base, lint, etc.)
supabase/
  migrations/     # Migrações de schema versionadas (DB-001+)
  functions/      # Edge functions / jobs
  seed/           # Seeds (planos, categorias padrão)
docs/             # Documentação de arquitetura e snapshots de design versionados
```

## Regra do Financial Core (fitness function)

`packages/core` é **TypeScript puro** e NÃO pode importar:

- ❌ React / React DOM
- ❌ Vite / bundler APIs
- ❌ Supabase SDK
- ❌ Stripe SDK
- ❌ `fetch` / clientes HTTP
- ❌ `localStorage` / `window` / DOM / browser APIs
- ❌ clientes de banco de dados

Toda I/O é injetada pelas camadas superiores. Isso garante que o mesmo domínio rode em Web, backend e Android. A regra é verificada por lint (ver `packages/core/README.md`).

## Migração incremental (V0 preservado)

O app V0 na raiz (`src/`) permanece funcional durante toda a Fase 1. Os pacotes são criados e populados incrementalmente. O LocalStorage só é removido após DATA-001 (migração de dados) validada — ver tarefas WEB-002, DATA-001, WEB-004H.

## Estado atual (Tarefa 1 — FOUNDATION)

- Estrutura de diretórios e boundaries criados.
- `packages/core` iniciado com as regras de cálculo puras (semente do Financial Core), espelhando `src/lib/calc.ts` sem alterar o V0.
- Provisionamento do Supabase acontece **após** a Tarefa 1, antes de DB-001.
