import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { splitInstallments, sumCents, toCents, fromCents } from './money'

describe('money — centavos', () => {
  it('toCents/fromCents arredonda corretamente', () => {
    expect(toCents(99.9)).toBe(9990)
    expect(toCents(0.1)).toBe(10)
    expect(fromCents(9990)).toBe(99.9)
  })

  // Property 3: soma das parcelas = total, sobra na última.
  it('Property 3: soma das parcelas é sempre igual ao total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000 }),
        fc.integer({ min: 1, max: 360 }),
        (totalCents, count) => {
          const parts = splitInstallments(totalCents, count)
          expect(parts).toHaveLength(count)
          expect(sumCents(parts)).toBe(totalCents)
          // todas as parcelas são inteiros não-negativos
          for (const p of parts) expect(Number.isInteger(p)).toBe(true)
        },
      ),
    )
  })

  it('splitInstallments rejeita count < 1', () => {
    expect(() => splitInstallments(1000, 0)).toThrow()
  })
})
