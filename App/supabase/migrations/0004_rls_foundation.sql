-- 0004_rls_foundation.sql
-- DB-004: fundação de Row-Level Security (fail-closed) e helper de membership. Idempotente.
-- Spec: design.md §Row-Level Security. Req 5, 21.3, 21.4 — valida Correctness Property 8.
--
-- Princípios:
--  - RLS habilitado E FORÇADO (FORCE) em toda tabela com household_id → nem o dono da tabela escapa.
--  - Sem policy permissiva por padrão → ausência de policy = negação total (fail-closed).
--  - is_household_member() é a única porta: retorna false (nunca erro ambíguo) para entradas
--    inválidas (household inexistente, profile inexistente, auth.uid() nulo/não autenticado).

-- ── Stub de auth.uid() para ambientes SEM o schema auth (ex.: PGlite) ─────────
-- No Supabase real, auth.uid() é nativo e este bloco é ignorado. Idempotente.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    -- Stub: lê o uid da sessão via GUC app.current_user_id; null se não definido.
    -- Permite simular "usuário autenticado" e "não autenticado" nos testes.
    execute $fn$
      create function auth.uid() returns uuid
      language sql stable as $body$
        select nullif(current_setting('app.current_user_id', true), '')::uuid
      $body$;
    $fn$;
  end if;
end
$$;

-- ── Helper de membership ─────────────────────────────────────────────────────
-- security definer + search_path fixo (evita hijack de search_path).
-- Robusto a entradas inválidas:
--  - h nulo, household inexistente, profile inexistente → EXISTS falso → false.
--  - auth.uid() nulo (não autenticado) → nenhuma linha casa → false.
create or replace function is_household_member(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members m
    where m.household_id = h
      and m.profile_id = auth.uid()
  );
$$;

-- Verifica se o usuário autenticado tem um dos papéis informados na household.
-- Usado nas policies de gestão de membros/convites (owner/admin), conforme a
-- Matriz de Permissões do design.md (§Authorization). Robusto a entradas inválidas → false.
create or replace function has_household_role(h uuid, roles member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members m
    where m.household_id = h
      and m.profile_id = auth.uid()
      and m.role = any(roles)
  );
$$;

-- ── RLS nas tabelas de identidade/household ──────────────────────────────────
-- households, household_members, invitations. As tabelas financeiras recebem RLS
-- nas suas próprias migrações (DB-005/006) seguindo este mesmo padrão.

-- households: membros da household podem ler; escrita restrita a membros.
alter table households enable row level security;
alter table households force row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='households' and policyname='households_select') then
    create policy households_select on households
      for select using ( is_household_member(id) );
  end if;
  if not exists (select 1 from pg_policies where tablename='households' and policyname='households_write') then
    create policy households_write on households
      for all using ( is_household_member(id) )
      with check ( is_household_member(id) );
  end if;
end
$$;

-- household_members: qualquer membro LÊ os vínculos; ESCRITA (gestão de membros) é
-- restrita a owner/admin, conforme a Matriz de Permissões (design §Authorization).
-- A granularidade fina (ex.: só owner altera papel/remove) é reforçada no Application Service
-- (enforcement em duas camadas, conforme o design).
alter table household_members enable row level security;
alter table household_members force row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='household_members' and policyname='household_members_select') then
    create policy household_members_select on household_members
      for select using ( is_household_member(household_id) );
  end if;
  if not exists (select 1 from pg_policies where tablename='household_members' and policyname='household_members_write') then
    create policy household_members_write on household_members
      for all using ( has_household_role(household_id, array['owner','admin']::member_role[]) )
      with check ( has_household_role(household_id, array['owner','admin']::member_role[]) );
  end if;
end
$$;

-- invitations: qualquer membro LÊ; CONVIDAR/gerir convites é restrito a owner/admin
-- (design §Authorization: "Convidar/remover membros" → Owner ✅, Admin ✅, Member ❌).
alter table invitations enable row level security;
alter table invitations force row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='invitations' and policyname='invitations_select') then
    create policy invitations_select on invitations
      for select using ( is_household_member(household_id) );
  end if;
  if not exists (select 1 from pg_policies where tablename='invitations' and policyname='invitations_write') then
    create policy invitations_write on invitations
      for all using ( has_household_role(household_id, array['owner','admin']::member_role[]) )
      with check ( has_household_role(household_id, array['owner','admin']::member_role[]) );
  end if;
end
$$;

-- ── RLS em profiles (dado pessoal) ───────────────────────────────────────────
-- Cada usuário lê e edita SOMENTE o próprio profile (id = auth.uid()).
-- (Antecipa a proteção de dado pessoal; profiles foi criado em DB-002.)
alter table profiles enable row level security;
alter table profiles force row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_select_self') then
    create policy profiles_select_self on profiles
      for select using ( id = auth.uid() );
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='profiles_update_self') then
    create policy profiles_update_self on profiles
      for update using ( id = auth.uid() )
      with check ( id = auth.uid() );
  end if;
end
$$;
