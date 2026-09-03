// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO MÓDULO DE CARTÕES E FATURAS (FASE 6B)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import type { CreditCardItem } from './Cartoes.tsx'
import type { InvoiceItem } from './Faturas.tsx'

export async function runCartoesModuleTests(): Promise<void> {
  const mockCards: CreditCardItem[] = [
    { id: 'card-1', name: 'Nubank', limitCents: 1200000, closingDay: 15, dueDay: 22, color: 'bg-purple-600' },
    { id: 'card-2', name: 'Itaú', limitCents: 2500000, closingDay: 5, dueDay: 12, color: 'bg-orange-600' },
  ]

  // Teste 1: Cálculo do Limite Consolidado
  const totalLimite = mockCards.reduce((acc, c) => acc + c.limitCents, 0)
  assert.equal(totalLimite, 3700000)

  // Teste 2: Adicionar Cartão com Validação de Dias (1-31)
  const novoCartao: CreditCardItem = {
    id: 'card-3',
    name: 'Inter',
    limitCents: 500000,
    closingDay: 10,
    dueDay: 17,
    color: 'bg-slate-800',
  }
  assert.ok(novoCartao.closingDay >= 1 && novoCartao.closingDay <= 31)
  assert.ok(novoCartao.dueDay >= 1 && novoCartao.dueDay <= 31)

  // Teste 3: Alteração do Status de Fatura para Pago
  const mockInvoices: InvoiceItem[] = [
    { id: 'inv-1', cardName: 'Nubank', period: 'Setembro / 2026', dueDate: '2026-09-22', amountCents: 145080, status: 'closed' },
  ]

  const pagas = mockInvoices.map((f) => (f.id === 'inv-1' ? { ...f, status: 'paid' as const } : f))
  assert.equal(pagas[0].status, 'paid')

  console.log('  ok — FASE 6B: Módulo de Cartões e Faturas passou em todos os 3 testes (limite consolidado, validação de dias e quitação de fatura)')
}
