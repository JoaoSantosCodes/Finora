// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO CATEGORY SERVICE (API-002F)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runCategoryServiceTests } from './category.service.pure.ts'

describe('CategoryService (API-002F)', () => {
  it('executa os 5 testes do CategoryService com sucesso', async () => {
    await runCategoryServiceTests()
  })
})
