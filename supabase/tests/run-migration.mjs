// Teste de execução das migrações usando PGlite (Postgres em WASM, sem Docker).
// Aplica TODAS as migrações de supabase/migrations em ordem, valida idempotência
// (aplica 2x) e verifica os objetos esperados. Não toca em nenhum banco remoto.
// Ver design.md §Testing Strategy.

import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', 'migrations')

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const EXPECTED_ENUMS = [
  'member_role', 'invitation_status', 'account_type', 'classification',
  'tx_type', 'payment_status', 'tx_source', 'invoice_status',
  'frequency', 'subscription_status',
]

function assert(cond, msg) {
  if (!cond) {
    console.error('FALHA:', msg)
    process.exitCode = 1
    throw new Error(msg)
  }
  console.log('  ok —', msg)
}

const db = new PGlite({ extensions: { pgcrypto } })

async function applyAll(label) {
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf8')
    await db.exec(sql)
  }
  console.log(`   ${label}: ${files.join(', ')}`)
}

console.log('1) Aplicando todas as migrações pela primeira vez...')
await applyAll('aplicadas')

console.log('2) Reaplicando (idempotência)...')
await applyAll('reaplicadas')

console.log('3) DB-001 — extensões, enums e trigger:')
const uuid = await db.query('select gen_random_uuid() as id')
assert(typeof uuid.rows[0].id === 'string' && uuid.rows[0].id.length === 36,
  'gen_random_uuid() funciona (pgcrypto)')
for (const name of EXPECTED_ENUMS) {
  const r = await db.query('select 1 from pg_type where typname = $1', [name])
  assert(r.rows.length === 1, `enum "${name}" existe`)
}
const fn = await db.query(`select 1 from pg_proc where proname = 'set_updated_at'`)
assert(fn.rows.length === 1, 'função set_updated_at() existe')

console.log('4) DB-002 — tabela profiles:')
const cols = await db.query(
  `select column_name, data_type, is_nullable, column_default
   from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
   order by ordinal_position`,
)
const byName = Object.fromEntries(cols.rows.map((c) => [c.column_name, c]))
const expectedCols = ['id', 'email', 'display_name', 'locale', 'timezone', 'created_at', 'updated_at']
for (const c of expectedCols) {
  assert(byName[c] !== undefined, `coluna profiles.${c} existe`)
}
assert(byName.id.data_type === 'uuid', 'profiles.id é uuid')
assert(byName.email.is_nullable === 'NO', 'profiles.email é NOT NULL')
assert(byName.locale.column_default?.includes('pt-BR'), "profiles.locale default 'pt-BR'")
assert(byName.timezone.column_default?.includes('America/Sao_Paulo'),
  "profiles.timezone default 'America/Sao_Paulo'")
assert(byName.created_at.data_type === 'timestamp with time zone', 'created_at é timestamptz')
assert(byName.updated_at.data_type === 'timestamp with time zone', 'updated_at é timestamptz')

// índice único de e-mail (case-insensitive)
const idx = await db.query(`select 1 from pg_indexes where indexname = 'profiles_email_key'`)
assert(idx.rows.length === 1, 'índice único profiles_email_key existe')

// unicidade efetiva de e-mail (case-insensitive)
await db.query(
  `insert into profiles (id, email) values (gen_random_uuid(), 'user@finora.app')`,
)
let dupBlocked = false
try {
  await db.query(
    `insert into profiles (id, email) values (gen_random_uuid(), 'USER@finora.app')`,
  )
} catch {
  dupBlocked = true
}
assert(dupBlocked, 'e-mail duplicado (case-insensitive) é rejeitado')

// trigger de updated_at
const trg = await db.query(`select 1 from pg_trigger where tgname = 'profiles_set_updated_at'`)
assert(trg.rows.length === 1, 'trigger profiles_set_updated_at existe')

