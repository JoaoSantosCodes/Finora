// Invariantes de transação e cálculo de saldo. Puro, sem I/O.
// Regras: design.md §Domain Model, §Correctness Properties.
import type { Cents } from './money'
import type { Account, Transaction } from './types'

export interface ValidationResult {
  ok: boolean
  error?: string
}

/**
 * Valida uma transação segundo as invariantes do domínio:
 *  - amount > 0 (Property 2)
 *  - transfer exige counterAccount distinto da origem (Req 8.4)
 *  - paid exige... (paid_at é da persistência; aqui validamos a forma do domínio)
 */
export function validateTransaction(t: Transaction): ValidationResult {
  if (!Number.isInteger(t.amountCents) || t.amountCents <= 0) {
    return { ok: false, error: 'amount deve ser inteiro positivo (centavos)' }
  }
  if (t.type === 'transfer') {
    if (!t.counterAccountId) {
      return { ok: false, error: 'transfer exige conta de destino' }
    }
    if (t.counterAccountId === t.accountId) {
      return { ok: false, error: 'origem e destino devem ser diferentes' }
    }
  }
  return { ok: true }
}

/**
 * Saldo EFETIVADO de uma conta: saldo inicial
 *  + income/transfer-in `paid`
 *  - expense/transfer-out `paid`.
 * Transações `pending` não afetam o saldo efetivado (Req 9.2, 9.3).
 * Transfer move valor entre contas, nunca conta como receita/despesa (Property 1).
 */
export function accountBalance(account: Account, txs: Transaction[]): Cents {
  let balance = account.initialBalanceCents
  for (const t of txs) {
    if (t.paymentStatus !== 'paid') continue
    if (t.type === 'income' && t.accountId === account.id) balance += t.amountCents
    else if (t.type === 'expense' && t.accountId === account.id) balance -= t.amountCents
    else if (t.type === 'transfer') {
      if (t.accountId === account.id) balance -= t.amountCents // saída
      if (t.counterAccountId === account.id) balance += t.amountCents // entrada
    }
  }
  return balance
}

/** Total pendente = soma de todas as despesas `pending` (acumulativo, Property 6). */
export function totalPending(txs: Transaction[]): Cents {
  return txs
    .filter((t) => t.type === 'expense' && t.paymentStatus === 'pending')
    .reduce((acc, t) => acc + t.amountCents, 0)
}
