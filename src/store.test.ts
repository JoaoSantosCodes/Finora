// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DA INTEGRAÇÃO DO STORE (WEB-001 / WEB-002)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runStoreIntegrationTests } from './store.pure.ts'

describe('FinoraStore & SyncEngine (WEB-001/002)', () => {
  it('executa os 4 testes do Store integrado com sucesso', async () => {
    await runStoreIntegrationTests()
  })
})
