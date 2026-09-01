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

console.log('\nTodos os checks passaram. Migrações DB-001, DB-002 e DB-003 válidas.')
await db.close()
