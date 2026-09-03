// ─────────────────────────────────────────────────────────────────────────────
// SYNC ENGINE FOR OFFLINE-FIRST SYNCHRONIZATION (SYNC-001)
// Motor principal de sincronização offline-first (Req 19, Req 13, Req 14)
// ─────────────────────────────────────────────────────────────────────────────

import { MutationQueue, type SyncMutation } from './mutation_queue.ts'

export interface SyncExecutorResponse {
  success: boolean
  alreadyApplied?: boolean // Idempotência garantida pelo backend (DB-006)
  conflict?: boolean
  serverState?: any
  error?: string
}

export type ApiMutationExecutor = (mutation: SyncMutation) => Promise<SyncExecutorResponse>

export class SyncEngine {
  private readonly queue: MutationQueue
  private isSyncing = false

  constructor(queue?: MutationQueue) {
    this.queue = queue || new MutationQueue()
  }

  /**
   * Adiciona uma alteração feita localmente à fila de mutações (Req 19.5).
   */
  enqueue<T>(householdId: string, entityType: SyncMutation['entityType'], action: SyncMutation['action'], payload: T): SyncMutation<T> {
    const clientMutationId = this.generateUuidV4()
    return this.queue.enqueue<T>({
      clientMutationId,
      householdId,
      entityType,
      action,
      payload,
    })
  }

  /**
   * Drena e sincroniza as mutações pendentes enviando-as ao backend (Req 19.5).
   */
  async syncPending(executor: ApiMutationExecutor): Promise<{ synced: number; conflicts: number; failed: number }> {
    if (this.isSyncing) {
      return { synced: 0, conflicts: 0, failed: 0 }
    }

    this.isSyncing = true
    let synced = 0
    let conflicts = 0
    let failed = 0

    try {
      const pending = this.queue.getPending()

      for (const mutation of pending) {
        this.queue.updateStatus(mutation.clientMutationId, 'syncing')

        try {
          const result = await executor(mutation)

          if (result.success || result.alreadyApplied) {
            // Sucesso ou já aplicado no backend de forma idempotente (DB-006)
            this.queue.updateStatus(mutation.clientMutationId, 'synced')
            this.queue.remove(mutation.clientMutationId)
            synced++
          } else if (result.conflict) {
            // Conflito detectado (Req 19.6): Preserva ambas as versões e sinaliza
            this.queue.updateStatus(mutation.clientMutationId, 'conflict', result.error, result.serverState)
            conflicts++
          } else {
            // Falha temporária (erro de rede ou validação): Mantém para retentativa posterior
            this.queue.updateStatus(mutation.clientMutationId, 'failed', result.error)
            failed++
          }
        } catch (err: any) {
          this.queue.updateStatus(mutation.clientMutationId, 'failed', err?.message || 'Erro de rede ao sincronizar')
          failed++
        }
      }
    } finally {
      this.isSyncing = false
    }

    return { synced, conflicts, failed }
  }

  /**
   * Resolve um conflito de sincronização apontado pelo usuário (Req 19.6).
   */
  async resolveConflict(
    clientMutationId: string,
    choice: 'keep_local' | 'keep_server',
    executor?: ApiMutationExecutor,
  ): Promise<boolean> {
    const conflicts = this.queue.getConflicts()
    const target = conflicts.find((m) => m.clientMutationId === clientMutationId)

    if (!target) {
      return false
    }

    if (choice === 'keep_server') {
      // Descarta a mutação local e remove da fila
      this.queue.remove(clientMutationId)
      return true
    } else {
      // Re-enfileira a mutação local para forçar o reenvio ao backend
      this.queue.updateStatus(clientMutationId, 'pending')
      if (executor) {
        await this.syncPending(executor)
      }
      return true
    }
  }

  /**
   * Retorna a fila de mutações gerenciada pelo engine.
   */
  getQueue(): MutationQueue {
    return this.queue
  }

  private generateUuidV4(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    // Fallback determinístico para ambientes legados sem crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}
