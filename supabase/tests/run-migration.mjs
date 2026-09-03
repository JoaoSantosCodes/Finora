// Teste de execução das migrações usando PGlite (Postgres em WASM, sem Docker).
// Aplica TODAS as migrações de supabase/migrations em ordem, valida idempotência
// (aplica 2x) e verifica os objetos esperados. Não toca em nenhum banco remoto.
// Ver design.md §Testing Strategy.

import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { accountBalance } from '../../packages/core/src/transactions.ts'

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

console.log('1) Configurando papéis do harness e aplicando migrações pela primeira vez...')
await db.exec(`
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
`)
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

console.log('11) DB-005 — Schema Financeiro (7 tabelas, RLS FORCE, constraints, triggers e permissões):')
const finTables = ['accounts', 'categories', 'credit_cards', 'credit_card_invoices', 'installment_plans', 'transactions', 'installments']

// 11.1 Verificação de existência e RLS ENABLE + FORCE nas 7 tabelas
for (const t of finTables) {
  const r = await db.query(`select relrowsecurity as enabled, relforcerowsecurity as forced from pg_class where relname=$1 and relnamespace='public'::regnamespace`, [t])
  assert(r.rows.length === 1, `tabela ${t} existe`)
  assert(r.rows[0].enabled === true, `RLS ENABLE ativo em ${t}`)
  assert(r.rows[0].forced === true, `RLS FORCE ativo em ${t}`)
}

// 11.2 Testar triggers de sincronização de household_id em credit_card_invoices e installments
const acc1 = (await db.query(`insert into accounts (household_id, name, type) values ($1, 'Conta Corrente', 'checking') returning id`, [h1])).rows[0].id
const cat1 = (await db.query(`insert into categories (household_id, name, classification) values ($1, 'Mercado', 'Variável') returning id`, [h1])).rows[0].id
const card1 = (await db.query(`insert into credit_cards (household_id, name, credit_limit_cents, closing_day, due_day) values ($1, 'Cartão Itaú', 500000, 20, 30) returning id`, [h1])).rows[0].id

const inv1 = (await db.query(`insert into credit_card_invoices (credit_card_id, cycle, due_date) values ($1, '2026-09-01', '2026-09-30') returning id, household_id`, [card1])).rows[0]
assert(inv1.household_id === h1, 'trigger sync_invoice_household_id preencheu household_id em credit_card_invoices')

const plan1 = (await db.query(`insert into installment_plans (household_id, total_amount_cents, installments_count) values ($1, 120000, 12) returning id`, [h1])).rows[0].id

const inst1 = (await db.query(`insert into installments (installment_plan_id, number, amount_cents, accrual_date, invoice_id) values ($1, 1, 10000, '2026-09-01', $2) returning id, household_id`, [plan1, inv1.id])).rows[0]
assert(inst1.household_id === h1, 'trigger sync_installment_household_id preencheu household_id em installments via invoice_id')

// 11.3 Testar CHECK constraints
// CHECK XOR em installments (não pode ter invoice_id e transaction_id simultaneamente, nem ambos nulos)
let xorBlocked = false
try {
  await db.query(`insert into installments (household_id, installment_plan_id, number, amount_cents, accrual_date) values ($1, $2, 2, 10000, '2026-09-01')`, [h1, plan1])
} catch { xorBlocked = true }
assert(xorBlocked, 'installments CHECK XOR rejeita parcela sem invoice_id nem transaction_id')

// CHECK de transferência (type = transfer exige counter_account_id <> account_id; non-transfer exige counter_account_id nulo)
let transferBlocked = false
try {
  await db.query(`insert into transactions (household_id, type, amount_cents, account_id, accrual_date) values ($1, 'transfer', 5000, $2, '2026-09-01')`, [h1, acc1])
} catch { transferBlocked = true }
assert(transferBlocked, 'transactions CHECK de transferência rejeita type transfer sem counter_account_id')

// 11.4 Testar índices únicos (case-insensitive em categories e external_ref por conta)
let catCaseBlocked = false
try {
  await db.query(`insert into categories (household_id, name) values ($1, 'mercado')`, [h1])
} catch { catCaseBlocked = true }
assert(catCaseBlocked, 'categories índice único case-insensitive rejeita "mercado" duplicado')

const tx1 = (await db.query(`insert into transactions (household_id, type, amount_cents, account_id, accrual_date, external_ref) values ($1, 'expense', 1500, $2, '2026-09-01', 'EXT-100') returning id`, [h1, acc1])).rows[0].id
assert(tx1 !== null, 'transação com external_ref inserida com sucesso')

