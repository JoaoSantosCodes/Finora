-- 0003_household.sql
-- DB-003: schema de Household — households, household_members, invitations. Idempotente.
-- Spec: design.md §Domain Model (Household) e §Data Models.
-- Invariante central (Req 4.13): exatamente um Owner por household, garantida por
-- índice único parcial em household_members. RLS NÃO é escopo desta migração (ver DB-004).

-- ── households ───────────────────────────────────────────────────────────────
create table if not exists households (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  base_currency text not null default 'BRL',
  -- owner_id: referência denormalizada ao owner atual (conveniência de leitura).
  -- A fonte de verdade da invariante "um owner" é o índice parcial em household_members.
  owner_id      uuid references profiles (id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── household_members ────────────────────────────────────────────────────────
-- Liga Profile ↔ Household com papel. PK composta (household_id, profile_id).
create table if not exists household_members (
  household_id uuid not null references households (id) on delete cascade,
  profile_id   uuid not null references profiles (id)   on delete cascade,
  role         member_role not null default 'member',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (household_id, profile_id)
);

-- Invariante Req 4.13: no máximo UM owner por household.
-- Índice único parcial: aplica-se a INSERT e UPDATE (promover 2º membro a owner é bloqueado).
create unique index if not exists household_one_owner
  on household_members (household_id)
  where role = 'owner';

-- Índice de apoio para buscas por profile (households do usuário).
create index if not exists household_members_profile_idx
  on household_members (profile_id);

-- ── invitations ──────────────────────────────────────────────────────────────
create table if not exists invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  email        text not null,
  role         member_role not null default 'member',
  status       invitation_status not null default 'pending',
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists invitations_household_idx
  on invitations (household_id);

-- ── sincronização de households.owner_id ────────────────────────────────────
-- Mantém households.owner_id consistente com o owner real em household_members.
-- Categoria: integridade referencial (banco consistente consigo mesmo), não regra de
-- negócio de aplicação. Evita leitura silenciosa de owner_id divergente (billing, permissões).
--
-- Design defensivo:
--  - Só reescreve owner_id quando uma linha PASSA A SER owner (INSERT/UPDATE role->owner).
--    O índice parcial garante no máximo um owner, então esse valor é sempre o correto.
--  - NÃO reage isoladamente ao rebaixamento: durante uma transferência (rebaixa A, promove B),
--    o owner_id só é atualizado quando B vira owner — evitando estado intermediário nulo.
--  - Nunca escreve em household_members (sem recursão); só atualiza households.
create or replace function sync_household_owner()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.role = 'owner' then
    update households
      set owner_id = new.profile_id
      where id = new.household_id
        and owner_id is distinct from new.profile_id;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'household_members_sync_owner') then
    create trigger household_members_sync_owner
      after insert or update of role on household_members
      for each row execute function sync_household_owner();
  end if;
end
$$;

-- ── triggers de updated_at ───────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'households_set_updated_at') then
    create trigger households_set_updated_at
      before update on households
      for each row execute function set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'household_members_set_updated_at') then
    create trigger household_members_set_updated_at
      before update on household_members
      for each row execute function set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'invitations_set_updated_at') then
    create trigger invitations_set_updated_at
      before update on invitations
      for each row execute function set_updated_at();
  end if;
end
$$;
