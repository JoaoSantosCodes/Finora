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

console.log('\nTodos os checks passaram. Migrações DB-001 e DB-002 válidas.')
await db.close()
