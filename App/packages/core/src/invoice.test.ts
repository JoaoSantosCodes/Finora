import { describe, it, expect } from 'vitest'
import { invoiceCycle, invoiceTotal } from './invoice'
import type { CreditCard } from './types'

const card: CreditCard = { id: 'c', closingDay: 10, dueDay: 20 }

describe('invoiceCycle', () => {
  it('compra até o fechamento entra no ciclo do próprio mês', () => {
    expect(invoiceCycle('2026-08-05', 10)).toBe('2026-08-01')
    expect(invoiceCycle('2026-08-10', 10)).toBe('2026-08-01')
  })
  it('compra após o fechamento entra no ciclo seguinte', () => {
    expect(invoiceCycle('2026-08-11', 10)).toBe('2026-09-01')
  })
  it('vira o ano em dezembro', () => {
    expect(invoiceCycle('2026-12-15', 10)).toBe('2027-01-01')
  })
})

describe('invoiceTotal (Property 4: fatura derivada dos itens)', () => {
  it('soma apenas itens do ciclo', () => {
    const items = [
      { amountCents: 1000, accrualDate: '2026-08-05' }, // ciclo ago
      { amountCents: 2000, accrualDate: '2026-08-11' }, // ciclo set
      { amountCents: 500, accrualDate: '2026-08-09' }, // ciclo ago
    ]
    expect(invoiceTotal(items, card, '2026-08-01')).toBe(1500)
    expect(invoiceTotal(items, card, '2026-09-01')).toBe(2000)
  })
  it('fatura sem itens é zero', () => {
    expect(invoiceTotal([], card, '2026-08-01')).toBe(0)
  })
})
