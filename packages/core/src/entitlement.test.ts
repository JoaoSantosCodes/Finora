import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { canCreate, canUse, exceedsLimit, limitFor, hasFeature } from './entitlement'
import type { PlanId, CountedResource } from './plans'

describe('canCreate — limites quantitativos', () => {
  it('Free: contas até 3 (permite em 0,1,2; nega em 3+)', () => {
    expect(canCreate('free', 'accounts', 0).allowed).toBe(true)
    expect(canCreate('free', 'accounts', 2).allowed).toBe(true)
    // limite exato → negado
    const atLimit = canCreate('free', 'accounts', 3)
    expect(atLimit.allowed).toBe(false)
    expect(atLimit.reason).toBe('limit_reached')
    expect(atLimit.limit).toBe(3)
    // acima → negado
    expect(canCreate('free', 'accounts', 4).allowed).toBe(false)
  })

  it('Free: 1 meta, 1 cartão, 10 categorias (limites exatos negam)', () => {
    expect(canCreate('free', 'goals', 1).allowed).toBe(false)
    expect(canCreate('free', 'creditCards', 1).allowed).toBe(false)
    expect(canCreate('free', 'categories', 10).allowed).toBe(false)
    expect(canCreate('free', 'categories', 9).allowed).toBe(true)
  })

  it('Pro/Family: recursos ilimitados sempre permitem', () => {
    expect(canCreate('pro', 'accounts', 9999).allowed).toBe(true)
    expect(canCreate('family', 'goals', 9999).allowed).toBe(true)
  })

  it('Family: até 6 membros; Free/Pro: 1 membro', () => {
    expect(canCreate('family', 'members', 5).allowed).toBe(true)
    expect(canCreate('family', 'members', 6).allowed).toBe(false)
    expect(canCreate('free', 'members', 1).allowed).toBe(false)
    expect(canCreate('pro', 'members', 1).allowed).toBe(false)
  })
})

describe('canUse — features booleanas', () => {
  it('recorrências/orçamentos: negados no Free, ok no Pro/Family', () => {
    expect(canUse('free', 'recurrences').allowed).toBe(false)
    expect(canUse('free', 'budgets').allowed).toBe(false)
    expect(canUse('pro', 'recurrences').allowed).toBe(true)
    expect(canUse('family', 'budgets').allowed).toBe(true)
  })
  it('familySharing só no Family', () => {
    expect(canUse('free', 'familySharing').allowed).toBe(false)
    expect(canUse('pro', 'familySharing').allowed).toBe(false)
    expect(canUse('family', 'familySharing').allowed).toBe(true)
  })
  it('dataImport negado no Free; trial indisponível no Free', () => {
    expect(canUse('free', 'dataImport').allowed).toBe(false)
    expect(canUse('free', 'trial').allowed).toBe(false)
    expect(canUse('pro', 'trial').allowed).toBe(true)
  })
  it('installments/invoices/export disponíveis em todos', () => {
    for (const p of ['free', 'pro', 'family'] as PlanId[]) {
      expect(canUse(p, 'installments').allowed).toBe(true)
      expect(canUse(p, 'invoices').allowed).toBe(true)
      expect(canUse(p, 'dataExport').allowed).toBe(true)
    }
  })
})

describe('exceedsLimit — pós-downgrade', () => {
  it('Free: 5 contas excede (limite 3); ilimitado nunca excede', () => {
    expect(exceedsLimit('free', 'accounts', 5)).toBe(true)
    expect(exceedsLimit('free', 'accounts', 3)).toBe(false) // no limite não excede
    expect(exceedsLimit('pro', 'accounts', 9999)).toBe(false)
  })
})

const COUNTED: CountedResource[] = ['households', 'members', 'accounts', 'creditCards', 'categories', 'goals']
const PLAN_IDS: PlanId[] = ['free', 'pro', 'family']

describe('Property-based — invariantes do gate', () => {
  // Property central: canCreate NUNCA permite criar acima do limite do plano.
  it('nunca permite criar quando currentCount >= limite finito', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PLAN_IDS),
        fc.constantFrom(...COUNTED),
        fc.integer({ min: 0, max: 100000 }),
        (plan, resource, count) => {
          const limit = limitFor(plan, resource)
          const decision = canCreate(plan, resource, count)
          if (limit === null) {
            expect(decision.allowed).toBe(true) // ilimitado sempre permite
          } else if (count >= limit) {
            expect(decision.allowed).toBe(false) // no limite ou acima → nega
          } else {
            expect(decision.allowed).toBe(true) // abaixo → permite
          }
        },
      ),
    )
  })

  // Consistência: se canCreate nega por limite, exceedsLimit é verdadeiro para count > limite.
  it('coerência entre canCreate e exceedsLimit', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PLAN_IDS),
        fc.constantFrom(...COUNTED),
        fc.integer({ min: 0, max: 100000 }),
        (plan, resource, count) => {
          const limit = limitFor(plan, resource)
          if (limit !== null && count > limit) {
            expect(exceedsLimit(plan, resource, count)).toBe(true)
            expect(canCreate(plan, resource, count).allowed).toBe(false)
          }
        },
      ),
    )
  })

  // hasFeature é determinístico e booleano para toda combinação.
  it('hasFeature retorna booleano para toda combinação plano×feature', () => {
    const FEATURES = ['installments', 'invoices', 'recurrences', 'budgets', 'familySharing', 'dataExport', 'dataImport', 'trial'] as const
    for (const p of PLAN_IDS) {
      for (const f of FEATURES) {
        expect(typeof hasFeature(p, f)).toBe('boolean')
      }
    }
  })
})
