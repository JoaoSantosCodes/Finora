// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO SYNC ENGINE (SYNC-001)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { MutationQueue } from './mutation_queue.ts'
import { SyncEngine, type SyncExecutorResponse } from './sync_engine.ts'

export async function runSyncEngineTests(): Promise<void> {
  // 1. Instanciar fila em memória e SyncEngine
  const queue = new MutationQueue('test_sync_queue_' + Date.now())
  const engine = new SyncEngine(queue)

  // Teste 1: Enfileiramento de mutação local (Req 19.5)
  const mut1 = engine.enqueue('h-1', 'account', 'create', { name: 'Conta Nubank', type: 'checking', initial_balance_cents: 10000 })
  assert.ok(mut1.clientMutationId)
  assert.equal(mut1.status, 'pending')
  assert.equal(queue.getPending().length, 1)

  // Teste 2: Sincronização com o backend (Sucesso)
  const mockBackendCalls: string[] = []
  const successExecutor = async (mutation: any): Promise<SyncExecutorResponse> => {
    mockBackendCalls.push(mutation.clientMutationId)
    return { success: true }
  }

  const res1 = await engine.syncPending(successExecutor)
  assert.equal(res1.synced, 1)
  assert.equal(res1.conflicts, 0)
  assert.equal(res1.failed, 0)
  assert.equal(queue.getPending().length, 0)
  assert.equal(mockBackendCalls.length, 1)

  // Teste 3: Garantia de Idempotência no Backend (DB-006 & Req 13)
  engine.enqueue('h-1', 'transaction', 'create', { amount_cents: 5000, type: 'expense' })
  const duplicateExecutor = async (_mutation: any): Promise<SyncExecutorResponse> => {
    // Simula resposta do backend que detectou chave `(household_id, client_mutation_id)` duplicada
    return { success: true, alreadyApplied: true }
  }

  const res2 = await engine.syncPending(duplicateExecutor)
  assert.equal(res2.synced, 1)
  assert.equal(queue.getPending().length, 0)

  // Teste 4: Detecção e Preservação de Conflito (Req 19.6)
  const mut3 = engine.enqueue('h-1', 'category', 'update', { id: 'cat-1', name: 'Mercado Local' })
  const conflictExecutor = async (_mutation: any): Promise<SyncExecutorResponse> => {
    return {
      success: false,
      conflict: true,
      error: 'Nome alterado por outro membro',
      serverState: { id: 'cat-1', name: 'Supermercado' },
    }
  }

  const res3 = await engine.syncPending(conflictExecutor)
  assert.equal(res3.conflicts, 1)
  assert.equal(queue.getConflicts().length, 1)

  const conflictItem = queue.getConflicts()[0]
  assert.equal(conflictItem.status, 'conflict')
  assert.equal(conflictItem.serverState.name, 'Supermercado')

  // Teste 5: Resolução de Conflito pelo Usuário (Req 19.6 - Manter Servidor)
  const resolvedServer = await engine.resolveConflict(mut3.clientMutationId, 'keep_server')
  assert.equal(resolvedServer, true)
  assert.equal(queue.getConflicts().length, 0)

  console.log('  ok — SYNC-001: SyncEngine passou em todos os 5 testes (enfileiramento, sincronização, idempotência DB-006, detecção de conflitos e resolução pelo usuário)')
}
