// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO MÓDULO DE ORÇAMENTOS (FASE 6C)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runOrcamentosModuleTests } from './Orcamentos.pure.ts'

describe('OrcamentosModule (FASE 6C)', () => {
  it('executa os 3 testes do módulo de orçamentos com sucesso', async () => {
    await runOrcamentosModuleTests()
  })
})
