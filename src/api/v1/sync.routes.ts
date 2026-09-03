// ─────────────────────────────────────────────────────────────────────────────
// SYNC REST ROUTES /v1/sync/mutations (SYNC-001)
// Controller backend para processamento idempotente de lotes de mutações offline (DB-006)
// ─────────────────────────────────────────────────────────────────────────────

import type { SyncMutation } from '../sync/mutation_queue.ts'
import { DomainError } from '../errors.ts'

export interface SyncRepository {
  hasMutation(householdId: string, clientMutationId: string): Promise<boolean>
  recordMutation(householdId: string, clientMutationId: string, entityType: string, action: string): Promise<void>
}

export class SyncController {
  private readonly syncRepo: SyncRepository
  private readonly serviceDispatcher: (mutation: SyncMutation) => Promise<any>

  constructor(
    syncRepo: SyncRepository,
    serviceDispatcher: (mutation: SyncMutation) => Promise<any>,
  ) {
    this.syncRepo = syncRepo
    this.serviceDispatcher = serviceDispatcher
  }

  /**
   * Processa uma única mutação garantindo idempotência e prevenindo reexecução (DB-006, Req 13).
   */
  async processMutation(mutation: SyncMutation): Promise<{ success: boolean; alreadyApplied?: boolean; conflict?: boolean; error?: string }> {
    try {
      // 1. Verificação de idempotência (DB-006): sync_mutations (household_id, client_mutation_id)
      const alreadyProcessed = await this.syncRepo.hasMutation(mutation.householdId, mutation.clientMutationId)
      if (alreadyProcessed) {
        return { success: true, alreadyApplied: true }
      }

      // 2. Despachar para o serviço de aplicação correspondente
      await this.serviceDispatcher(mutation)

      // 3. Registrar a mutação como processada na tabela sync_mutations
      await this.syncRepo.recordMutation(
        mutation.householdId,
        mutation.clientMutationId,
        mutation.entityType,
        mutation.action,
      )

      return { success: true }
    } catch (err: any) {
      if (err instanceof DomainError && err.name === 'ConflictError') {
        return { success: false, conflict: true, error: err.message }
      }

      return {
        success: false,
        error: err?.message || 'Erro ao processar mutação de sincronização.',
      }
    }
  }
}
