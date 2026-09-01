-- Finora — Migração 0006_billing_sync_audit.sql
-- Domínio de Billing (plans, plan_features, subscriptions, subscription_events)
-- Tabelas Transversais de Sync (sync_mutations) e Auditoria Imutável (audit_logs)
-- Requisitos: 17, 18, 19.5, Correctness Property 9
-- Design: §Billing, §Offline/Sync, §Observability, §Row-Level Security.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELAS DE BILLING (DOMÍNIO SEPARADO)
-- ─────────────────────────────────────────────────────────────────────────────

-- Plans (Catálogo imutável de planos)
create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text,
  price_cents bigint not null default 0,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Plan Features (Flags de recursos e limites do FeatureGate)
create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans(id) on delete cascade,
  feature_key text not null,
  limit_value integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_features_plan_key_unique unique (plan_id, feature_key)
);

-- Subscriptions (Assinaturas ligadas à household)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade unique,
  plan_id text not null references public.plans(id) on delete restrict,
  status public.subscription_status not null default 'active',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subscription Events (Auditoria de cobrança)
-- Nota: household_id é denormalizado e mantido via trigger para RLS de ultra-alta performance
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELAS TRANSVERSAIS DE SYNC & AUDITORIA
-- ─────────────────────────────────────────────────────────────────────────────

-- Sync Mutations (Idempotência de reenvio offline — Property 9)
create table if not exists public.sync_mutations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  client_mutation_id text not null,
  applied_at timestamptz not null default now(),
  result_ref text,
  constraint sync_mutations_household_client_id_unique unique (household_id, client_mutation_id)
);

-- Audit Logs (Trilha de auditoria append-only por household)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  operation text not null,
  entity text not null,
  at timestamptz not null default now(),
  metadata jsonb
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ÍNDICES DE PERFORMANCE E CONSULTA
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists idx_subscriptions_household on public.subscriptions (household_id);
create index if not exists idx_subscription_events_household on public.subscription_events (household_id);
create index if not exists idx_sync_mutations_household_id on public.sync_mutations (household_id);
create index if not exists idx_audit_logs_household_at on public.audit_logs (household_id, at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGERS DE SINCRONIZAÇÃO E UPDATED_AT
-- ─────────────────────────────────────────────────────────────────────────────

-- Sincronizar household_id em subscription_events (sempre força a derivação imutável do pai)
create or replace function public.sync_subscription_event_household_id()
returns trigger language plpgsql as $$
declare
  sub_h uuid;
begin
  select household_id into sub_h from public.subscriptions where id = new.subscription_id;
  if sub_h is null then
    raise exception 'SUBSCRIPTION_NOT_FOUND: subscription_id % não existe', new.subscription_id;
  end if;
  new.household_id := sub_h; -- sempre força a derivação imutável do pai, nunca confia no valor de entrada
  return new;
end;
$$;

drop trigger if exists sync_subscription_event_household_id_trigger on public.subscription_events;
create trigger sync_subscription_event_household_id_trigger
  before insert or update on public.subscription_events
  for each row execute function public.sync_subscription_event_household_id();

do $$ begin
  create trigger plans_set_updated_at before update on public.plans for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger plan_features_set_updated_at before update on public.plan_features for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ROW-LEVEL SECURITY (ENABLE + FORCE)
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1 Subscriptions (ENABLE + FORCE RLS)
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select using ( public.is_household_member(household_id) );

drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_write on public.subscriptions for all using ( public.is_household_member(household_id) ) with check ( public.is_household_member(household_id) );

-- 5.2 Subscription Events (ENABLE + FORCE RLS: apenas SELECT para membros; inserções via Webhook/service_role)
alter table public.subscription_events enable row level security;
alter table public.subscription_events force row level security;

drop policy if exists subscription_events_select on public.subscription_events;
create policy subscription_events_select on public.subscription_events for select using ( public.is_household_member(household_id) );

-- 5.3 Sync Mutations (ENABLE + FORCE RLS)
alter table public.sync_mutations enable row level security;
alter table public.sync_mutations force row level security;

drop policy if exists sync_mutations_select on public.sync_mutations;
create policy sync_mutations_select on public.sync_mutations for select using ( public.is_household_member(household_id) );

drop policy if exists sync_mutations_write on public.sync_mutations;
create policy sync_mutations_write on public.sync_mutations for all using ( public.is_household_member(household_id) ) with check ( public.is_household_member(household_id) );

-- 5.4 Audit Logs (APPEND-ONLY GENUÍNO: ENABLE + FORCE RLS, apenas SELECT e INSERT, ZERO policies para UPDATE/DELETE)
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select using ( public.is_household_member(household_id) );

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert with check ( public.is_household_member(household_id) );

-- Nota: ZERO políticas para UPDATE ou DELETE em audit_logs!
-- O FORCE RLS forçará o Postgres a retornar 0 linhas afetadas para UPDATE/DELETE efetuados por membros.

-- 5.5 Catálogo de Planos (ENABLE RLS, leitura para usuários autenticados, escrita bloqueada)
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;

drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated on public.plans for select using ( auth.uid() is not null );

drop policy if exists plan_features_select_authenticated on public.plan_features;
create policy plan_features_select_authenticated on public.plan_features for select using ( auth.uid() is not null );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SEEDS DOS PLANOS (FREE / PRO / FAMILY)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.plans (id, name, description, price_cents, currency) values
  ('free', 'Plano Gratuito', 'Plano de entrada para controle financeiro básico', 0, 'BRL'),
  ('pro', 'Plano Pro', 'Recursos avançados de orçamento e relatórios', 2990, 'BRL'),
  ('family', 'Plano Família', 'Orçamento colaborativo para toda a família', 4990, 'BRL')
on conflict (id) do nothing;

insert into public.plan_features (plan_id, feature_key, limit_value, enabled) values
  -- Plano Free
  ('free', 'max_accounts', 2, true),
  ('free', 'max_members', 1, true),
  ('free', 'max_categories', 15, true),
  ('free', 'ai_ofx_import', null, false),
  ('free', 'export_reports', null, false),

  -- Plano Pro
  ('pro', 'max_accounts', 10, true),
  ('pro', 'max_members', 2, true),
  ('pro', 'max_categories', 50, true),
  ('pro', 'ai_ofx_import', null, true),
  ('pro', 'export_reports', null, true),

  -- Plano Family
  ('family', 'max_accounts', 99, true),
  ('family', 'max_members', 6, true),
  ('family', 'max_categories', 200, true),
  ('family', 'ai_ofx_import', null, true),
  ('family', 'export_reports', null, true)
on conflict (plan_id, feature_key) do nothing;
