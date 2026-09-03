// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO MÓDULO DE METAS FINANCEIRAS (FASE 6D)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runMetasModuleTests } from './Metas.pure.ts'

describe('MetasModule (FASE 6D)', () => {
  it('executa os 3 testes do módulo de metas com sucesso', async () => {
    await runMetasModuleTests()
  })
})
