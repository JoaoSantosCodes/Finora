-- Finora — Migração 0005_financial.sql
-- Schema Financeiro: accounts, categories, transactions, credit_cards, credit_card_invoices, installment_plans, installments.
-- Requisitos: 6, 7, 8, 9, 10, 11, 20
-- Design: §Data Models (Financeiro), §Authorization, §Row-Level Security.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELAS DE DOMÍNIO FINANCEIRO
-- ─────────────────────────────────────────────────────────────────────────────

-- Accounts (Contas bancárias, carteiras, investimentos)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  type public.account_type not null default 'checking',
  initial_balance_cents bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Categories (Categorias de receitas e despesas)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text,
  classification public.classification not null default 'Variável',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Credit Cards (Cartões de crédito)
create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  credit_limit_cents bigint not null default 0,
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Credit Card Invoices (Faturas de cartão de crédito)
-- Nota: household_id é denormalizado e mantido via trigger para RLS de ultra-alta performance
create table if not exists public.credit_card_invoices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  cycle date not null,
  due_date date not null,
  status public.invoice_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Installment Plans (Planos de compras parceladas)
create table if not exists public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  total_amount_cents bigint not null check (total_amount_cents > 0),
  installments_count integer not null check (installments_count > 0),
  credit_card_id uuid references public.credit_cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transactions (Lançamentos de receita, despesa e transferência)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type public.tx_type not null,
  amount_cents bigint not null check (amount_cents > 0),
  account_id uuid references public.accounts(id) on delete restrict,
  counter_account_id uuid references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  accrual_date date not null,
  payment_status public.payment_status not null default 'pending',
  paid_at timestamptz,
  credit_card_id uuid references public.credit_cards(id) on delete set null,
  installment_id uuid, -- FK adicionada após a tabela installments
  source public.tx_source not null default 'manual',
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_status <> 'paid' or paid_at is not null),
  check (
    (type = 'transfer' and counter_account_id is not null and account_id <> counter_account_id) or
    (type <> 'transfer' and counter_account_id is null)
  )
);

-- Installments (Parcelas individuais de compras parceladas ou faturas)
-- Nota: household_id é denormalizado e mantido via trigger para RLS de ultra-alta performance
create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  installment_plan_id uuid not null references public.installment_plans(id) on delete cascade,
  number integer not null check (number > 0),
  amount_cents bigint not null check (amount_cents > 0),
  accrual_date date not null,
  invoice_id uuid references public.credit_card_invoices(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  payment_status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((invoice_id is not null) <> (transaction_id is not null))
);

-- Adicionar FK de transactions.installment_id -> installments.id se ainda não existir
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_installment_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_installment_id_fkey
      foreign key (installment_id) references public.installments(id) on delete set null;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ÍNDICES ÚNICOS E DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- Categorias únicas por nome case-insensitive dentro da mesma household
create unique index if not exists categories_household_name_key
  on public.categories (household_id, lower(name));

-- Faturas únicas por ciclo no mesmo cartão
create unique index if not exists credit_card_invoices_card_cycle_key
  on public.credit_card_invoices (credit_card_id, cycle);

-- Deduplicação de importação por external_ref escopado por conta na household
create unique index if not exists transactions_external_ref_key
  on public.transactions (household_id, account_id, external_ref)
  where external_ref is not null;

