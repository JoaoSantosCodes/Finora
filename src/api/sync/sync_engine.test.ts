// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO SYNC ENGINE (SYNC-001)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runSyncEngineTests } from './sync_engine.pure.ts'

describe('SyncEngine (SYNC-001)', () => {
  it('executa os 5 testes do SyncEngine com sucesso', async () => {
    await runSyncEngineTests()
  })
})
