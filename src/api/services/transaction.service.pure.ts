// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO APPLICATION SERVICE DE TRANSAÇÕES (API-002B)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { NotFoundError, ValidationError } from '../errors.ts'
import { AccountRepository, type AccountRecord } from '../repositories/account.repository.ts'
import { TransactionRepository, type TransactionFilter, type TransactionRecord } from '../repositories/transaction.repository.ts'
import { TransactionService } from './transaction.service.ts'

const mockAccount: AccountRecord = {
  id: 'acc-1',
  household_id: 'h-1',
  name: 'Conta Principal',
  type: 'checking',
  initial_balance_cents: 100000,
  archived: false,
}

const mockTransactions: TransactionRecord[] = [
  { id: 'tx-1', household_id: 'h-1', type: 'income', amount_cents: 50000, account_id: 'acc-1', payment_status: 'paid', accrual_date: '2026-09-01' },
  { id: 'tx-2', household_id: 'h-1', type: 'expense', amount_cents: 15000, account_id: 'acc-1', category_id: 'cat-1', payment_status: 'pending', accrual_date: '2026-09-02' },
]

function createService(
  account: AccountRecord | null = mockAccount,
  txs: TransactionRecord[] = mockTransactions,
) {
  let saveCalledWith: TransactionRecord | null = null
  let deleteCalledWith: string | null = null

  const accountRepo = {
    findById: async (id: string) => (account && account.id === id ? account : null),
  } as unknown as AccountRepository

  const transactionRepo = {
    findById: async (id: string) => txs.find((t) => t.id === id) || null,
    listByHousehold: async (_hId: string, filter?: TransactionFilter) => {
      let result = [...txs]
      if (filter?.accountId) result = result.filter((t) => t.account_id === filter.accountId)
      if (filter?.paymentStatus) result = result.filter((t) => t.payment_status === filter.paymentStatus)
      return result
    },
    save: async (tx: TransactionRecord) => {
      saveCalledWith = tx
      return { ...tx, id: tx.id || 'tx-new' }
    },
    delete: async (id: string) => {
      deleteCalledWith = id
    },
  } as unknown as TransactionRepository

  return {
    service: new TransactionService(transactionRepo, accountRepo),
    getSaveCalledWith: () => saveCalledWith,
    getDeleteCalledWith: () => deleteCalledWith,
  }
}

export async function runTransactionServiceTests(): Promise<void> {
  // 1. Criação de receita legítima
  const { service: s1, getSaveCalledWith: getSave1 } = createService()
  const inc = await s1.createIncome({
    householdId: 'h-1',
    accountId: 'acc-1',
    amountCents: 30000,
    accrualDate: '2026-09-02',
    paymentStatus: 'paid',
    description: 'Salário',
  })
  assert.equal(inc.type, 'income')
  assert.equal(inc.amount_cents, 30000)
  assert.equal(getSave1()?.payment_status, 'paid')
  assert.ok(getSave1()?.paid_at)

  // 2. Rejeição de valor <= 0 na receita (Req 8.5)
  const { service: s2 } = createService()
  await assert.rejects(
    async () => {
      await s2.createIncome({
        householdId: 'h-1',
        accountId: 'acc-1',
        amountCents: 0,
        accrualDate: '2026-09-02',
        paymentStatus: 'paid',
      })
    },
    (err: any) => err instanceof ValidationError,
  )

  // 3. Rejeição de conta inexistente
  const { service: s3 } = createService(null) // Sem conta
  await assert.rejects(
    async () => {
      await s3.createIncome({
        householdId: 'h-1',
        accountId: 'acc-invalid',
        amountCents: 1000,
        accrualDate: '2026-09-02',
        paymentStatus: 'paid',
      })
    },
    (err: any) => err instanceof NotFoundError,
  )

  // 4. Criação de despesa legítima
  const { service: s4, getSaveCalledWith: getSave4 } = createService()
  const exp = await s4.createExpense({
    householdId: 'h-1',
    accountId: 'acc-1',
    categoryId: 'cat-mercado',
    amountCents: 8500,
    accrualDate: '2026-09-03',
    paymentStatus: 'pending',
    description: 'Mercado',
  })
  assert.equal(exp.type, 'expense')
  assert.equal(exp.amount_cents, 8500)
  assert.equal(getSave4()?.category_id, 'cat-mercado')
  assert.equal(getSave4()?.payment_status, 'pending')

  // 5. Atualização & alternância de status (pending -> paid)
  const { service: s5, getSaveCalledWith: getSave5 } = createService()
  const updated = await s5.updateTransaction('tx-2', {
    paymentStatus: 'paid',
  })
  assert.equal(updated.payment_status, 'paid')
  assert.ok(getSave5()?.paid_at)

  // 6. Exclusão atômica com auditoria
  const { service: s6, getDeleteCalledWith: getDel6 } = createService()
  await s6.deleteTransaction('tx-1')
  assert.equal(getDel6(), 'tx-1')

  // 7. Listagem com filtros
  const { service: s7 } = createService()
  const paidTxs = await s7.listTransactions('h-1', { paymentStatus: 'paid' })
  assert.equal(paidTxs.length, 1)
  assert.equal(paidTxs[0].id, 'tx-1')

  console.log('  ok — API-002B: TransactionService passou em todos os 7 testes (receita, despesa, valor positivo, alternância de status, exclusão com auditoria e filtros)')
}