-- Índices de consulta do Dashboard e Relatórios (Req 23.1)
create index if not exists idx_transactions_household_accrual on public.transactions (household_id, accrual_date);
create index if not exists idx_transactions_household_category on public.transactions (household_id, category_id);
create index if not exists idx_transactions_household_payment on public.transactions (household_id, payment_status);
create index if not exists idx_transactions_account on public.transactions (account_id);
create index if not exists idx_credit_card_invoices_card_cycle on public.credit_card_invoices (credit_card_id, cycle);
create index if not exists idx_installments_plan on public.installments (installment_plan_id);
create index if not exists idx_installments_invoice on public.installments (invoice_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGERS DE SINCRONIZAÇÃO E UPDATED_AT
-- ─────────────────────────────────────────────────────────────────────────────

-- Sincronizar household_id em credit_card_invoices
create or replace function public.sync_invoice_household_id()
returns trigger language plpgsql as $$
begin
  select household_id into new.household_id
  from public.credit_cards
  where id = new.credit_card_id;
  return new;
end;
$$;

drop trigger if exists sync_invoice_household_id_trigger on public.credit_card_invoices;
create trigger sync_invoice_household_id_trigger
  before insert or update on public.credit_card_invoices
  for each row execute function public.sync_invoice_household_id();

-- Sincronizar household_id em installments
create or replace function public.sync_installment_household_id()
returns trigger language plpgsql as $$
begin
  if new.invoice_id is not null then
    select household_id into new.household_id
    from public.credit_card_invoices
    where id = new.invoice_id;
  elsif new.transaction_id is not null then
    select household_id into new.household_id
    from public.transactions
    where id = new.transaction_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_installment_household_id_trigger on public.installments;
create trigger sync_installment_household_id_trigger
  before insert or update on public.installments
  for each row execute function public.sync_installment_household_id();

-- Triggers de set_updated_at
do $$ begin
  create trigger accounts_set_updated_at before update on public.accounts for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger credit_cards_set_updated_at before update on public.credit_cards for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger credit_card_invoices_set_updated_at before update on public.credit_card_invoices for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger installment_plans_set_updated_at before update on public.installment_plans for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger installments_set_updated_at before update on public.installments for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ROW-LEVEL SECURITY (ENABLE + FORCE + HOMOGÊNEO)
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1 Activating ENABLE and FORCE RLS on all 7 financial tables
alter table public.accounts enable row level security;
alter table public.accounts force row level security;

alter table public.categories enable row level security;
alter table public.categories force row level security;

alter table public.credit_cards enable row level security;
alter table public.credit_cards force row level security;

alter table public.credit_card_invoices enable row level security;
alter table public.credit_card_invoices force row level security;

alter table public.installment_plans enable row level security;
alter table public.installment_plans force row level security;

alter table public.transactions enable row level security;
alter table public.transactions force row level security;

alter table public.installments enable row level security;
alter table public.installments force row level security;

-- 4.2 Standard Member Policies (SELECT e WRITE para membros da household)
-- Categories
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select using ( public.is_household_member(household_id) );

drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all using ( public.is_household_member(household_id) ) with check ( public.is_household_member(household_id) );

-- Transactions
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select using ( public.is_household_member(household_id) );

drop policy if exists transactions_write on public.transactions;
create policy transactions_write on public.transactions for all using ( public.is_household_member(household_id) ) with check ( public.is_household_member(household_id) );

-- Credit Card Invoices
drop policy if exists credit_card_invoices_select on public.credit_card_invoices;
create policy credit_card_invoices_select on public.credit_card_invoices for select using ( public.is_household_member(household_id) );

drop policy if exists credit_card_invoices_write on public.credit_card_invoices;
create policy credit_card_invoices_write on public.credit_card_invoices for all using ( public.is_household_member(household_id) ) with check ( public.is_household_member(household_id) );

-- Installment Plans
drop policy if exists installment_plans_select on public.installment_plans;
create policy installment_plans_select on public.installment_plans for select using ( public.is_household_member(household_id) );

drop policy if exists installment_plans_write on public.installment_plans;
create policy installment_plans_write on public.installment_plans for all using ( public.is_household_member(household_id) ) with check ( public.is_household_member(household_id) );

-- Installments
drop policy if exists installments_select on public.installments;
create policy installments_select on public.installments for select using ( public.is_household_member(household_id) );

drop policy if exists installments_write on public.installments;
create policy installments_write on public.installments for all using ( public.is_household_member(household_id) ) with check ( public.is_household_member(household_id) );

-- 4.3 Structural Accounts & Credit Cards Policies (Criar/Editar livre p/ membros; Deletar/Arquivar restrito a Owner/Admin)
-- Accounts
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select using ( public.is_household_member(household_id) );

drop policy if exists accounts_insert on public.accounts;
create policy accounts_insert on public.accounts for insert with check ( public.is_household_member(household_id) );

drop policy if exists accounts_update on public.accounts;
create policy accounts_update on public.accounts for update using ( public.is_household_member(household_id) ) with check ( public.is_household_member(household_id) );

drop policy if exists accounts_delete on public.accounts;
create policy accounts_delete on public.accounts for delete using ( public.has_household_role(household_id, array['owner', 'admin']::public.member_role[]) );

-- Credit Cards
drop policy if exists credit_cards_select on public.credit_cards;
create policy credit_cards_select on public.credit_cards for select using ( public.is_household_member(household_id) );

drop policy if exists credit_cards_insert on public.credit_cards;
create policy credit_cards_insert on public.credit_cards for insert with check ( public.is_household_member(household_id) );

drop policy if exists credit_cards_update on public.credit_cards;
create policy credit_cards_update on public.credit_cards for update using ( public.is_household_member(household_id) ) with check ( public.is_household_member(household_id) );

drop policy if exists credit_cards_delete on public.credit_cards;
create policy credit_cards_delete on public.credit_cards for delete using ( public.has_household_role(household_id, array['owner', 'admin']::public.member_role[]) );
