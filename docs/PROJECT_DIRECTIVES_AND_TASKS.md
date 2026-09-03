# Finora SaaS — Diretrizes Gerais, Governança & Roadmap de Tarefas

Documento consolidado de diretrizes de arquitetura, segurança, regras de desenvolvimento e roadmap de tarefas do projeto **Finora SaaS**.

---

## 🛡️ 1. Diretrizes de Segurança & Governança de Credenciais

1. **Zero Secrets em Código / Git / Chat**:
   - Chaves privadas, tokens de serviço e secrets de provedores (ex: Supabase Service Role Key, Google OAuth Secret, Stripe Webhook Secret) **nunca** são inseridos no código-fonte, commits ou mensagens do chat.
   - Variáveis sensíveis devem residir exclusivamente em `.env.local` (bloqueado via `.gitignore`) ou nos Secrets do GitHub Actions.
2. **Implantação de Banco sob Revisão Controlada**:
   - Aplicações de schema no banco de produção (`db:apply`) são disparadas **exclusivamente via `workflow_dispatch`** no GitHub Actions, com parâmetro explícito `run_apply = true` e aprovação obrigatória da Environment `production`.
4. **Deploy Automático na Cloudflare Pages / Workers**:
   - Cada commit publicado na branch `main` dispara a build contínua do frontend no Cloudflare Pages.
   - **URL de Produção**: [`https://finora.joaocarlosrh23.workers.dev/`](https://finora.joaocarlosrh23.workers.dev/) (Status: 🟢 **200 OK — Sincronizado**).

---

## 🏛️ 2. Diretrizes de Arquitetura & Banco de Dados (PostgreSQL + Supabase RLS)

1. **Isolamento Multitenant Nativo via RLS (`FORCE RLS`)**:
   - Todas as tabelas que contêm dados de usuários ou orçamentos possuem RLS ativado (`ENABLE RLS`) e forçado (`FORCE RLS`), garantindo que até mesmo o dono da tabela seja submetido às políticas de segurança.
   - A verificação de pertencimento ao orçamento é feita via função determinística `public.is_household_member(household_id)`.
2. **Fail-Closed por Padrão**:
   - Se nenhuma política de RLS for expressamente definida para uma operação, a engine do Postgres bloqueia a consulta/escrita por padrão (retornando 0 linhas / negação).
3. **Repositórios Financeiros Nunca Usam `service_role`**:
   - Repositórios de dados financeiros executam obrigatoriamente utilizando a sessão/token JWT do usuário logado (`Authorization: Bearer <user_jwt>`), propagando o `auth.uid()` nativo para a engine do Postgres.
4. **Funções RPC Atômicas (`SECURITY INVOKER`)**:
   - Operações compostas multi-tabela (transferências entre contas, parcelamentos, deleção com auditoria) utilizam **Funções SQL RPC** com `SECURITY INVOKER` e `SET search_path = public`.
   - **Hardening Obrigatório**: Toda RPC executa `REVOKE ALL ON FUNCTION ... FROM public, anon` e `GRANT EXECUTE TO authenticated`.
5. **Detecção de Negação por RLS em Mutação (`count === 0`)**:
   - Operações de `UPDATE`, `DELETE` ou arquivamento no Supabase JS encadeiam a verificação `{ count: 'exact' }`.
   - Se o RLS negar a operação (afetando 0 linhas para um registro existente), o repositório lança um erro explícito de domínio (`PermissionDeniedError`), impedindo falsos sucessos silenciosos na UI.
6. **Desagregação entre Harness de Teste e Migrações de Produção**:
   - Código de scaffolding de ambiente local (ex: criação de papéis PGlite, stubs de teste) vive **exclusivamente no runner de testes (`run-migration.mjs`)**, jamais em migrações de produção (`supabase/migrations/*.sql`).

---

## 💻 3. Diretrizes de Desenvolvimento de Código & Camadas

1. **Monorepo Limpo & Boundaries Rígidos**:
   ```
   API / Web App  →  Application Services  →  Financial Core (@finora/core)  →  Repositories & RPCs  →  PostgreSQL RLS
   ```
2. **Financial Core Puro (`@finora/core`)**:
   - O núcleo de regras financeiras (cálculo de saldo, parcelamentos, faturas) é puro, determinístico e livre de I/O.
   - Toda alteração nas regras do core exige testes unitários e **Property-Based Testing** com `fast-check`.
3. **Mapeamento de Centavos (`Cents`)**:
   - Todos os valores monetários no banco de dados e no core são trafegados como inteiros positivos `amount_cents` (`bigint`), evitando imprecisões de ponto flutuante (`float`).

---

## 📋 4. Processo de Trabalho (Workflow Obrigatório)

1. **Plan & Review**: Elaborar o `implementation_plan.md` antes de escrever código de tarefas complexas.
2. **Execução Local**: Implementar código, suíte de testes em PGlite (`npm run test:db`), testes unitários (`npx vitest run`) e build (`npm run build`).
3. **Resumo Local Transparente**: Apresentar ao revisor/usuário o resumo completo com código e logs dos testes **antes de qualquer commit**.
4. **Commit & Push**: Após aprovação explícita, realizar o commit com mensagem padronizada (`feat(...)`, `fix(...)`).
5. **Deploy & Validação de Produção**: Aplicar migrações via GitHub Actions e verificar logs do `verify-prod.mjs`.

---

## 📑 5. Roadmap Completo de Tarefas

### 🟢 Fase 1: Especificação, Fundação & Banco de Dados (GATE 1)

| ID | Tarefa / Módulo | Status | Descrição & Entregáveis |
|---|---|---|---|
| 01 | **FOUNDATION** | ✅ Concluído | Monorepo, boundaries, Financial Core puro (`packages/core`). |
| 02 | **DB-001 Extensions** | ✅ Concluído | `0001_extensions.sql`: `pgcrypto`, 10 enums, trigger `set_updated_at`. |
| 03 | **DB-002 Identity** | ✅ Concluído | `0002_identity.sql`: Tabela `profiles` com e-mail único case-insensitive. |
| 04 | **DB-003 Household** | ✅ Concluído | `0003_household.sql`: `households`, `household_members` (1 owner) e `invitations`. |
| 05 | **DB-004 RLS Foundation** | ✅ Concluído | `0004_rls_foundation.sql`: `FORCE RLS`, `is_household_member`, permissões por papel. |
| 06 | **GATE 1 verify-prod** | ✅ Concluído | Validação 100% GREEN no Supabase de Produção. |
| 07 | **DB-005 Schema Financeiro** | ✅ Concluído | `0005_financial.sql`: `accounts`, `categories`, `transactions`, `credit_cards`, `invoices`, `installments`. |
| 08 | **DB-006 Billing, Sync & Audit** | ✅ Concluído | `0006_billing_sync_audit.sql`: Planos, `sync_mutations` UNIQUE, `audit_logs` imutável. |

---

### 🟢 Fase 2: Autenticação & Repositórios (WAVES 2 e 3)

| ID | Tarefa / Módulo | Status | Descrição & Entregáveis |
|---|---|---|---|
| 09 | **CORE-001 Financial Core** | ✅ Concluído | Regras de saldo, parcelas e faturas puras com 17 testes + Property-Based Testing. |
| 10 | **BILL-001 FeatureGate** | ✅ Concluído | Matriz de planos e decisões de entitlement puras com 12 testes. |
| 11 | **AUTH-001 Auth Integration** | ✅ Concluído | `0007_auth_triggers.sql`: Trigger atômico `handle_new_user`, `auth_login_attempts` RLS FORCE, `detectUnlinkedSession`. |
| 12 | **API-001 Repositories & RPCs** | ✅ Concluído | `0008_api_rpc_functions.sql`: Repositórios sob RLS (`count: 'exact'`), RPCs atômicas com hardening, 41/41 testes verdes. |

---

### ⏳ Fase 3: Application Services (API-002) — EM ANDAMENTO

| ID | Subtarefa / Serviço | Status | Descrição & Escopo |
|---|---|---|---|
| 13 | **API-002A Account Service** | ✅ Concluído | CRUD de contas, arquivamento (`archived = true`), recálculo de saldo via Financial Core e limite do plano via FeatureGate (`canCreate`). |
| 14 | **API-002B Transaction Service** | ✅ Concluído | Receitas/Despesas com validação `amountCents > 0`, datas de competência, alternância `paid`/`pending` e exclusão atômica com auditoria. |
| 15 | **API-002C Transfer Service** | ✅ Concluído | Transferências entre contas distintas via RPC atômica `rpc_transfer_funds`, validação de origem ≠ destino e conservação de saldo. |
| 16 | **API-002D Installment Service** | ✅ Concluído | Criação atômica de parcelamentos via `rpc_create_installment_transaction`, validação do FeatureGate (`canUse`) e invariante $\sum \text{parcelas} = \text{totalCents}$. |
| 17 | **API-002E CreditCard Service** | ✅ Concluído | CRUD de cartões com limite, validação de dias 1-31, limite do plano via FeatureGate (`canCreate`) e pagamento de fatura. |
| 18 | **API-002F Category Service** | ✅ Concluído | CRUD de categorias com classificação estrita, unicidade de nome case-insensitive, limite do plano via FeatureGate e reatribuição na exclusão. |

---

### ⏳ Fase 4: Frontend Web & Motor de Sincronização

| ID | Tarefa / Módulo | Status | Descrição & Escopo |
|---|---|---|---|
| 19 | **SYNC-001 Sync Engine** | ⏳ Pendente | Sincronização offline-first com fila idempotente em `sync_mutations`. |
| 20 | **WEB-001 App Frontend** | ⏳ Pendente | Interface React (Financial OS V0), navegação por módulos e sincronização. |
| 21 | **BILL-002 Billing Webhooks** | ⏳ Pendente | Integração Stripe/webhooks para gerenciamento de assinaturas e upgrade/downgrade. |

---

*Documento mantido e atualizado de acordo com a especificação técnica do Finora SaaS.*