let extRefBlocked = false
try {
  await db.query(`insert into transactions (household_id, type, amount_cents, account_id, accrual_date, external_ref) values ($1, 'expense', 2000, $2, '2026-09-01', 'EXT-100')`, [h1, acc1])
} catch { extRefBlocked = true }
assert(extRefBlocked, 'transactions external_ref duplicado na mesma conta é rejeitado')

// 11.5 Testar permissões por papel (member pode criar/editar lançamentos, mas NÃO pode deletar accounts)
await db.query(`grant select, insert, update, delete on accounts, categories, credit_cards, credit_card_invoices, installment_plans, transactions, installments to finora_test_user`)
await db.query(`set role finora_test_user`)
await db.query(`select set_config('app.current_user_id', $1, false)`, [pM]) // pM é member em h1

// member PODE criar lançamento
await db.query(`insert into transactions (household_id, type, amount_cents, account_id, accrual_date) values ($1, 'expense', 500, $2, '2026-09-01')`, [h1, acc1])
const txMemberCount = (await db.query(`select count(*)::int as n from transactions where household_id=$1`, [h1])).rows[0].n
assert(txMemberCount >= 2, 'member PODE criar lançamento no orçamento compartilhado')

// member NÃO pode deletar conta bancária (accounts_delete exige owner/admin -> 0 linhas afetadas por RLS)
const delRes = await db.query(`delete from accounts where id=$1`, [acc1])
assert(delRes.rowCount === 0, 'member NÃO pode deletar conta bancária (0 linhas afetadas por RLS)')

await db.query(`reset role`)
await db.query(`select set_config('app.current_user_id', '', false)`)

// 11.6 Testar validação de cross-household mismatch (account_id de outro household no insert de transaction)
const accH3 = (await db.query(`insert into accounts (household_id, name, type) values ($1, 'Conta H3', 'checking') returning id`, [h3])).rows[0].id
let crossHouseholdBlocked = false
try {
  await db.query(`insert into transactions (household_id, type, amount_cents, account_id, accrual_date) values ($1, 'expense', 1000, $2, '2026-09-01')`, [h1, accH3])
} catch { crossHouseholdBlocked = true }
assert(crossHouseholdBlocked, 'trigger validate_transaction_household_id bloqueia transação com account_id de outro household')

await db.query(`reset role`)
await db.query(`select set_config('app.current_user_id', '', false)`)

console.log('12) DB-006 — Schema de Billing, Sync & Audit (tabelas, RLS, imutabilidade e seeds):')
const billingTables = ['plans', 'plan_features', 'subscriptions', 'subscription_events', 'sync_mutations', 'audit_logs']

// 12.1 Verificar existência das tabelas
for (const t of billingTables) {
  const r = await db.query(`select 1 from pg_class where relname=$1 and relnamespace='public'::regnamespace`, [t])
  assert(r.rows.length === 1, `tabela ${t} existe`)
}

// 12.2 Verificar RLS ENABLE + FORCE nas tabelas de tenant
for (const t of ['subscriptions', 'subscription_events', 'sync_mutations', 'audit_logs']) {
  const r = await db.query(`select relrowsecurity as enabled, relforcerowsecurity as forced from pg_class where relname=$1 and relnamespace='public'::regnamespace`, [t])
  assert(r.rows[0].enabled === true, `RLS ENABLE ativo em ${t}`)
  assert(r.rows[0].forced === true, `RLS FORCE ativo em ${t}`)
}

// 12.3 Verificar seeds dos planos
const freePlan = (await db.query(`select id, price_cents from plans where id='free'`)).rows[0]
assert(freePlan && Number(freePlan.price_cents) === 0, 'seed do plano Free existe')

const proPlan = (await db.query(`select id, price_cents from plans where id='pro'`)).rows[0]
assert(proPlan && Number(proPlan.price_cents) === 2990, 'seed do plano Pro existe')

const familyPlan = (await db.query(`select id, price_cents from plans where id='family'`)).rows[0]
assert(familyPlan && Number(familyPlan.price_cents) === 4990, 'seed do plano Família existe')

const featCount = (await db.query(`select count(*)::int as n from plan_features`)).rows[0].n
assert(featCount >= 15, 'seeds das plan_features foram inseridas com sucesso')

// 12.4 Testar UNIQUE (plan_id, feature_key) em plan_features
let featDuplicateBlocked = false
try {
  await db.query(`insert into plan_features (plan_id, feature_key, limit_value) values ('free', 'max_accounts', 5)`)
} catch { featDuplicateBlocked = true }
assert(featDuplicateBlocked, 'plan_features UNIQUE (plan_id, feature_key) rejeita chave duplicada')

