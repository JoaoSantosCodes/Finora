// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO TRANSACTION SERVICE (API-002B)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runTransactionServiceTests } from './transaction.service.pure.ts'

describe('TransactionService (API-002B)', () => {
  it('executa os 7 testes do TransactionService com sucesso', async () => {
    await runTransactionServiceTests()
  })
})
