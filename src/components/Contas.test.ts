// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO MÓDULO DE CONTAS BANCÁRIAS (FASE 6A)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runContasModuleTests } from './Contas.pure.ts'

describe('ContasModule (FASE 6A)', () => {
  it('executa os 3 testes do módulo de contas com sucesso', async () => {
    await runContasModuleTests()
  })
})
