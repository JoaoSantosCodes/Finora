// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION REPOSITORY (API-001)
// ─────────────────────────────────────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import { DatabaseError, NotFoundError, PermissionDeniedError } from '../errors'

export interface TransactionRecord {
  id?: string
  household_id: string
  type: 'income' | 'expense' | 'transfer'
  amount_cents: number | bigint
  account_id: string
  counter_account_id?: string
  category_id?: string
  accrual_date: string
  payment_status: 'paid' | 'pending'
  paid_at?: string
  credit_card_id?: string
  installment_id?: string
  description?: string
  external_ref?: string
  source?: 'manual' | 'sync' | 'import'
  created_at?: string
  updated_at?: string
}

export interface TransactionFilter {
  startDate?: string
  endDate?: string
  accountId?: string
  categoryId?: string
  paymentStatus?: 'paid' | 'pending'
}

export class TransactionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<TransactionRecord | null> {
    const { data, error } = await this.db.from('transactions').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new DatabaseError(`Erro ao buscar transação por id ${id}`, error)
    }
    return data
  }

  async listByHousehold(householdId: string, filter?: TransactionFilter): Promise<TransactionRecord[]> {
    let query = this.db.from('transactions').select('*').eq('household_id', householdId)

    if (filter?.startDate) query = query.gte('accrual_date', filter.startDate)
    if (filter?.endDate) query = query.lte('accrual_date', filter.endDate)
    if (filter?.accountId) query = query.eq('account_id', filter.accountId)
    if (filter?.categoryId) query = query.eq('category_id', filter.categoryId)
    if (filter?.paymentStatus) query = query.eq('payment_status', filter.paymentStatus)

    const { data, error } = await query.order('accrual_date', { ascending: false })
    if (error) throw new DatabaseError('Erro ao listar transações', error)
    return data || []
  }

  async save(tx: TransactionRecord): Promise<TransactionRecord> {
    if (tx.id) {
      const { data, count, error } = await this.db
        .from('transactions')
        .update(
          {
            type: tx.type,
            amount_cents: tx.amount_cents,
            account_id: tx.account_id,
            counter_account_id: tx.counter_account_id,
            category_id: tx.category_id,
            accrual_date: tx.accrual_date,
            payment_status: tx.payment_status,
            paid_at: tx.paid_at,
            external_ref: tx.description || tx.external_ref,
          },
          { count: 'exact' },
        )
        .eq('id', tx.id)
        .select('*')

      if (error) throw new DatabaseError('Erro ao atualizar transação', error)
      if (count === 0 || !data || data.length === 0) {
        const existing = await this.findById(tx.id)
        if (existing) {
          throw new PermissionDeniedError('Permissão negada pelo RLS para alterar esta transação.')
        }
        throw new NotFoundError(`Transação id ${tx.id} não encontrada.`)
      }
      return data[0]
    } else {
      const { data, error } = await this.db.from('transactions').insert(tx).select('*').single()
      if (error) throw new DatabaseError('Erro ao criar transação', error)
      return data
    }
  }

  /**
    * Executa transferência entre contas via RPC atômica SECURITY INVOKER no Postgres
    */
  async transfer(params: {
    householdId: string
    sourceAccountId: string
    targetAccountId: string
    amountCents: number | bigint
    accrualDate: string
    description?: string
  }): Promise<{ transactionId: string }> {
    const { data, error } = await this.db.rpc('rpc_transfer_funds', {
      p_household_id: params.householdId,
      p_source_account_id: params.sourceAccountId,
      p_target_account_id: params.targetAccountId,
      p_amount_cents: params.amountCents,
      p_accrual_date: params.accrualDate,
      p_description: params.description || null,
    })

    if (error) throw new DatabaseError(`Falha na transferência via RPC: ${error.message}`, error)
    return { transactionId: data.transaction_id }
  }

  /**
    * Executa criação de lançamento parcelado via RPC atômica SECURITY INVOKER no Postgres
    */
  async createInstallmentPlan(params: {
    householdId: string
    accountId: string
    categoryId: string
    totalCents: number | bigint
    installmentsCount: number
    firstDueDate: string
    description: string
  }): Promise<{ installmentPlanId: string; transactionId: string }> {
    const { data, error } = await this.db.rpc('rpc_create_installment_transaction', {
      p_household_id: params.householdId,
      p_account_id: params.accountId,
      p_category_id: params.categoryId,
      p_total_cents: params.totalCents,
      p_installments_count: params.installmentsCount,
      p_first_due_date: params.firstDueDate,
      p_description: params.description,
    })

    if (error) throw new DatabaseError(`Falha no parcelamento via RPC: ${error.message}`, error)
    return {
      installmentPlanId: data.installment_plan_id,
      transactionId: data.transaction_id,
    }
  }

  /**
    * Executa exclusão física de transação com auditoria atômica via RPC SECURITY INVOKER
    */
  async delete(id: string): Promise<void> {
    const { error } = await this.db.rpc('rpc_delete_transaction_with_audit', {
      p_transaction_id: id,
    })

    if (error) {
      if (error.message.includes('TRANSACTION_NOT_FOUND')) {
        const existing = await this.findById(id)
        if (existing) {
          throw new PermissionDeniedError('Permissão negada pelo RLS para excluir esta transação.')
        }
        throw new NotFoundError(`Transação id ${id} não encontrada.`)
      }
      throw new DatabaseError(`Erro ao excluir transação via RPC: ${error.message}`, error)
    }
  }
}
