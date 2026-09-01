-- 0002_identity.sql
-- DB-002: schema de Identity — tabela `profiles`. Idempotente.
-- Spec: design.md §Domain Model (Identity) e §Data Models.
-- Profile: id (= auth user id), email (único), display_name, locale, timezone.
-- Identidades Google são gerenciadas pelo provedor de auth (auth.identities), não como coluna aqui.
-- RLS NÃO é escopo desta migração (ver DB-004).

-- ── Tabela profiles ──────────────────────────────────────────────────────────
-- profiles.id referencia o usuário de autenticação. No Supabase, isso é auth.users(id).
-- A FK para auth.users é adicionada condicionalmente abaixo (só quando o schema auth existe),
-- para que a migração também aplique em ambientes de teste sem o schema auth (ex.: PGlite).
create table if not exists profiles (
  id           uuid primary key,
  email        text not null,
  display_name text,
  locale       text not null default 'pt-BR',
  timezone     text not null default 'America/Sao_Paulo',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- E-mail único (case-insensitive), idempotente.
create unique index if not exists profiles_email_key on profiles (lower(email));

-- Trigger de updated_at (função set_updated_at criada em 0001_extensions.sql).
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'profiles_set_updated_at'
  ) then
    create trigger profiles_set_updated_at
      before update on profiles
      for each row execute function set_updated_at();
  end if;
end
$$;

-- FK opcional para auth.users (apenas no ambiente Supabase, onde o schema auth existe).
-- Idempotente: só cria a constraint se o schema/tabela auth.users existir e a FK ainda não existir.
-- Se o schema auth NÃO existir, emite um AVISO explícito (RAISE NOTICE) para que a ausência
-- da FK não passe despercebida. Não usar EXCEPTION aqui: quebraria o teste local via PGlite.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    if not exists (
      select 1 from pg_constraint where conname = 'profiles_id_fkey'
    ) then
      alter table profiles
        add constraint profiles_id_fkey
        foreign key (id) references auth.users (id) on delete cascade;
    end if;
  else
    raise notice 'AVISO: schema auth não encontrado — profiles_id_fkey NÃO foi criada. Isso é esperado em ambiente de teste (PGlite), mas NÃO deve acontecer em produção (Supabase).';
  end if;
end
$$;
