# Finora — Status do Projeto

Acompanhamento do progresso. A fonte de verdade das tarefas é [`.kiro/specs/finora-saas/tasks.md`](../.kiro/specs/finora-saas/tasks.md); este arquivo é um resumo navegável.

_Atualizado após o UX Design e o redesign do V0._

## Fase da especificação (concluída)

| Etapa | Status | Artefato |
|---|---|---|
| Product Specification v1.0 | ✅ | requirements.md |
| Requirements Analysis (28 pontos) | ✅ | requirements.md |
| Tech Design v1.0 | ✅ | design.md |
| Architecture Review | ✅ | design.md |
| Task List v1.0 | ✅ | tasks.md |
| UX Design v1.0 | ✅ | docs/ux/UX-DESIGN.md |

## Implementação — Wave 1 (Fundação) rumo ao GATE 1

| Tarefa | Status | Nota |
|---|---|---|
| 1. FOUNDATION | ✅ | Monorepo, boundaries, Financial Core puro (`packages/core`) |
| 2. DB-001 Extensions | ✅ | Migração `0001_extensions.sql` validada via PGlite (idempotente, pgcrypto, 10 enums, trigger) |
| 3. DB-002 Identity | ✅ | `profiles` validado via PGlite (email único case-insensitive, trigger, FK condicional com aviso) |
| 4. DB-003 Household | ⏳ próximo | households, members, invitations |
| 5. DB-004 RLS Foundation | ⏳ | fail-closed + `is_household_member` |
| 31. GATE 1 verify-prod | ⏳ | `verify-prod.mjs` verde contra o Supabase real (FK/RLS) — obrigatório para fechar o gate |
| **GATE 1** | 🔒 | Libera após DB-003, DB-004 e verify-prod verde no banco real |

## Trabalho paralelo (V0 sempre funcional)

| Item | Status | Commit |
|---|---|---|
| Redesign V0 (Financial OS) | ✅ | `da50edb` |
| UX Design documentado | ✅ | `5432578` |

## Pendências e bloqueios

- ⚠️ **Segurança:** a secret key do Supabase foi exposta em chat e precisa ser **rotacionada** antes de conectar o projeto.
- ⏳ **Provisionar Supabase** e configurar `.env.local` (sem commitar) para aplicar migrações no ambiente real. Até lá, as migrações são validadas localmente via PGlite.

## Próximos passos sugeridos

1. Rotacionar a secret key do Supabase.
2. DB-003 (Household) — escrever e validar `0003_household.sql`.
3. DB-004 (RLS Foundation).
4. Provisionar Supabase, aplicar migrações e rodar `verify-prod.mjs` (GATE 1).
5. CORE-001 (Financial Core completo) em paralelo à fundação de banco.
