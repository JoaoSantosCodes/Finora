// Teste de execução da migração DB-001 usando PGlite (Postgres em WASM, sem Docker).
// Valida: aplicação sem erro, idempotência (aplica 2x), e criação dos objetos esperados.
// Não toca em nenhum banco remoto. Ver design.md §Testing Strategy.

import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(__dirname, '..', 'migrations', '0001_extensions.sql')
const sql = readFileSync(migrationPath, 'utf8')

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

// pgcrypto é carregado como extensão contrib do PGlite (no Supabase real já vem disponível).
const db = new PGlite({ extensions: { pgcrypto } })

console.log('1) Aplicando a migração pela primeira vez...')
await db.exec(sql)
console.log('   aplicada sem erro.')

console.log('2) Reaplicando (deve ser idempotente)...')
await db.exec(sql)
console.log('   reaplicada sem erro (idempotente).')

console.log('3) Verificando objetos criados:')

// pgcrypto: gen_random_uuid() disponível
const uuid = await db.query('select gen_random_uuid() as id')
assert(typeof uuid.rows[0].id === 'string' && uuid.rows[0].id.length === 36,
  'gen_random_uuid() funciona (pgcrypto habilitado)')

// enums
for (const name of EXPECTED_ENUMS) {
  const r = await db.query('select 1 from pg_type where typname = $1', [name])
  assert(r.rows.length === 1, `enum "${name}" existe`)
}

// valores de um enum representativo
const roles = await db.query(
  `select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'member_role' order by e.enumsortorder`,
)
assert(
  roles.rows.map((r) => r.enumlabel).join(',') === 'owner,admin,member',
  'member_role tem valores owner,admin,member na ordem',
)

// função set_updated_at
const fn = await db.query(
  `select 1 from pg_proc where proname = 'set_updated_at'`,
)
assert(fn.rows.length === 1, 'função set_updated_at() existe')

console.log('\nTodos os checks passaram. Migração DB-001 válida.')
await db.close()
