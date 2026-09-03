// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DA INTEGRAÇÃO DO STORE (WEB-001 / WEB-002)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { MutationQueue } from './api/sync/mutation_queue.ts'
import { SyncEngine } from './api/sync/sync_engine.ts'

export async function runStoreIntegrationTests(): Promise<void> {
  const queue = new MutationQueue('test_store_queue_' + Date.now())
  const engine = new SyncEngine(queue)

  // 1. Simular enfileiramento de mutação via Store (Adicionar Despesa)
  const despPayload = { id: 'desp-1', descricao: 'Almoço', valor: 35.5, categoriaId: 'cat-alimentacao', pago: true, data: '2026-09-02' }
  const mut1 = engine.enqueue('h-1', 'transaction', 'create', despPayload)

  assert.equal(mut1.entityType, 'transaction')
  assert.equal(mut1.action, 'create')
  assert.equal(mut1.payload.descricao, 'Almoço')
  assert.equal(queue.getPending().length, 1)

  // 2. Simular alteração de status via Store (Alternar Pago)
  const mut2 = engine.enqueue('h-1', 'transaction', 'update', { id: 'desp-1', pago: false })
  assert.equal(mut2.action, 'update')
  assert.equal(mut2.payload.pago, false)
  assert.equal(queue.getPending().length, 2)

  // 3. Simular adição de categoria via Store
  const catPayload = { id: 'cat-10', nome: 'Transporte', cor: '#0000ff', icone: 'bus' }
  const mut3 = engine.enqueue('h-1', 'category', 'create', catPayload)
  assert.equal(mut3.entityType, 'category')
  assert.equal(queue.getPending().length, 3)

  // 4. Drenar e sincronizar mutações enfileiradas com sucesso
  const res = await engine.syncPending(async (_m) => ({ success: true }))
  assert.equal(res.synced, 3)
  assert.equal(queue.getPending().length, 0)

  console.log('  ok — WEB-001/002: Finora Store & SyncEngine passou em todos os 4 testes de integração (adicionar, atualizar, criar categoria e sincronização completa)')
}
