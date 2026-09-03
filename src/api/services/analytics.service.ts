// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS APPLICATION SERVICE (API-002J)
// ─────────────────────────────────────────────────────────────────────────────

import { reportHistoryMonths } from '../../../packages/core/src/entitlement.ts'
import type { PlanId } from '../../../packages/core/src/plans.ts'
import { accountBalance } from '../../../packages/core/src/transactions.ts'
import { AccountRepository } from '../repositories/account.repository.ts'
import { CategoryRepository } from '../repositories/category.repository.ts'
import { TransactionRecord, TransactionRepository } from '../repositories/transaction.repository.ts'

export interface CategoryExpenseSummary {
  categoryId: string
  name: string
  color?: string
  totalCents: number
}

export interface MonthlyTrendItem {
  month: string // YYYY-MM
  totalIncomeCents: number
  totalExpenseCents: number
}

export interface DashboardSummary {
  totalBalanceCents: number
  totalIncomeCents: number
  totalExpenseCents: number
  totalPendingCents: number
  expenseVariationPercent: number
  expensesByCategory: CategoryExpenseSummary[]
  monthlyTrend: MonthlyTrendItem[]
}

export interface AnalyticsFilter {
  month?: string // YYYY-MM
  planId?: PlanId
}

export class AnalyticsService {
  private readonly accountRepo: AccountRepository
  private readonly transactionRepo: TransactionRepository
  private readonly categoryRepo: CategoryRepository

  constructor(
    accountRepo: AccountRepository,
    transactionRepo: TransactionRepository,
    categoryRepo: CategoryRepository,
  ) {
    this.accountRepo = accountRepo
    this.transactionRepo = transactionRepo
    this.categoryRepo = categoryRepo
  }

  /**
   * Consolida os indicadores e relatórios do Dashboard para a household (Req 15, Req 23.1).
   */
  async getDashboardSummary(householdId: string, filter?: AnalyticsFilter): Promise<DashboardSummary> {
    const plan: PlanId = filter?.planId || 'free'
    const allowedHistoryMonths = reportHistoryMonths(plan)

    // 1. Carregar contas ativas e calcular saldo total (Req 15.1)
    const accounts = await this.accountRepo.listByHousehold(householdId)
    const activeAccounts = accounts.filter((a) => !a.archived)
    const allTxs = await this.transactionRepo.listByHousehold(householdId)
    const categories = await this.categoryRepo.listByHousehold(householdId)

    let totalBalanceCents = 0
    for (const acc of activeAccounts) {
      if (acc.id) {
        // Incluir transações onde a conta é de origem (account_id) ou destino (counter_account_id)
        const accTxs = allTxs.filter((t) => t.account_id === acc.id || t.counter_account_id === acc.id)
        const coreTxs = accTxs.map((t) => ({
          id: t.id || '',
          householdId: t.household_id,
          type: t.type,
          amountCents: Number(t.amount_cents),
          accountId: t.account_id,
          counterAccountId: t.counter_account_id,
          categoryId: t.category_id,
          paymentStatus: t.payment_status,
          accrualDate: t.accrual_date,
        }))
        const coreAcc = {
          id: acc.id,
          householdId: acc.household_id,
          name: acc.name,
          type: acc.type,
          initialBalanceCents: Number(acc.initial_balance_cents ?? 0),
          archived: acc.archived ?? false,
        }
        totalBalanceCents += accountBalance(coreAcc, coreTxs)
      }
    }

    // 2. Filtrar transações por período e competência (Req 15.2, 15.3, 15.4)
    // Transações do tipo 'transfer' são ESTRITAMENTE EXCLUÍDAS dos totais de receita e despesa (Req 15.4)
    const targetMonth = filter?.month || new Date().toISOString().slice(0, 7) // YYYY-MM

    let totalIncomeCents = 0
    let totalExpenseCents = 0
    let totalPendingCents = 0

    const currentMonthTxs: TransactionRecord[] = []
    const categoryTotalsMap = new Map<string, number>()
    const monthlyMap = new Map<string, { income: number; expense: number }>()

    for (const tx of allTxs) {
      const month = tx.accrual_date ? tx.accrual_date.slice(0, 7) : ''

      // Acumular mês a mês para a tendência mensal (Req 15.7)
      if (month) {
        let entry = monthlyMap.get(month)
        if (!entry) {
          entry = { income: 0, expense: 0 }
          monthlyMap.set(month, entry)
        }

        if (tx.type === 'income' && tx.payment_status === 'paid') {
          entry.income += Number(tx.amount_cents)
        } else if (tx.type === 'expense' && tx.payment_status === 'paid') {
          entry.expense += Number(tx.amount_cents)
        }
      }

      // Filtrar apenas o mês selecionado
      if (month === targetMonth) {
        currentMonthTxs.push(tx)

        // Req 15.5: Total pendente no período
        if (tx.payment_status === 'pending') {
          totalPendingCents += Number(tx.amount_cents)
        }

        // Req 15.4: EXCLUIR transações do tipo transfer das receitas e despesas
        if (tx.type === 'income' && tx.payment_status === 'paid') {
          totalIncomeCents += Number(tx.amount_cents)
        } else if (tx.type === 'expense' && tx.payment_status === 'paid') {
          totalExpenseCents += Number(tx.amount_cents)

          // Acumular por categoria
          if (tx.category_id) {
            const currentCatTotal = categoryTotalsMap.get(tx.category_id) || 0
            categoryTotalsMap.set(tx.category_id, currentCatTotal + Number(tx.amount_cents))
          }
        }
      }
    }

    // 3. Distribuição de despesas por categoria (Req 15.6) — Omitir categorias com total <= 0
    const expensesByCategory: CategoryExpenseSummary[] = []
    for (const cat of categories) {
      if (cat.id) {
        const total = categoryTotalsMap.get(cat.id) || 0
        if (total > 0) {
          expensesByCategory.push({
            categoryId: cat.id,
            name: cat.name,
            color: cat.color,
            totalCents: total,
          })
        }
      }
    }
    expensesByCategory.sort((a, b) => b.totalCents - a.totalCents)

    // 4. Evolução mensal agregada por mês de competência (Req 15.7)
    let sortedMonths = Array.from(monthlyMap.keys()).sort()
    if (allowedHistoryMonths !== null && allowedHistoryMonths !== undefined && allowedHistoryMonths !== Infinity && sortedMonths.length > allowedHistoryMonths) {
      sortedMonths = sortedMonths.slice(-allowedHistoryMonths)
    }

    const monthlyTrend: MonthlyTrendItem[] = sortedMonths.map((m) => {
      const data = monthlyMap.get(m)!
      return {
        month: m,
        totalIncomeCents: data.income,
        totalExpenseCents: data.expense,
      }
    })

    // 5. Variação percentual de despesas em relação ao mês anterior (Req 15.13)
    let expenseVariationPercent = 0
    const [y, mStr] = targetMonth.split('-').map(Number)
    const prevMonthDate = new Date(y, mStr - 2, 1)
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`

    const prevMonthData = monthlyMap.get(prevMonthStr)
    const prevExpense = prevMonthData ? prevMonthData.expense : 0

    if (prevExpense > 0) {
      expenseVariationPercent = Math.round(((totalExpenseCents - prevExpense) / prevExpense) * 100)
    }

    return {
      totalBalanceCents,
      totalIncomeCents,
      totalExpenseCents,
      totalPendingCents,
      expenseVariationPercent,
      expensesByCategory,
      monthlyTrend,
    }
  }
}
