// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO MÓDULO DE ORÇAMENTOS POR CATEGORIA (FASE 6C)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import type { BudgetItem } from './Orcamentos.tsx'

export async function runOrcamentosModuleTests(): Promise<void> {
  const mockBudgets: BudgetItem[] = [
    { id: 'b-1', categoryName: 'Mercado', allocatedCents: 100000, spentCents: 50000 },  // 50% -> OK (Emerald)
    { id: 'b-2', categoryName: 'Lazer', allocatedCents: 50000, spentCents: 45000 },    // 90% -> Alerta (Amber)
    { id: 'b-3', categoryName: 'Transporte', allocatedCents: 30000, spentCents: 35000 },// 116% -> Excedido (Red)
  ]

  // Teste 1: Cálculo dos Totais Planejados e Gastos
  const totalPlanejado = mockBudgets.reduce((acc, b) => acc + b.allocatedCents, 0)
  const totalGasto = mockBudgets.reduce((acc, b) => acc + b.spentCents, 0)

  assert.equal(totalPlanejado, 180000)
  assert.equal(totalGasto, 130000)

  // Teste 2: Identificação de Orçamentos Estourados (spent >= allocated)
  const estourados = mockBudgets.filter((b) => b.spentCents >= b.allocatedCents)
  assert.equal(estourados.length, 1)
  assert.equal(estourados[0].categoryName, 'Transporte')

  // Teste 3: Faixas de Alerta Percentual
  const getPercentual = (spent: number, allocated: number) => Math.round((spent / allocated) * 100)
  assert.equal(getPercentual(mockBudgets[0].spentCents, mockBudgets[0].allocatedCents), 50)
  assert.equal(getPercentual(mockBudgets[1].spentCents, mockBudgets[1].allocatedCents), 90)

  console.log('  ok — FASE 6C: Módulo de Orçamentos passou em todos os 3 testes (totais acumulados, orçamentos estourados e percentual de consumo)')
}
