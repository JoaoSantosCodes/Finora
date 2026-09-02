// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT REPOSITORY (API-001)
// ─────────────────────────────────────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import { DatabaseError, NotFoundError, PermissionDeniedError } from '../errors'

export interface AccountRecord {
  id?: string
  household_id: string
  name: string
  type: 'checking' | 'savings' | 'wallet' | 'credit_card'
  initial_balance_cents?: bigint | number
  archived?: boolean
  created_at?: string
  updated_at?: string
}

export class AccountRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<AccountRecord | null> {
    const { data, error } = await this.db.from('accounts').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null // 0 rows
      throw new DatabaseError(`Erro ao buscar conta por id ${id}`, error)
    }
    return data
  }

  async listByHousehold(householdId: string): Promise<AccountRecord[]> {
    const { data, error } = await this.db
      .from('accounts')
      .select('*')
      .eq('household_id', householdId)
      .order('name')

    if (error) throw new DatabaseError('Erro ao listar contas do household', error)
    return data || []
  }

  async save(account: AccountRecord): Promise<AccountRecord> {
    if (account.id) {
      const { data, count, error } = await this.db
        .from('accounts')
        .update(
          {
            name: account.name,
            type: account.type,
            archived: account.archived ?? false,
          },
          { count: 'exact' },
        )
        .eq('id', account.id)
        .select('*')

      if (error) throw new DatabaseError('Erro ao atualizar conta', error)
      if (count === 0 || !data || data.length === 0) {
        const existing = await this.findById(account.id)
        if (existing) {
          throw new PermissionDeniedError('Permissão negada pelo RLS para atualizar esta conta.')
        }
        throw new NotFoundError(`Conta id ${account.id} não encontrada.`)
      }
      return data[0]
    } else {
      const { data, error } = await this.db.from('accounts').insert(account).select('*').single()
      if (error) throw new DatabaseError('Erro ao criar conta', error)
      return data
    }
  }

  async archive(id: string): Promise<void> {
    const { data, count, error } = await this.db
      .from('accounts')
      .update({ archived: true }, { count: 'exact' })
      .eq('id', id)
      .select('*')

    if (error) throw new DatabaseError('Erro ao arquivar conta', error)
    if (count === 0 || !data || data.length === 0) {
      const existing = await this.findById(id)
      if (existing) {
        throw new PermissionDeniedError('Permissão negada pelo RLS para arquivar esta conta.')
      }
      throw new NotFoundError(`Conta id ${id} não encontrada.`)
    }
  }
}