// 12.5 Testar UNIQUE (household_id, client_mutation_id) em sync_mutations
await db.query(`insert into sync_mutations (household_id, client_mutation_id, result_ref) values ($1, 'MUT-001', 'OK')`, [h1])
let syncDuplicateBlocked = false
try {
  await db.query(`insert into sync_mutations (household_id, client_mutation_id, result_ref) values ($1, 'MUT-001', 'OK')`, [h1])
} catch { syncDuplicateBlocked = true }
assert(syncDuplicateBlocked, 'sync_mutations UNIQUE (household_id, client_mutation_id) rejeita reenvio duplicado')

// 12.6 Testar Imutabilidade Append-Only de audit_logs por RLS (UPDATE e DELETE retornam 0 linhas afetadas)
// Inserir subscription e subscription_event via superuser (webhook/service_role)
const sub1 = (await db.query(`insert into subscriptions (household_id, plan_id) values ($1, 'pro') returning id`, [h1])).rows[0].id

// Testar que o trigger força a derivação imutável do household_id a partir do subscription_id
const event1 = (await db.query(`insert into subscription_events (household_id, subscription_id, event_type) values ($1, $2, 'INVOICE_PAID') returning id, household_id`, [h3, sub1])).rows[0]
assert(event1.household_id === h1, 'trigger sync_subscription_event_household_id sobrescreveu household_id de entrada e derivou de subscriptions.household_id')

const auditId = (await db.query(`insert into audit_logs (household_id, actor_id, operation, entity) values ($1, $2, 'INSERT', 'transactions') returning id`, [h1, pM])).rows[0].id

await db.query(`grant authenticated to finora_test_user`)
await db.query(`grant select, insert, update, delete on sync_mutations, audit_logs, subscriptions, subscription_events to finora_test_user`)
await db.query(`set role finora_test_user`)
await db.query(`select set_config('app.current_user_id', $1, false)`, [pM]) // pM é member em h1

// member PODE ler e inserir em audit_logs
const auditRead = await db.query(`select id from audit_logs where id=$1`, [auditId])
assert(auditRead.rows.length === 1, 'member PODE ler audit_logs do seu household')

// member PODE ler subscription_events do seu household
const subEvRead = await db.query(`select id from subscription_events where id=$1`, [event1.id])
assert(subEvRead.rows.length === 1, 'member PODE ler subscription_events do seu household')

// member NÃO PODE forjar inserção em subscription_events (eventos de cobrança são restritos a webhook/service_role)
let subEvInsertBlocked = false
try {
  await db.query(`insert into subscription_events (subscription_id, event_type) values ($1, 'FAKE_PAID')`, [sub1])
} catch { subEvInsertBlocked = true }
assert(subEvInsertBlocked, 'member NÃO pode inserir subscription_events (restrito a webhook/service_role)')

await db.query(`insert into audit_logs (household_id, actor_id, operation, entity) values ($1, $2, 'UPDATE', 'accounts')`, [h1, pM])

// member NÃO PODE atualizar audit_logs (0 linhas afetadas por falta de policy de UPDATE + FORCE RLS)
const auditUpd = await db.query(`update audit_logs set operation='HACKED' where id=$1`, [auditId])
assert(auditUpd.rowCount === 0, 'audit_logs UPDATE por membro retorna 0 linhas afetadas (RLS imutável)')

// member NÃO PODE deletar audit_logs (0 linhas afetadas por falta de policy de DELETE + FORCE RLS)
const auditDel = await db.query(`delete from audit_logs where id=$1`, [auditId])
assert(auditDel.rowCount === 0, 'audit_logs DELETE por membro retorna 0 linhas afetadas (RLS imutável)')

await db.query(`reset role`)
await db.query(`select set_config('app.current_user_id', '', false)`)

// ─────────────────────────────────────────────────────────────────────────────
// 13) AUTH-001 — Autenticação, Triggers Atômicos e Rate Limiting
// ─────────────────────────────────────────────────────────────────────────────

// Garantir schema auth.users no PGlite para testes do trigger
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    raw_user_meta_data jsonb,
    created_at timestamptz not null default now()
  );
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
`)

// 13.1 Testar cadastro atômico: INSERT em auth.users cria Profile + Household + Owner
const uAuthId = 'a1111111-1111-1111-1111-111111111111'
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'newuser@finora.test', '{"display_name":"Novo Usuario"}')`, [uAuthId])

