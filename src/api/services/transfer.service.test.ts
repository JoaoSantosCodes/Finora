// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO TRANSFER SERVICE (API-002C)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runTransferServiceTests } from './transfer.service.pure.ts'

describe('TransferService (API-002C)', () => {
  it('executa os 5 testes do TransferService com sucesso', async () => {
    await runTransferServiceTests()
  })
})
