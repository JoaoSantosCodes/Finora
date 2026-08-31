# supabase/

Backend de dados/identidade do Finora (PostgreSQL + Auth + RLS).

- `migrations/` — migrações de schema versionadas, aplicadas em ordem. Iniciadas em DB-001.
- `functions/` — edge functions e jobs agendados (fechamento de fatura, notificações, ciclo de billing) — API-003.
- `seed/` — seeds idempotentes (planos Free/Pro/Family, categorias padrão) — DB-006.

## Provisionamento

O projeto Supabase é provisionado **após a Tarefa 1 (FOUNDATION)** e **antes de DB-001**. A conexão com o ambiente de desenvolvimento (URL + chaves) fica em variáveis de ambiente, nunca no repositório.

Convenções obrigatórias (ver design.md §Data Models):
- Dinheiro em `bigint` centavos (`_cents`), nunca float.
- RLS habilitado e `FORCE` em toda tabela com `household_id` (fail-closed).
- `timestamptz` (UTC) para timestamps.
