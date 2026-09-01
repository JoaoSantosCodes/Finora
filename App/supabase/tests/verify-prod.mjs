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
  // ── DB-002: FK profiles_id_fkey → auth.users(id) (só existe no Supabase real) ──
  const fk = await client.query(`select 1 from pg_constraint where conname = 'profiles_id_fkey'`)
  check(fk.rows.length === 1, 'DB-002: FK profiles_id_fkey existe (profiles.id → auth.users.id)')

  // ── Tabelas da fundação existem ──
  for (const t of ['profiles', 'households', 'household_members', 'invitations']) {
    const r = await client.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
      [t],
    )
    check(r.rows.length === 1, `tabela ${t} existe`)
  }

  // ── DB-004: RLS ENABLE + FORCE em todas as tabelas com dado sensível ──
  for (const t of ['profiles', 'households', 'household_members', 'invitations']) {
    const r = await client.query(
      `select relrowsecurity as enabled, relforcerowsecurity as forced
       from pg_class where relname = $1 and relnamespace = 'public'::regnamespace`,
      [t],
    )
    check(r.rows[0]?.enabled === true, `RLS ENABLE ativo em ${t}`)
    check(r.rows[0]?.forced === true, `RLS FORCE ativo em ${t}`)
  }

  // ── DB-004: policies esperadas presentes (fail-closed depende de haver policy correta) ──
  const expectedPolicies = [
    ['households', 'households_select'],
    ['households', 'households_write'],
    ['household_members', 'household_members_select'],
    ['household_members', 'household_members_write'],
    ['invitations', 'invitations_select'],
    ['invitations', 'invitations_write'],
    ['profiles', 'profiles_select_self'],
    ['profiles', 'profiles_update_self'],
  ]
  for (const [tbl, pol] of expectedPolicies) {
    const r = await client.query(
      `select 1 from pg_policies where schemaname='public' and tablename=$1 and policyname=$2`,
      [tbl, pol],
    )
    check(r.rows.length === 1, `policy ${pol} em ${tbl} existe`)
  }

  // ── DB-004: funções de autorização presentes ──
  for (const fn of ['is_household_member', 'has_household_role']) {
    const r = await client.query(`select 1 from pg_proc where proname = $1`, [fn])
    check(r.rows.length === 1, `função ${fn}() existe`)
  }

  // ── DB-003: índice único parcial de "um owner por household" ──
  const ownerIdx = await client.query(`select 1 from pg_indexes where indexname = 'household_one_owner'`)
  check(ownerIdx.rows.length === 1, 'DB-003: índice household_one_owner existe (um owner por household)')
  // ── DB-005: Tabelas do schema financeiro existem ──
  const finTables = [
    'accounts',
    'categories',
    'credit_cards',
    'credit_card_invoices',
    'installment_plans',
    'transactions',
    'installments',
  ]
  for (const t of finTables) {
    const r = await client.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
      [t],
    )
    check(r.rows.length === 1, `DB-005: tabela financeiras ${t} existe`)
  }

  // ── DB-005: RLS ENABLE + FORCE nas 7 tabelas financeiras ──
  for (const t of finTables) {
    const r = await client.query(
      `select relrowsecurity as enabled, relforcerowsecurity as forced
       from pg_class where relname = $1 and relnamespace = 'public'::regnamespace`,
      [t],
    )
    check(r.rows[0]?.enabled === true, `DB-005: RLS ENABLE ativo em ${t}`)
    check(r.rows[0]?.forced === true, `DB-005: RLS FORCE ativo em ${t}`)
  }

  // ── DB-005: Índices únicos do schema financeiro ──
  const expectedIndexes = [
    'categories_household_name_key',
    'credit_card_invoices_card_cycle_key',
    'transactions_external_ref_key',
  ]
  for (const idx of expectedIndexes) {
    const r = await client.query(`select 1 from pg_indexes where indexname = $1`, [idx])
    check(r.rows.length === 1, `DB-005: índice único ${idx} existe`)
  }

  // ── DB-005: Funções de trigger financeiras ──
  const expectedTriggers = [
    'sync_invoice_household_id',
    'sync_installment_household_id',
    'validate_transaction_household_id',
  ]
  for (const fn of expectedTriggers) {
    const r = await client.query(`select 1 from pg_proc where proname = $1`, [fn])
    check(r.rows.length === 1, `DB-005: função de trigger ${fn}() existe`)
  }

  // ── DB-006: Tabelas de Billing, Sync & Audit ──
  const billingTables = ['plans', 'plan_features', 'subscriptions', 'subscription_events', 'sync_mutations', 'audit_logs']
  for (const t of billingTables) {
    const r = await client.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
      [t],
    )
    check(r.rows.length === 1, `DB-006: tabela ${t} existe`)
  }

  // ── DB-006: RLS ENABLE + FORCE nas tabelas de tenant ──
  for (const t of ['subscriptions', 'subscription_events', 'sync_mutations', 'audit_logs']) {
    const r = await client.query(
      `select relrowsecurity as enabled, relforcerowsecurity as forced
       from pg_class where relname = $1 and relnamespace = 'public'::regnamespace`,
      [t],
    )
    check(r.rows[0]?.enabled === true, `DB-006: RLS ENABLE ativo em ${t}`)
    check(r.rows[0]?.forced === true, `DB-006: RLS FORCE ativo em ${t}`)
  }

  // ── DB-006: Policies de RLS em audit_logs (apenas select/insert, zero update/delete) ──
  const auditPolicies = ['audit_logs_select', 'audit_logs_insert']
  for (const pol of auditPolicies) {
    const r = await client.query(
      `select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname=$1`,
      [pol],
    )
    check(r.rows.length === 1, `DB-006: policy ${pol} existe em audit_logs`)
  }
  const auditUpdDelPol = await client.query(
    `select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and cmd in ('UPDATE', 'DELETE')`,
  )
  check(auditUpdDelPol.rows.length === 0, 'DB-006: audit_logs tem ZERO políticas de UPDATE/DELETE (append-only imutável)')

  // ── DB-006: Seeds de planos ──
  const plansSeed = await client.query(`select count(*)::int as n from plans where id in ('free', 'pro', 'family')`)
  check(plansSeed.rows[0]?.n === 3, 'DB-006: seeds dos 3 planos (free, pro, family) existem')
} finally {
  await client.end()
}

if (failures > 0) {
  console.error(`\n${failures} verificação(ões) falharam. Validação de produção NÃO passou.`)
  process.exit(1)
}
console.log('\nDB-006 & GATE 1: todas as verificações de produção passaram.')