const createdProf = await db.query(`select email, display_name from profiles where id=$1`, [uAuthId])
assert(createdProf.rows.length === 1, 'trigger handle_new_user() criou profile em profiles')
assert(createdProf.rows[0].email === 'newuser@finora.test', 'profile email salvo corretamente')

const createdMembership = await db.query(`select household_id, role from household_members where profile_id=$1`, [uAuthId])
assert(createdMembership.rows.length === 1, 'trigger handle_new_user() criou household_member')
assert(createdMembership.rows[0].role === 'owner', 'novo usuario e owner do seu household inicial')

// 13.2 Testar pre-check de e-mail existente (evita exceção no colisão de UNIQUE email)
const uAuthId2 = 'a2222222-2222-2222-2222-222222222222'
let emailConflictError = false
try {
  await db.query(`insert into auth.users (id, email) values ($1, 'NEWUSER@FINORA.TEST')`, [uAuthId2])
} catch (e) {
  emailConflictError = true
}
assert(!emailConflictError, 'trigger handle_new_user() NAO lancou excecao SQL ao detectar e-mail ja existente')

const fallbackLog = await db.query(`select operation from audit_logs where operation='OAUTH_LINKING_FALLBACK'`)
assert(fallbackLog.rows.length === 1, 'trigger registrou OAUTH_LINKING_FALLBACK em audit_logs para concordoes')

// 13.3 Testar RLS FORCE em auth_login_attempts (cliente comum nao pode ler/escrever)
await db.query(`grant select, insert, update, delete on auth_login_attempts to finora_test_user`)
await db.query(`set role finora_test_user`)

const clientAttemptRead = await db.query(`select * from auth_login_attempts`)
assert(clientAttemptRead.rows.length === 0, 'auth_login_attempts RLS FORCE bloqueia leitura por client (0 linhas)')

await db.query(`reset role`)

// ─────────────────────────────────────────────────────────────────────────────
// 14) API-001 — Repository Foundation, RPCs Atômicas & Security Hardening
// ─────────────────────────────────────────────────────────────────────────────

// 14.1 Teste de rpc_transfer_funds com falha (rollback atômico)
const accSource = (await db.query(`insert into accounts (household_id, name, type, initial_balance_cents) values ($1, 'Conta Origem', 'checking', 100000) returning id`, [h1])).rows[0].id
const accDestOther = (await db.query(`insert into accounts (household_id, name, type, initial_balance_cents) values ($1, 'Conta Invasora', 'checking', 50000) returning id`, [h3])).rows[0].id

await db.query(`set role finora_test_user`)
await db.query(`select set_config('app.current_user_id', $1, false)`, [pM]) // pM é member em h1

// Tentativa de transferir da conta h1 para a conta h3 (deve falhar por RLS / validação de household)
let transferFailed = false
try {
  await db.query(`select rpc_transfer_funds($1, $2, $3, 10000, '2026-09-01'::date, 'Transferência Ilegal')`, [h1, accSource, accDestOther])
} catch (e) {
  transferFailed = true
}
assert(transferFailed, 'rpc_transfer_funds bloqueou e lançou exceção ao tentar transferir para conta de outro household')

// Confirmar que nenhuma transação foi criada (rollback atômico)
const txOrphan = await db.query(`select id from transactions where account_id=$1`, [accSource])
assert(txOrphan.rows.length === 0, 'ROLLBACK ATÔMICO: conta origem não gerou transação parcial')

// 14.1.2 Teste de atualização correta dos saldos de ambos os lados da transferência (origem e destino)
const accTargetLocal = (await db.query(`insert into accounts (household_id, name, type, initial_balance_cents) values ($1, 'Conta Destino Válida', 'checking', 20000) returning id`, [h1])).rows[0].id

const transferOkRes = (await db.query(`select rpc_transfer_funds($1, $2, $3, 30000, '2026-09-01'::date, 'Transferência Válida') as res`, [h1, accSource, accTargetLocal])).rows[0].res
assert(transferOkRes.success === true, 'rpc_transfer_funds executou transferência legítima entre contas da mesma household')

// Buscar transações para calcular saldo via Financial Core accountBalance()
const allTxsRows = (await db.query(`select id, type, amount_cents as "amountCents", account_id as "accountId", counter_account_id as "counterAccountId", payment_status as "paymentStatus", accrual_date as "accrualDate" from transactions where household_id=$1`, [h1])).rows

