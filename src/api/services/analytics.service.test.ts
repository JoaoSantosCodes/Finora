// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO ANALYTICS SERVICE (API-002J)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runAnalyticsServiceTests } from './analytics.service.pure.ts'

describe('AnalyticsService (API-002J)', () => {
  it('executa os 5 testes do AnalyticsService com sucesso', async () => {
    await runAnalyticsServiceTests()
  })
})
