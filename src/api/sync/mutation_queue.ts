// ─────────────────────────────────────────────────────────────────────────────
// MUTATION QUEUE FOR OFFLINE-FIRST SYNC ENGINE (SYNC-001)
// Gerencia a fila de mutações offline persistida em armazenamento local (Req 19.5, Req 13)
// ─────────────────────────────────────────────────────────────────────────────

export type EntityType = 'account' | 'transaction' | 'transfer' | 'installment' | 'credit_card' | 'category'
export type MutationAction = 'create' | 'update' | 'delete'
export type MutationStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed'

export interface SyncMutation<T = any> {
  clientMutationId: string // UUID v4 único para idempotência no backend
  householdId: string
  entityType: EntityType
  action: MutationAction
  payload: T
  createdAt: string
  status: MutationStatus
  error?: string
  serverState?: any // Estado do servidor preservado em caso de conflito (Req 19.6)
}

export class MutationQueue {
  private readonly storageKey: string
  private queue: SyncMutation[] = []

  constructor(storageKey = 'finora_sync_mutations_queue') {
    this.storageKey = storageKey
    this.loadFromStorage()
  }

  /**
   * Adiciona uma nova mutação à fila local (Req 19.5).
   */
  enqueue<T>(mutation: Omit<SyncMutation<T>, 'status' | 'createdAt'>): SyncMutation<T> {
    const fullMutation: SyncMutation<T> = {
      ...mutation,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }

    this.queue.push(fullMutation)
    this.saveToStorage()
    return fullMutation
  }

  /**
   * Retorna todas as mutações pendentes de envio.
   */
  getPending(): SyncMutation[] {
    return this.queue.filter((m) => m.status === 'pending' || m.status === 'failed')
  }

  /**
   * Retorna todas as mutações marcadas em conflito (Req 19.6).
   */
  getConflicts(): SyncMutation[] {
    return this.queue.filter((m) => m.status === 'conflict')
  }

  /**
   * Atualiza o status de uma mutação na fila.
   */
  updateStatus(clientMutationId: string, status: MutationStatus, error?: string, serverState?: any): void {
    const item = this.queue.find((m) => m.clientMutationId === clientMutationId)
    if (item) {
      item.status = status
      if (error !== undefined) item.error = error
      if (serverState !== undefined) item.serverState = serverState
      this.saveToStorage()
    }
  }

  /**
   * Remove uma mutação sincronizada com sucesso da fila.
   */
  remove(clientMutationId: string): void {
    this.queue = this.queue.filter((m) => m.clientMutationId !== clientMutationId)
    this.saveToStorage()
  }

  /**
   * Retorna a lista completa de mutações na fila.
   */
  getAll(): SyncMutation[] {
    return [...this.queue]
  }

  /**
   * Limpa todas as mutações da fila local.
   */
  clear(): void {
    this.queue = []
    this.saveToStorage()
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.storageKey)
        if (raw) {
          this.queue = JSON.parse(raw)
        }
      }
    } catch {
      this.queue = []
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.queue))
      }
    } catch {
      // Ignorar erros em ambientes puramente em memória (ex: Node/tests sem mock)
    }
  }
}
