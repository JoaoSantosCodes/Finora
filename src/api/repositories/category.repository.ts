// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY REPOSITORY (API-001)
// ─────────────────────────────────────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import { DatabaseError, NotFoundError, PermissionDeniedError } from '../errors.ts'

export interface CategoryRecord {
  id?: string
  household_id: string
  name: string
  classification?: 'Essencial' | 'Fixo' | 'Variável' | 'Supérfluo'
  icon?: string
  color?: string
  created_at?: string
  updated_at?: string
}

export class CategoryRepository {
  private readonly db: SupabaseClient

  constructor(db: SupabaseClient) {
    this.db = db
  }

  async findById(id: string): Promise<CategoryRecord | null> {
    const { data, error } = await this.db.from('categories').select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new DatabaseError(`Erro ao buscar categoria por id ${id}`, error)
    }
    return data
  }

  async listByHousehold(householdId: string): Promise<CategoryRecord[]> {
    const { data, error } = await this.db
      .from('categories')
      .select('*')
      .eq('household_id', householdId)
      .order('name')

    if (error) throw new DatabaseError('Erro ao listar categorias', error)
    return data || []
  }

  async save(category: CategoryRecord): Promise<CategoryRecord> {
    if (category.id) {
      const { data, count, error } = await this.db
        .from('categories')
        .update(
          {
            name: category.name,
            classification: category.classification,
            icon: category.icon,
            color: category.color,
          },
          { count: 'exact' },
        )
        .eq('id', category.id)
        .select('*')

      if (error) throw new DatabaseError('Erro ao atualizar categoria', error)
      if (count === 0 || !data || data.length === 0) {
        const existing = await this.findById(category.id)
        if (existing) {
          throw new PermissionDeniedError('Permissão negada pelo RLS para alterar esta categoria.')
        }
        throw new NotFoundError(`Categoria id ${category.id} não encontrada.`)
      }
      return data[0]
    } else {
      const { data, error } = await this.db.from('categories').insert(category).select('*').single()
      if (error) throw new DatabaseError('Erro ao criar categoria', error)
      return data
    }
  }

  async delete(id: string): Promise<void> {
    const { data, count, error } = await this.db
      .from('categories')
      .delete({ count: 'exact' })
      .eq('id', id)
      .select('*')

    if (error) throw new DatabaseError('Erro ao excluir categoria', error)
    if (count === 0 || !data || data.length === 0) {
      const existing = await this.findById(id)
      if (existing) {
        throw new PermissionDeniedError('Permissão negada pelo RLS para excluir esta categoria.')
      }
      throw new NotFoundError(`Categoria id ${id} não encontrada.`)
    }
  }
}
