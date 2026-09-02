// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO CREDIT CARD SERVICE (API-002E)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runCreditCardServiceTests } from './credit_card.service.pure.ts'

describe('CreditCardService (API-002E)', () => {
  it('executa os 5 testes do CreditCardService com sucesso', async () => {
    await runCreditCardServiceTests()
  })
})
