// Aplica as migrações de supabase/migrations no Postgres REAL (Supabase), em ordem.
// Uso:
//   DATABASE_URL="postgresql://..." node supabase/tests/apply-migrations.mjs
//
// - Lê DATABASE_URL (nunca hardcode de credencial).
// - Aplica cada .sql em ordem, dentro de UMA transação (rollback total se qualquer uma falhar).
// - As migrações são idempotentes (IF NOT EXISTS / DO $$ guards), então reexecutar é seguro.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('ERRO: DATABASE_URL não definido. Defina-o (ex.: em .env.local) e rode novamente.')
  process.exit(2)
}

let Client
try {
  ;({ Client } = await import('pg'))
} catch {
  console.error('ERRO: pacote "pg" não instalado. Rode: npm i -D pg')
  process.exit(2)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', 'migrations')
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

const client = new Client({ connectionString: url })
await client.connect()
console.log(`Conectado. Aplicando ${files.length} migração(ões) em transação...`)

try {
  await client.query('begin')
  for (const f of files) {
    process.stdout.write(`  → ${f} ... `)
    await client.query(readFileSync(join(migrationsDir, f), 'utf8'))
    console.log('ok')
  }
  await client.query('commit')
  console.log('\nCommit. Todas as migrações aplicadas com sucesso.')
} catch (e) {
  await client.query('rollback')
  console.error('\nFALHA — rollback executado. Nenhuma alteração persistida.')
  console.error(e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