const sourceBalance = accountBalance({ id: accSource, initialBalanceCents: 100000 }, allTxsRows)
const targetBalance = accountBalance({ id: accTargetLocal, initialBalanceCents: 20000 }, allTxsRows)

assert(sourceBalance === 70000, 'CONSERVAÇÃO DE SALDO: conta de origem foi debitada em 30.000 (100.000 -> 70.000)')
assert(targetBalance === 50000, 'CONSERVAÇÃO DE SALDO: conta de destino foi creditada em 30.000 (20.000 -> 50.000)')

// 14.2 Teste de rpc_create_installment_transaction (criação atômica de plano + parcelas)
const cat1Rpc = (await db.query(`select id from categories where household_id=$1 limit 1`, [h1])).rows[0].id
const rpcInstRes = (await db.query(`select rpc_create_installment_transaction($1, $2, $3, 30000, 3, '2026-09-01'::date, 'Notebook 3x') as res`, [h1, accSource, cat1Rpc])).rows[0].res
assert(rpcInstRes.success === true, 'rpc_create_installment_transaction criou parcelamento com sucesso')

const instCount = await db.query(`select count(*)::int as n from installments where installment_plan_id=$1`, [rpcInstRes.installment_plan_id])
assert(instCount.rows[0].n === 3, '3 parcelas foram criadas atomicamente em installments')

// 14.3 Teste de rpc_delete_transaction_with_audit (deleção e auditoria em 1 transação)
const delResRpc = (await db.query(`select rpc_delete_transaction_with_audit($1) as res`, [rpcInstRes.transaction_id])).rows[0].res
assert(delResRpc.success === true, 'rpc_delete_transaction_with_audit executou com sucesso')

const deletedTxCheck = await db.query(`select id from transactions where id=$1`, [rpcInstRes.transaction_id])
assert(deletedTxCheck.rows.length === 0, 'transação foi excluída do banco')

const auditDelCheck = await db.query(`select operation from audit_logs where metadata->>'transaction_id' = $1`, [rpcInstRes.transaction_id])
assert(auditDelCheck.rows.length === 1 && auditDelCheck.rows[0].operation === 'DELETE', 'registro DELETE foi inserido em audit_logs na mesma transação')

// 14.4 Teste de Hardening: Usuário não-autenticado (anon) NÃO pode executar RPCs
await db.query(`reset role`)
await db.query(`select set_config('app.current_user_id', '', false)`)

let anonRpcBlocked = false
try {
  await db.query(`set role anon`)
  await db.query(`select rpc_transfer_funds($1, $2, $3, 1000, '2026-09-01'::date, 'Anon Test')`, [h1, accSource, accSource])
} catch {
  anonRpcBlocked = true
}
assert(anonRpcBlocked, 'HARDENING: papel anon/public é impedido de executar RPCs por falta de GRANT')

await db.query(`reset role`)

// 14.5 REGRESSÃO: Membro comum autenticado executa SELECT em RLS após migração 0008
await db.query(`set role finora_test_user`)
await db.query(`select set_config('app.current_user_id', $1, false)`, [pM]) // pM é membro em h1

const post0008Households = await db.query(`select id, name from households where id = $1`, [h1])
assert(post0008Households.rows.length === 1 && post0008Households.rows[0].id === h1, 'REGRESSÃO RLS: membro comum lê a própria household via is_household_member() após migração 0008')

const post0008Txs = await db.query(`select id from transactions where household_id = $1`, [h1])
assert(post0008Txs.rows.length > 0, 'REGRESSÃO RLS: membro comum lê transações do seu household via is_household_member() após migração 0008')

await db.query(`reset role`)
await db.query(`select set_config('app.current_user_id', '', false)`)

const { runAccountServiceTests } = await import('../../src/api/services/account.service.pure.ts')
await runAccountServiceTests()

const { runTransactionServiceTests } = await import('../../src/api/services/transaction.service.pure.ts')
await runTransactionServiceTests()

const { runTransferServiceTests } = await import('../../src/api/services/transfer.service.pure.ts')
await runTransferServiceTests()

const { runInstallmentServiceTests } = await import('../../src/api/services/installment.service.pure.ts')
await runInstallmentServiceTests()

const { runCreditCardServiceTests } = await import('../../src/api/services/credit_card.service.pure.ts')
await runCreditCardServiceTests()

const { runCategoryServiceTests } = await import('../../src/api/services/category.service.pure.ts')
await runCategoryServiceTests()

console.log('\nTodos os checks passaram. Migrações DB-001 a API-001 (0008), API-002A, API-002B, API-002C, API-002D, API-002E e API-002F (Category Service) válidas.')
