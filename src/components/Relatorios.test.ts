// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO MÓDULO DE RELATÓRIOS E INSIGHTS (FASE 6E)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runRelatoriosModuleTests } from './Relatorios.pure.ts'

describe('RelatoriosModule (FASE 6E)', () => {
  it('executa os 3 testes do módulo de relatórios e insights com sucesso', async () => {
    await runRelatoriosModuleTests()
  })
})
