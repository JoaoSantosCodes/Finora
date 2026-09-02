// ─────────────────────────────────────────────────────────────────────────────
// CREDIT CARD REPOSITORY (API-001)
// ─────────────────────────────────────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import { DatabaseError, NotFoundError, PermissionDeniedError } from '../errors'

export interface CreditCardRecord {
  id?: string
  household_id: string
  name: string
  limit_cents: number | bigint
  closing_day: number
  due_day: number
  created_at?: string
  updated_at?: string
}

export interface CreditCardInvoiceRecord {
  id?: string
  household_id?: string
  credit_card_id: string
  cycle: string
  due_date: string
  status: 'open' | 'closed' | 'paid' | 'overdue'
}

export class CreditCardRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<CreditCardRecord | null> {
    const { data, error } = await this.db.from('credit_cards').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new DatabaseError(`Erro ao buscar cartão de crédito por id ${id}`, error)
    }
    return data
  }

  async listByHousehold(householdId: string): Promise<CreditCardRecord[]> {
    const { data, error } = await this.db
      .from('credit_cards')
      .select('*')
      .eq('household_id', householdId)
      .order('name')

    if (error) throw new DatabaseError('Erro ao listar cartões de crédito', error)
    return data || []
  }

  async getInvoice(cardId: string, cycle: string): Promise<CreditCardInvoiceRecord | null> {
    const { data, error } = await this.db
      .from('credit_card_invoices')
      .select('*')
      .eq('credit_card_id', cardId)
      .eq('cycle', cycle)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new DatabaseError('Erro ao buscar fatura do cartão', error)
    }
    return data
  }

  async save(card: CreditCardRecord): Promise<CreditCardRecord> {
    if (card.id) {
      const { data, count, error } = await this.db
        .from('credit_cards')
        .update(
          {
            name: card.name,
            limit_cents: card.limit_cents,
            closing_day: card.closing_day,
            due_day: card.due_day,
          },
          { count: 'exact' },
        )
        .eq('id', card.id)
        .select('*')

      if (error) throw new DatabaseError('Erro ao atualizar cartão de crédito', error)
      if (count === 0 || !data || data.length === 0) {
        const existing = await this.findById(card.id)
        if (existing) {
          throw new PermissionDeniedError('Permissão negada pelo RLS para alterar este cartão de crédito.')
        }
        throw new NotFoundError(`Cartão id ${card.id} não encontrado.`)
      }
      return data[0]
    } else {
      const { data, error } = await this.db.from('credit_cards').insert(card).select('*').single()
      if (error) throw new DatabaseError('Erro ao criar cartão de crédito', error)
      return data
    }
  }
}
