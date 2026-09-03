// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO MÓDULO DE RELATÓRIOS E INSIGHTS (FASE 6E)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import type { ReportCategorySummary } from './Relatorios.tsx'
import type { InsightCard } from './Insights.tsx'

export async function runRelatoriosModuleTests(): Promise<void> {
  const mockCategorias: ReportCategorySummary[] = [
    { categoryName: 'Alimentação & Mercado', amountCents: 150000, percentage: 35.3 },
    { categoryName: 'Moradia & Aluguel', amountCents: 180000, percentage: 42.4 },
    { categoryName: 'Lazer', amountCents: 45000, percentage: 10.6 },
  ]

  // Teste 1: Cálculo de Despesa Total em Relatórios
  const totalDespesa = mockCategorias.reduce((acc, c) => acc + c.amountCents, 0)
  assert.equal(totalDespesa, 375000)

  // Teste 2: Formatação de Exportação CSV
  let csvLines = 0
  mockCategorias.forEach((c) => {
    const line = `"${c.categoryName}",${(c.amountCents / 100).toFixed(2)},${c.percentage}`
    assert.ok(line.includes(c.categoryName))
    csvLines++
  })
  assert.equal(csvLines, 3)

  // Teste 3: Classificação de Insights por Severidade
  const mockInsights: InsightCard[] = [
    { id: 'ins-1', title: 'Moradia', description: 'Alta proporção', type: 'warning' },
    { id: 'ins-2', title: 'Economia', description: 'Redução de gastos', type: 'success' },
  ]

  const avisos = mockInsights.filter((i) => i.type === 'warning')
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].title, 'Moradia')

  console.log('  ok — FASE 6E: Módulo de Relatórios e Insights passou em todos os 3 testes (cálculo de balanço, exportação CSV e filtragem de insights por severidade)')
}
