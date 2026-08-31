# supabase/

Backend de dados/identidade do Finora (PostgreSQL + Auth + RLS).

- `migrations/` — migrações de schema versionadas, aplicadas em ordem. Iniciadas em DB-001.
- `functions/` — edge functions e jobs agendados (fechamento de fatura, notificações, ciclo de billing) — API-003.
- `seed/` — seeds idempotentes (planos Free/Pro/Family, categorias padrão) — DB-006.

## Fluxo de execução (fonte de verdade versionada)

```
migration SQL  →  Supabase CLI  →  Postgres local  →  tests  →  staging  →  produção
```

Nunca alterar o banco pelo painel. Toda mudança de schema entra como migração versionada em `migrations/`.

Comandos (após provisionar o projeto e preencher `.env.local`):

```bash
# subir o Postgres local e aplicar as migrações
supabase start
supabase db reset          # aplica migrations/ do zero (idempotente)

# vincular ao projeto remoto e aplicar em staging/prod (CI)
supabase link --project-ref <ref>
supabase db push
```

## Provisionamento

O projeto Supabase é provisionado **após a Tarefa 1 (FOUNDATION)** e **antes de executar DB-001**. A conexão com o ambiente de desenvolvimento (URL + chaves) fica em variáveis de ambiente (`.env.local`), nunca no repositório. A migração `0001_extensions.sql` já está pronta e será aplicada assim que o projeto existir.

Convenções obrigatórias (ver design.md §Data Models):
- Dinheiro em `bigint` centavos (`_cents`), nunca float.
- RLS habilitado e `FORCE` em toda tabela com `household_id` (fail-closed).
- `timestamptz` (UTC) para timestamps.
