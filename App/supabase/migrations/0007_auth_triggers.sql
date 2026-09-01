-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRAÇÃO 0007: AUTH TRIGGERS, ATOMIC SIGNUP & LOGIN ATTEMPTS
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. TABELA DE TENTATIVAS DE LOGIN (RATE LIMITING)
create table if not exists public.auth_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index if not exists idx_auth_login_attempts_email_at on public.auth_login_attempts (lower(email), attempted_at desc);

-- 1.1 RLS FORCE em auth_login_attempts (ZERO políticas de client: nega todo acesso client, restrito a service_role)
alter table public.auth_login_attempts enable row level security;
alter table public.auth_login_attempts force row level security;


-- 2. FUNÇÃO ATÔMICA DE CADASTRO (HANDLE_NEW_USER)
-- Disparada via Trigger em auth.users para criar Profile + Household + Owner em transação única
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existing_profile_id uuid;
  new_household_id uuid;
  user_display_name text;
begin
  -- Checagem prévia de e-mail existente em profiles (evita crash no UNIQUE constraint se automatic linking falhar)
  select id into existing_profile_id
  from public.profiles
  where lower(email) = lower(new.email);

  if existing_profile_id is not null then
    -- E-mail já possui perfil (e.g. signup anterior por email/senha sem linking automático no Supabase Auth)
    -- Registra evento em audit_logs para conciliação e ignora inserção silenciosamente sem lançar erro de banco
    insert into public.audit_logs (household_id, actor_id, operation, entity, metadata)
    values (
      (select household_id from public.household_members where profile_id = existing_profile_id limit 1),
      existing_profile_id,
      'OAUTH_LINKING_FALLBACK',
      'profiles',
      jsonb_build_object('new_user_id', new.id, 'existing_profile_id', existing_profile_id, 'email', new.email)
    );
    return new;
  end if;

  -- Determinar display_name a partir de metadata ou e-mail
  user_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- 1. Inserir Profile
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, user_display_name);

  -- 2. Inserir Household Padrão ("Meu Orçamento")
  insert into public.households (name, base_currency)
  values ('Meu Orçamento', 'BRL')
  returning id into new_household_id;

  -- 3. Inserir Relação Owner em household_members
  insert into public.household_members (household_id, profile_id, role)
  values (new_household_id, new.id, 'owner');

  return new;
exception when others then
  raise;
end;
$$;


-- 3. TRIGGER EM AUTH.USERS
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;
