-- 0001_extensions.sql
-- DB-001: extensões, tipos enum e utilitários base. Idempotente.
-- Justificativa arquitetural por item (design.md §Data Models — Convenções globais).
-- Não adicionar extensões "por precaução": cada uma deve ter uso concreto no schema.

-- ── Extensões ────────────────────────────────────────────────────────────────
-- pgcrypto: fornece gen_random_uuid(), usado como default de toda PK uuid.
create extension if not exists "pgcrypto";

-- ── Tipos enum ────────────────────────────────────────────────────────────────
-- Enums usados pelas tabelas das próximas migrações (DB-003 em diante).
-- Criados de forma idempotente via bloco condicional (CREATE TYPE não aceita IF NOT EXISTS).

do $$
begin
  -- Papel do membro na household (DB-003). Req 4.
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type member_role as enum ('owner', 'admin', 'member');
  end if;

  -- Status de convite (DB-003). Req 4.
  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
  end if;

  -- Tipo de conta (DB-005). Req 6.2.
  if not exists (select 1 from pg_type where typname = 'account_type') then
    create type account_type as enum ('checking', 'savings', 'wallet', 'credit_card');
  end if;

  -- Classificação de categoria (DB-005). Req 7.2/7.3.
  if not exists (select 1 from pg_type where typname = 'classification') then
    create type classification as enum ('Essencial', 'Fixo', 'Variável', 'Supérfluo');
  end if;

  -- Tipo de transação (DB-005). Req 8.
  if not exists (select 1 from pg_type where typname = 'tx_type') then
    create type tx_type as enum ('income', 'expense', 'transfer');
  end if;

  -- Status de pagamento (DB-005). Req 9.
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('paid', 'pending');
  end if;

  -- Origem da transação, para deduplicação (DB-005). design §Identidade técnica.
  if not exists (select 1 from pg_type where typname = 'tx_source') then
    create type tx_source as enum ('manual', 'sync', 'import');
  end if;

  -- Status de fatura (DB-005). Req 10.
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('open', 'closed', 'paid');
  end if;

  -- Periodicidade de recorrência (DB-005 / V1.1). Req 12.2.
  if not exists (select 1 from pg_type where typname = 'frequency') then
    create type frequency as enum ('weekly', 'monthly', 'yearly');
  end if;

  -- Status de assinatura (DB-006). Req 17.
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum
      ('free', 'trialing', 'active', 'past_due', 'canceled', 'expired');
  end if;
end
$$;

-- ── Utilitário: trigger genérico de updated_at ───────────────────────────────
-- Mantém updated_at = now() em UPDATE. Aplicado por tabela nas próximas migrações.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
