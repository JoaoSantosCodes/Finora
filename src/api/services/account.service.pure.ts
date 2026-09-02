// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO APPLICATION SERVICE DE CONTAS (API-002A)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { AccountHasTransactionsError, PlanLimitExceededError, ValidationError } from '../errors.ts'
import { AccountRepository, type AccountRecord } from '../repositories/account.repository.ts'
import { TransactionRepository, type TransactionRecord } from '../repositories/transaction.repository.ts'
import { AccountService } from './account.service.ts'

const mockAccounts: AccountRecord[] = [
  { id: 'acc-1', household_id: 'h-1', name: 'Conta Corrente', type: 'checking', initial_balance_cents: 10000, archived: false },
  { id: 'acc-2', household_id: 'h-1', name: 'Poupança', type: 'savings', initial_balance_cents: 50000, archived: false },
  { id: 'acc-3', household_id: 'h-1', name: 'Carteira', type: 'wallet', initial_balance_cents: 2000, archived: false },
]

const mockTransactions: TransactionRecord[] = [
  { id: 'tx-1', household_id: 'h-1', type: 'income', amount_cents: 20000, account_id: 'acc-1', payment_status: 'paid', accrual_date: '2026-09-01' },
  { id: 'tx-2', household_id: 'h-1', type: 'expense', amount_cents: 5000, account_id: 'acc-1', payment_status: 'paid', accrual_date: '2026-09-02' },
  { id: 'tx-3', household_id: 'h-1', type: 'expense', amount_cents: 8000, account_id: 'acc-1', payment_status: 'pending', accrual_date: '2026-09-03' },
]

function createService(
  accounts: AccountRecord[] = mockAccounts,
  transactions: TransactionRecord[] = mockTransactions,
) {
  let saveCalledWith: AccountRecord | null = null
  let archiveCalledWith: string | null = null
  let deleteCalledWith: string | null = null

  const accountRepo = {
    findById: async (id: string) => accounts.find((a) => a.id === id) || null,
    listByHousehold: async () => [...accounts],
    save: async (acc: AccountRecord) => {
      saveCalledWith = acc
      return { ...acc, id: acc.id || 'acc-new' }
    },
    archive: async (id: string) => {
      archiveCalledWith = id
    },
    delete: async (id: string) => {
      deleteCalledWith = id
    },
  } as unknown as AccountRepository

  const transactionRepo = {
    listByHousehold: async (_hId: string, filter?: { accountId?: string }) => {
      if (filter?.accountId) {
        return transactions.filter((t) => t.account_id === filter.accountId)
      }
      return [...transactions]
    },
  } as unknown as TransactionRepository

  return {
    service: new AccountService(accountRepo, transactionRepo),
    getSaveCalledWith: () => saveCalledWith,
    getArchiveCalledWith: () => archiveCalledWith,
    getDeleteCalledWith: () => deleteCalledWith,
  }
}

export async function runAccountServiceTests(): Promise<void> {
  // 1. Criação com sucesso dentro do limite
  const { service: s1, getSaveCalledWith: getSave1 } = createService([mockAccounts[0]])
  const created = await s1.createAccount({
    householdId: 'h-1',
    name: 'Carteira Nova',
    type: 'wallet',
    initialBalanceCents: 5000,
    planId: 'free',
  })
  assert.equal(created.name, 'Carteira Nova')
  assert.deepEqual(getSave1(), {
    household_id: 'h-1',
    name: 'Carteira Nova',
    type: 'wallet',
    initial_balance_cents: 5000,
    archived: false,
  })

  // 2. Bloqueio por limite do plano
  const { service: s2 } = createService(mockAccounts)
  await assert.rejects(
    async () => {
      await s2.createAccount({
        householdId: 'h-1',
        name: 'Quarta Conta',
        type: 'checking',
        planId: 'free',
      })
    },
    (err: any) => err instanceof PlanLimitExceededError,
  )

  // 3. Rejeição de nome em branco
  const { service: s3 } = createService()
  await assert.rejects(
    async () => {
      await s3.createAccount({
        householdId: 'h-1',
        name: '   ',
        type: 'checking',
      })
    },
    (err: any) => err instanceof ValidationError,
  )

  // 4. Recálculo de saldo via Financial Core
  const { service: s4 } = createService()
  const accWithBalance = await s4.getAccountWithBalance('acc-1')
  assert.equal(accWithBalance.currentBalanceCents, 25000)

  // 5. Rejeição de exclusão com transações
  const { service: s5, getDeleteCalledWith: getDel5 } = createService(mockAccounts, mockTransactions)
  await assert.rejects(
    async () => {
      await s5.deleteAccount('acc-1')
    },
    (err: any) => err instanceof AccountHasTransactionsError,
  )
  assert.equal(getDel5(), null)

  // 6. Exclusão legítima sem transações
  const { service: s6, getDeleteCalledWith: getDel6 } = createService(mockAccounts, [])
  await s6.deleteAccount('acc-1')
  assert.equal(getDel6(), 'acc-1')

  // 7. Arquivamento de conta
  const { service: s7, getArchiveCalledWith: getArch7 } = createService()
  await s7.archiveAccount('acc-1')
  assert.equal(getArch7(), 'acc-1')

  console.log('  ok — API-002A: AccountService passou em todos os 7 testes (criação, limite de plano, saldo, exclusão negada e arquivamento)')
}
