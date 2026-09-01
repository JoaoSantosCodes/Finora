import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { validateTransaction, accountBalance, totalPending } from './transactions'
import type { Account, Transaction } from './types'

const acc = (id: string, initial = 0): Account => ({ id, initialBalanceCents: initial })

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? 't',
    type: p.type ?? 'expense',
    amountCents: p.amountCents ?? 1000,
    accountId: p.accountId ?? 'a',
    counterAccountId: p.counterAccountId,
    categoryId: p.categoryId,
    accrualDate: p.accrualDate ?? '2026-08-01',
    paymentStatus: p.paymentStatus ?? 'paid',
  }
}

describe('validateTransaction', () => {
  it('rejeita valor <= 0 (Property 2)', () => {
    expect(validateTransaction(tx({ amountCents: 0 })).ok).toBe(false)
    expect(validateTransaction(tx({ amountCents: -5 })).ok).toBe(false)
  })
  it('rejeita transfer com origem == destino', () => {
    expect(validateTransaction(tx({ type: 'transfer', accountId: 'a', counterAccountId: 'a' })).ok).toBe(false)
  })
  it('rejeita transfer sem destino', () => {
    expect(validateTransaction(tx({ type: 'transfer', counterAccountId: undefined })).ok).toBe(false)
  })
  it('aceita transfer válida', () => {
    expect(validateTransaction(tx({ type: 'transfer', accountId: 'a', counterAccountId: 'b' })).ok).toBe(true)
  })
})

describe('accountBalance', () => {
  it('considera apenas transações paid', () => {
    const txs: Transaction[] = [
      tx({ type: 'income', amountCents: 5000, accountId: 'a', paymentStatus: 'paid' }),
      tx({ type: 'expense', amountCents: 2000, accountId: 'a', paymentStatus: 'paid' }),
      tx({ type: 'expense', amountCents: 9999, accountId: 'a', paymentStatus: 'pending' }),
    ]
    expect(accountBalance(acc('a', 1000), txs)).toBe(1000 + 5000 - 2000)
  })

  it('transfer move saldo entre contas (soma zero no par)', () => {
    const txs: Transaction[] = [
      tx({ type: 'transfer', amountCents: 3000, accountId: 'a', counterAccountId: 'b', paymentStatus: 'paid' }),
    ]
    expect(accountBalance(acc('a'), txs)).toBe(-3000)
    expect(accountBalance(acc('b'), txs)).toBe(3000)
  })

  // Property 1: adicionar transferências não altera a soma de receitas nem de despesas.
  it('Property 1: transfer é neutra em receitas/despesas', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (v) => {
        const base: Transaction[] = [
          tx({ type: 'income', amountCents: 10000, accountId: 'a' }),
          tx({ type: 'expense', amountCents: 4000, accountId: 'a' }),
        ]
        const comTransfer: Transaction[] = [
          ...base,
          tx({ type: 'transfer', amountCents: v, accountId: 'a', counterAccountId: 'b' }),
        ]
        const receitas = (arr: Transaction[]) => arr.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountCents, 0)
        const despesas = (arr: Transaction[]) => arr.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0)
        expect(receitas(comTransfer)).toBe(receitas(base))
        expect(despesas(comTransfer)).toBe(despesas(base))
      }),
    )
  })
})

describe('totalPending', () => {
  // Property 6: total pendente acumula todas as despesas pending.
  it('Property 6: soma acumulativa das despesas pending', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 100000 }), { maxLength: 50 }), (valores) => {
        const txs = valores.map((v, i) => tx({ id: String(i), type: 'expense', amountCents: v, paymentStatus: 'pending' }))
        expect(totalPending(txs)).toBe(valores.reduce((s, v) => s + v, 0))
      }),
    )
  })

  it('ignora paid e income', () => {
    const txs: Transaction[] = [
      tx({ type: 'expense', amountCents: 100, paymentStatus: 'pending' }),
      tx({ type: 'expense', amountCents: 200, paymentStatus: 'paid' }),
      tx({ type: 'income', amountCents: 999, paymentStatus: 'pending' }),
    ]
    expect(totalPending(txs)).toBe(100)
  })
})
