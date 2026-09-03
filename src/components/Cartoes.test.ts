// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO MÓDULO DE CARTÕES E FATURAS (FASE 6B)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runCartoesModuleTests } from './Cartoes.pure.ts'

describe('CartoesModule (FASE 6B)', () => {
  it('executa os 3 testes do módulo de cartões e faturas com sucesso', async () => {
    await runCartoesModuleTests()
  })
})
