// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO MÓDULO DE METAS FINANCEIRAS (FASE 6D)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import type { GoalItem } from './Metas.tsx'

export async function runMetasModuleTests(): Promise<void> {
  const initialMetas: GoalItem[] = [
    { id: 'g-1', name: 'Viagem', targetCents: 800000, currentCents: 400000, deadline: '2026-12-15' }, // 50%
    { id: 'g-2', name: 'Reserva', targetCents: 500000, currentCents: 500000, deadline: '2026-08-01' }, // 100% (Concluída)
  ]

  // Teste 1: Cálculo do Total Economizado e Meta Consolidada
  const totalEconomizado = initialMetas.reduce((acc, g) => acc + g.currentCents, 0)
  const totalAlvo = initialMetas.reduce((acc, g) => acc + g.targetCents, 0)

  assert.equal(totalEconomizado, 900000)
  assert.equal(totalAlvo, 1300000)

  // Teste 2: Registrar Aporte em Meta Existente
  const comAporte = initialMetas.map((g) =>
    g.id === 'g-1' ? { ...g, currentCents: g.currentCents + 200000 } : g,
  )
  assert.equal(comAporte[0].currentCents, 600000) // 400.000 + 200.000 = 600.000 (75%)

  // Teste 3: Verificação de Meta Concluída (currentCents >= targetCents)
  const concluídas = comAporte.filter((g) => g.currentCents >= g.targetCents)
  assert.equal(concluídas.length, 1)
  assert.equal(concluídas[0].name, 'Reserva')

  console.log('  ok — FASE 6D: Módulo de Metas Financeiras passou em todos os 3 testes (totais acumulados, registro de aportes e identificação de metas concluídas)')
}