console.log('5) DB-003 — households, members, invitations:')
for (const t of ['households', 'household_members', 'invitations']) {
  const r = await db.query(
    `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
    [t],
  )
  assert(r.rows.length === 1, `tabela ${t} existe`)
}

// base_currency default 'BRL'
const bc = await db.query(
  `select column_default from information_schema.columns
   where table_name='households' and column_name='base_currency'`,
)
assert(bc.rows[0].column_default?.includes('BRL'), "households.base_currency default 'BRL'")

// índice único parcial de owner
const oi = await db.query(`select 1 from pg_indexes where indexname='household_one_owner'`)
assert(oi.rows.length === 1, 'índice household_one_owner existe')

// PK composta de household_members
const pk = await db.query(
  `select count(*)::int as n from information_schema.key_column_usage
   where constraint_name = (
     select constraint_name from information_schema.table_constraints
     where table_name='household_members' and constraint_type='PRIMARY KEY'
   )`,
)
assert(pk.rows[0].n === 2, 'household_members tem PK composta (2 colunas)')

// invitations.expires_at tem default (+7 dias)
const inv = await db.query(
  `select column_default from information_schema.columns
   where table_name='invitations' and column_name='expires_at'`,
)
assert(!!inv.rows[0].column_default, 'invitations.expires_at tem default (+7 dias)')

console.log('6) DB-003 — TESTE NEGATIVO: invariante "um Owner por household":')

// Fixtures: 2 profiles + 1 household
const pA = (await db.query(`insert into profiles (id,email) values (gen_random_uuid(),'a@f.app') returning id`)).rows[0].id
const pB = (await db.query(`insert into profiles (id,email) values (gen_random_uuid(),'b@f.app') returning id`)).rows[0].id
const h1 = (await db.query(`insert into households (name) values ('Casa 1') returning id`)).rows[0].id

// Caso base: primeiro owner é aceito
await db.query(`insert into household_members (household_id,profile_id,role) values ($1,$2,'owner')`, [h1, pA])
console.log('  ok — primeiro owner inserido')

// Borda 1: segundo owner via INSERT deve ser REJEITADO
let b1 = false
try {
  await db.query(`insert into household_members (household_id,profile_id,role) values ($1,$2,'owner')`, [h1, pB])
} catch { b1 = true }
assert(b1, 'BORDA 1: segundo owner via INSERT é rejeitado')

// Borda 2: promover 2º membro (member) a owner via UPDATE deve ser REJEITADO
await db.query(`insert into household_members (household_id,profile_id,role) values ($1,$2,'member')`, [h1, pB])
let b2 = false
try {
  await db.query(`update household_members set role='owner' where household_id=$1 and profile_id=$2`, [h1, pB])
} catch { b2 = true }
assert(b2, 'BORDA 2: promover 2º membro a owner via UPDATE é rejeitado')

// Borda 3: owner em household DIFERENTE é PERMITIDO (parcial é por household_id)
const h2 = (await db.query(`insert into households (name) values ('Casa 2') returning id`)).rows[0].id
await db.query(`insert into household_members (household_id,profile_id,role) values ($1,$2,'owner')`, [h2, pB])
const owners2 = await db.query(`select count(*)::int as n from household_members where household_id=$1 and role='owner'`, [h2])
assert(owners2.rows[0].n === 1, 'BORDA 3: owner em outra household é permitido')

// Borda 4: transferência bem-feita (rebaixa antes de promover) mantém 1 owner
await db.query(`update household_members set role='admin' where household_id=$1 and profile_id=$2`, [h1, pA])
await db.query(`update household_members set role='owner' where household_id=$1 and profile_id=$2`, [h1, pB])
const owners1 = await db.query(`select count(*)::int as n from household_members where household_id=$1 and role='owner'`, [h1])
assert(owners1.rows[0].n === 1, 'BORDA 4: transferência (rebaixa→promove) mantém exatamente 1 owner')

console.log('7) DB-003 — sincronização de households.owner_id (trigger):')

// Após a promoção inicial, h2.owner_id deve apontar para pB (foi inserido owner em BORDA 3).
const oh2 = (await db.query(`select owner_id from households where id=$1`, [h2])).rows[0].owner_id
assert(oh2 === pB, 'owner_id de h2 sincronizado no INSERT de owner')

// Após a transferência em h1 (BORDA 4: A→admin, B→owner), h1.owner_id deve ser pB.
const oh1 = (await db.query(`select owner_id from households where id=$1`, [h1])).rows[0].owner_id
assert(oh1 === pB, 'owner_id de h1 sincronizado após transferência (via UPDATE)')

// Novo owner via INSERT em household nova sincroniza owner_id.
const pC = (await db.query(`insert into profiles (id,email) values (gen_random_uuid(),'c@f.app') returning id`)).rows[0].id
const h3 = (await db.query(`insert into households (name) values ('Casa 3') returning id`)).rows[0].id
await db.query(`insert into household_members (household_id,profile_id,role) values ($1,$2,'owner')`, [h3, pC])
const oh3 = (await db.query(`select owner_id from households where id=$1`, [h3])).rows[0].owner_id
assert(oh3 === pC, 'owner_id de nova household sincronizado no INSERT de owner')

console.log('8) DB-004 — RLS foundation (fail-closed, FORCE, membership):')

// FORCE ativo em cada tabela (não só ENABLE): pg_class.relforcerowsecurity = true.
for (const t of ['households', 'household_members', 'invitations']) {
  const r = await db.query(
    `select relrowsecurity as enabled, relforcerowsecurity as forced
     from pg_class where relname = $1`,
    [t],
  )
  assert(r.rows[0].enabled === true, `RLS ENABLE ativo em ${t}`)
  assert(r.rows[0].forced === true, `RLS FORCE ativo em ${t} (nem o dono escapa)`)
}

// is_household_member() com entradas inválidas → sempre false, nunca erro.
await db.query(`select set_config('app.current_user_id', '', false)`) // não autenticado
const unauth = await db.query(`select is_household_member(gen_random_uuid()) as r`)
assert(unauth.rows[0].r === false, 'is_household_member: auth.uid() nulo (não autenticado) → false')

await db.query(`select set_config('app.current_user_id', $1, false)`, [pA])
const hInexist = await db.query(`select is_household_member(gen_random_uuid()) as r`)
assert(hInexist.rows[0].r === false, 'is_household_member: household inexistente → false')

await db.query(`select set_config('app.current_user_id', gen_random_uuid()::text, false)`)
const pInexist = await db.query(`select is_household_member($1) as r`, [h1])
assert(pInexist.rows[0].r === false, 'is_household_member: profile inexistente/não-membro → false')

const hNull = await db.query(`select is_household_member(null) as r`)
assert(hNull.rows[0].r === false, 'is_household_member: household null → false')

// Role de teste NÃO-superusuário (superusuário ignora RLS). Precisa de USAGE no schema auth
// para que auth.uid() seja acessível dentro das policies (no Supabase, isso é dado ao role
// 'authenticated'; aqui é apenas o harness de teste).
await db.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='finora_test_user') then create role finora_test_user nologin; end if; end $$;`)
await db.query(`grant usage on schema auth to finora_test_user`)
await db.query(`grant execute on function auth.uid() to finora_test_user`)
await db.query(`grant execute on function is_household_member(uuid) to finora_test_user`)

// Fail-closed: tabela com RLS habilitado e SEM policy nega tudo (não "permite por acidente").
await db.query(`create table if not exists rls_nopolicy_probe (id uuid primary key default gen_random_uuid(), v int)`)
await db.query(`insert into rls_nopolicy_probe (v) values (1),(2)`)
await db.query(`alter table rls_nopolicy_probe enable row level security`)
await db.query(`alter table rls_nopolicy_probe force row level security`)
await db.query(`grant select on rls_nopolicy_probe to finora_test_user`)
await db.query(`set role finora_test_user`)
const noPolicy = await db.query(`select count(*)::int as n from rls_nopolicy_probe`)
assert(noPolicy.rows[0].n === 0, 'FAIL-CLOSED: RLS ligado sem policy → 0 linhas (nega tudo)')
await db.query(`reset role`)

// Teste A→B: usuário membro de h1 não enxerga registros de h3 (do qual não participa).
await db.query(`grant select on households, household_members to finora_test_user`)
await db.query(`set role finora_test_user`)
await db.query(`select set_config('app.current_user_id', $1, false)`, [pA]) // pA é membro de h1, não de h3
const visiveis = await db.query(`select id from households`)
const ids = visiveis.rows.map((r) => r.id)
assert(ids.includes(h1), 'A→B: usuário vê a própria household (h1)')
assert(!ids.includes(h3), 'A→B: usuário NÃO vê household de terceiros (h3)')
await db.query(`reset role`)
await db.query(`select set_config('app.current_user_id', '', false)`)

console.log('9) DB-004 — permissões por papel (convite: owner/admin sim, member não):')
// Cenário: h1 tem pB como owner (após transferência da BORDA 4) e pA como admin (rebaixado).
// Cria um member puro (pM) em h1 para testar que member NÃO pode convidar.
const pM = (await db.query(`insert into profiles (id,email) values (gen_random_uuid(),'m@f.app') returning id`)).rows[0].id
await db.query(`insert into household_members (household_id,profile_id,role) values ($1,$2,'member')`, [h1, pM])

await db.query(`grant insert, select on invitations to finora_test_user`)

// member NÃO pode inserir convite (with check has_household_role owner/admin falha)
await db.query(`set role finora_test_user`)
await db.query(`select set_config('app.current_user_id', $1, false)`, [pM])
let memberBlocked = false
try {
  await db.query(`insert into invitations (household_id,email,role) values ($1,'novo@f.app','member')`, [h1])
} catch { memberBlocked = true }
assert(memberBlocked, 'member NÃO pode convidar (invitations_write exige owner/admin)')
await db.query(`reset role`)

// admin (pA) PODE inserir convite
await db.query(`set role finora_test_user`)
await db.query(`select set_config('app.current_user_id', $1, false)`, [pA]) // pA é admin em h1
await db.query(`insert into invitations (household_id,email,role) values ($1,'ok@f.app','member')`, [h1])
const invCount = (await db.query(`select count(*)::int as n from invitations where household_id=$1`, [h1])).rows[0].n
assert(invCount >= 1, 'admin PODE convidar (invitations_write aceita owner/admin)')
await db.query(`reset role`)
await db.query(`select set_config('app.current_user_id', '', false)`)

console.log('10) DB-004 — RLS de profiles (cada um vê só o próprio):')
for (const t of ['profiles']) {
  const r = await db.query(`select relforcerowsecurity as forced from pg_class where relname=$1`, [t])
  assert(r.rows[0].forced === true, `RLS FORCE ativo em ${t}`)
}
await db.query(`grant select on profiles to finora_test_user`)
await db.query(`set role finora_test_user`)
await db.query(`select set_config('app.current_user_id', $1, false)`, [pA])
const meus = await db.query(`select id from profiles`)
const meusIds = meus.rows.map((r) => r.id)
assert(meusIds.length === 1 && meusIds[0] === pA, 'profiles: usuário vê apenas o próprio profile')
await db.query(`reset role`)
await db.query(`select set_config('app.current_user_id', '', false)`)

console.log('\nTodos os checks passaram. Migrações DB-001 a DB-004 válidas.')
