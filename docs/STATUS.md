# Finora — Status do Projeto

Acompanhamento do progresso. A fonte de verdade das tarefas é [`.kiro/specs/finora-saas/tasks.md`](../.kiro/specs/finora-saas/tasks.md); este arquivo é um resumo navegável.

_Atualizado após o UX Design e o redesign do V0._

## 🔴 AÇÃO DE SEGURANÇA PENDENTE (fazer AGORA, ~10 min, fora do Kiro)

Dois secrets foram expostos em chat e continuam potencialmente ativos. Rotacionar **não depende de código nem de provisionar o Supabase** — é ação manual nos painéis. Enquanto não for feito, há risco de credencial comprometida viva.

- [ ] **Supabase secret key** — Dashboard → Project Settings → API Keys → secret key `default` → **Rotate/Regenerate**. Guardar a nova só em `.env.local` / config do Supabase.
- [ ] **Google OAuth client secret** (`GOCSPX-...`) — Google Cloud Console → APIs & Services → Credentials → OAuth client → **Reset secret**. Guardar a nova só no Supabase (Auth → Providers → Google), nunca em arquivo.

Depois de rotacionar, marcar os itens acima. As chaves antigas passam a não valer nada, zerando o risco da exposição.

---

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
| 4. DB-003 Household | ✅ | households/members/invitations; índice parcial "um owner" (4 bordas) + trigger de sync do owner_id |
| 5. DB-004 RLS Foundation | ✅ | FORCE + fail-closed + `is_household_member`/`has_household_role`; RLS em profiles; permissões por papel (convite owner/admin); validado via PGlite |
| 31. GATE 1 verify-prod | ⏳ próximo | `verify-prod.mjs` verde contra o Supabase real (FK/RLS) — obrigatório para fechar o gate |
| **GATE 1** | 🔒 | Falta: provisionar Supabase + verify-prod verde no banco real |

## Trabalho paralelo (V0 sempre funcional)

| Item | Status | Commit |
|---|---|---|
| Redesign V0 (Financial OS) | ✅ | `da50edb` |
| UX Design documentado | ✅ | `5432578` |
| CORE-001 Financial Core (puro, 17 testes, property-based) | ✅ | — |
| BILL-001 FeatureGate/entitlement — parte pura (core, 12 testes) | ✅ | — |

## Pendências e bloqueios

- ⚠️ **Segurança:** ver o item **AÇÃO DE SEGURANÇA PENDENTE** no topo deste arquivo (rotação dos dois secrets). O `.gitignore` já bloqueia `client_secret_*.json` e `.env*`.
- ⏳ **Provisionar Supabase** e configurar `.env.local` (sem commitar) para aplicar migrações no ambiente real. Até lá, as migrações são validadas localmente via PGlite.

## Próximos passos sugeridos

1. Rotacionar a secret key do Supabase e o client secret do Google.
2. Provisionar Supabase, aplicar migrações 0001–0004 e rodar `verify-prod.mjs` (GATE 1) — estender o script com FK, FORCE/RLS e A→B reais.
3. Fechar GATE 1.
4. CORE-001 (Financial Core completo) em paralelo à fundação de banco.
5. DB-005 (Schema financeiro) após o GATE 1.
