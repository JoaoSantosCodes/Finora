// Verificação pós-deploy contra um Postgres/Supabase REAL (não PGlite).
// Diferente de run-migration.mjs (validação estrutural local), este script
// confere invariantes que só existem no ambiente real — hoje: a FK profiles_id_fkey.
//
// Uso:
//   DATABASE_URL="postgres://..." node supabase/tests/verify-prod.mjs
//
// Falha com exit != 0 se uma verificação obrigatória não passar (uso em CI/pós-deploy).

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'ERRO: DATABASE_URL não definido. Este script roda contra o banco real ' +
      '(Supabase/Postgres), não contra PGlite. Defina DATABASE_URL e rode novamente.',
  )
  process.exit(2)
}

let Client
try {
  ;({ Client } = await import('pg'))
} catch {
  console.error(
    'ERRO: pacote "pg" não instalado. Rode:  npm i -D pg  e execute novamente.',
  )
  process.exit(2)
}

const client = new Client({ connectionString: url })
await client.connect()

let failures = 0
function check(cond, msg) {
  if (cond) {
    console.log('  ok —', msg)
  } else {
    console.error('  FALHA —', msg)
    failures++
  }
}

try {
  // DB-002: a FK profiles_id_fkey → auth.users(id) DEVE existir em produção.
  const fk = await client.query(
    `select 1 from pg_constraint where conname = 'profiles_id_fkey'`,
  )
  check(
    fk.rows.length === 1,
    'FK profiles_id_fkey existe (profiles.id → auth.users.id)',
  )

  // Sanidade: a tabela profiles existe.
  const tbl = await client.query(
    `select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'profiles'`,
  )
  check(tbl.rows.length === 1, 'tabela profiles existe')
} finally {
  await client.end()
}

if (failures > 0) {
  console.error(`\n${failures} verificação(ões) falharam. DB-002 NÃO está válida em produção.`)
  process.exit(1)
}
console.log('\nVerificações de produção passaram.')
