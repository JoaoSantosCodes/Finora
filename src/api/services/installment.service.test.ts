// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO INSTALLMENT SERVICE (API-002D)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runInstallmentServiceTests } from './installment.service.pure.ts'

describe('InstallmentService (API-002D)', () => {
  it('executa os 5 testes do InstallmentService com sucesso', async () => {
    await runInstallmentServiceTests()
  })
})
