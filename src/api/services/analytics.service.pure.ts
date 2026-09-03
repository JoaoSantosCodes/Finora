// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO APPLICATION SERVICE DE ANALYTICS (API-002J)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { AccountRepository, type AccountRecord } from '../repositories/account.repository.ts'
import { CategoryRepository, type CategoryRecord } from '../repositories/category.repository.ts'
import { TransactionRepository, type TransactionRecord } from '../repositories/transaction.repository.ts'
import { AnalyticsService } from './analytics.service.ts'

const mockAccounts: AccountRecord[] = [
  { id: 'acc-1', household_id: 'h-1', name: 'Conta Principal', type: 'checking', initial_balance_cents: 100000, archived: false },
  { id: 'acc-2', household_id: 'h-1', name: 'Poupança', type: 'savings', initial_balance_cents: 50000, archived: false },
]

const mockCategories: CategoryRecord[] = [
  { id: 'cat-mercado', household_id: 'h-1', name: 'Mercado', color: '#ff0000' },
  { id: 'cat-lazer', household_id: 'h-1', name: 'Lazer', color: '#00ff00' },
]

const mockTransactions: TransactionRecord[] = [
  // Mês anterior (2026-08)
  { id: 'tx-prev-1', household_id: 'h-1', type: 'expense', amount_cents: 20000, account_id: 'acc-1', category_id: 'cat-mercado', payment_status: 'paid', accrual_date: '2026-08-15' },

  // Mês atual (2026-09)
  { id: 'tx-1', household_id: 'h-1', type: 'income', amount_cents: 500000, account_id: 'acc-1', payment_status: 'paid', accrual_date: '2026-09-01' },
  { id: 'tx-2', household_id: 'h-1', type: 'expense', amount_cents: 30000, account_id: 'acc-1', category_id: 'cat-mercado', payment_status: 'paid', accrual_date: '2026-09-05' },
  { id: 'tx-3', household_id: 'h-1', type: 'expense', amount_cents: 10000, account_id: 'acc-1', category_id: 'cat-lazer', payment_status: 'pending', accrual_date: '2026-09-10' },

  // TRANSFERÊNCIA: Deve ser ESTRITAMENTE EXCLUÍDA dos totais de receita e despesa (Req 15.4)
  { id: 'tx-transfer-1', household_id: 'h-1', type: 'transfer', amount_cents: 15000, account_id: 'acc-1', counter_account_id: 'acc-2', payment_status: 'paid', accrual_date: '2026-09-12' },
]

function createService(
  accounts: AccountRecord[] = mockAccounts,
  categories: CategoryRecord[] = mockCategories,
  txs: TransactionRecord[] = mockTransactions,
) {
  const accountRepo = {
    listByHousehold: async (_hId: string) => [...accounts],
  } as unknown as AccountRepository

  const categoryRepo = {
    listByHousehold: async (_hId: string) => [...categories],
  } as unknown as CategoryRepository

  const transactionRepo = {
    listByHousehold: async (_hId: string) => [...txs],
  } as unknown as TransactionRepository

  return new AnalyticsService(accountRepo, transactionRepo, categoryRepo)
}

export async function runAnalyticsServiceTests(): Promise<void> {
  const service = createService()

  // 1. Resumo do Dashboard para o mês 2026-09
  const summary = await service.getDashboardSummary('h-1', { month: '2026-09' })

  // Req 15.1: Saldo total inicial (100.000 + 50.000) + receita (500.000) - despesa paga (30.000 + 20.000 mês anterior) = 600.000
  assert.equal(summary.totalBalanceCents, 600000)

  // Req 15.2: Total de receitas pagas no mês = 500.000
  assert.equal(summary.totalIncomeCents, 500000)

  // Req 15.3 & 15.4: Total de despesas pagas no mês = 30.000 (EXCLUI transferência de 15.000 e pendente de 10.000)
  assert.equal(summary.totalExpenseCents, 30000)

  // Req 15.5: Total pendente no mês = 10.000
  assert.equal(summary.totalPendingCents, 10000)

  // Req 15.6: Despesas por categoria (apenas 'cat-mercado' com 30.000 pago, 'cat-lazer' é pendente então não entra nas pagas)
  assert.equal(summary.expensesByCategory.length, 1)
  assert.equal(summary.expensesByCategory[0].name, 'Mercado')
  assert.equal(summary.expensesByCategory[0].totalCents, 30000)

  // Req 15.13: Variação percentual em relação ao mês anterior (2026-08 teve 20.000 despesas, 2026-09 teve 30.000 => +50%)
  assert.equal(summary.expenseVariationPercent, 50)

  console.log('  ok — API-002J: AnalyticsService passou em todos os 5 testes (exclusão de transferências, saldo total, total pendente, por categoria e variação %)')
}
