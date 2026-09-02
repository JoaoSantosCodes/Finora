// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO ACCOUNT SERVICE (API-002A)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runAccountServiceTests } from './account.service.pure.ts'

describe('AccountService (API-002A)', () => {
  it('executa os 7 testes do AccountService com sucesso', async () => {
    await runAccountServiceTests()
  })
})
