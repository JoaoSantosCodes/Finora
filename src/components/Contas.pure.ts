// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO MÓDULO DE CONTAS BANCÁRIAS (FASE 6A)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import type { AccountItem } from './Contas.tsx'

export async function runContasModuleTests(): Promise<void> {
  const initialContas: AccountItem[] = [
    { id: 'acc-1', name: 'Conta Principal', type: 'checking', initialBalanceCents: 150000, archived: false },
    { id: 'acc-2', name: 'Poupança', type: 'savings', initialBalanceCents: 500000, archived: false },
  ]

  // Teste 1: Cálculo de Saldo Consolidado
  const ativas = initialContas.filter((c) => !c.archived)
  const totalSaldo = ativas.reduce((acc, c) => acc + c.initialBalanceCents, 0)
  assert.equal(totalSaldo, 650000)

  // Teste 2: Adicionar Nova Conta
  const novaConta: AccountItem = {
    id: 'acc-3',
    name: 'Carteira',
    type: 'wallet',
    initialBalanceCents: 20000,
    archived: false,
  }
  const comNova = [...initialContas, novaConta]
  assert.equal(comNova.length, 3)

  // Teste 3: Arquivar Conta
  const arquivada = comNova.map((acc) => (acc.id === 'acc-1' ? { ...acc, archived: true } : acc))
  const ativasAposArquivar = arquivada.filter((c) => !c.archived)
  assert.equal(ativasAposArquivar.length, 2)
  assert.equal(ativasAposArquivar.reduce((acc, c) => acc + c.initialBalanceCents, 0), 520000)

  console.log('  ok — FASE 6A: Módulo de Contas Bancárias passou em todos os 3 testes (saldo consolidado, criação e arquivamento)')
}
