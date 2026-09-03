// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY APPLICATION SERVICE (API-002F)
// ─────────────────────────────────────────────────────────────────────────────

import { canCreate } from '../../../packages/core/src/entitlement.ts'
import type { PlanId } from '../../../packages/core/src/plans.ts'
import { NotFoundError, PlanLimitExceededError, ValidationError } from '../errors.ts'
import { CategoryRepository, type CategoryRecord } from '../repositories/category.repository.ts'
import { TransactionRepository } from '../repositories/transaction.repository.ts'

export type CategoryClassification = 'Essencial' | 'Fixo' | 'Variável' | 'Supérfluo'

const VALID_CLASSIFICATIONS = new Set<string>(['Essencial', 'Fixo', 'Variável', 'Supérfluo'])

export interface CreateCategoryDTO {
  householdId: string
  name: string
  classification: CategoryClassification
  color?: string
  icon?: string
  planId?: PlanId
}

export interface UpdateCategoryDTO {
  name?: string
  classification?: CategoryClassification
  color?: string
  icon?: string
}

export class CategoryService {
  private readonly categoryRepo: CategoryRepository
  private readonly transactionRepo: TransactionRepository

  constructor(
    categoryRepo: CategoryRepository,
    transactionRepo: TransactionRepository,
  ) {
    this.categoryRepo = categoryRepo
    this.transactionRepo = transactionRepo
  }

  /**
   * Cria uma nova categoria personalizada na household ativa (Req 7.1, 7.3, 7.7, 18.1).
   * Valida classificação, unicidade case-insensitive de nome e limite do plano.
   */
  async createCategory(dto: CreateCategoryDTO): Promise<CategoryRecord> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError('O nome da categoria é obrigatório.')
    }

    if (!dto.classification || !VALID_CLASSIFICATIONS.has(dto.classification)) {
      throw new ValidationError('A classificação da categoria deve ser Essencial, Fixo, Variável ou Supérfluo.')
    }

    const existingCategories = await this.categoryRepo.listByHousehold(dto.householdId)

    // Unicidade case-insensitive de nome por household (Req 7.7)
    const trimmedName = dto.name.trim()
    const duplicate = existingCategories.some(
      (cat) => cat.name.toLowerCase() === trimmedName.toLowerCase(),
    )
    if (duplicate) {
      throw new ValidationError(`Já existe uma categoria com o nome "${trimmedName}" na household.`)
    }

    const plan: PlanId = dto.planId || 'free'
    const activeCount = existingCategories.length

    // Verificação de limite do plano via FeatureGate (Req 18.1)
    const decision = canCreate(plan, 'categories', activeCount)
    if (!decision.allowed) {
      throw new PlanLimitExceededError('categories', decision.limit || activeCount)
    }

    return this.categoryRepo.save({
      household_id: dto.householdId,
      name: trimmedName,
      classification: dto.classification,
      color: dto.color,
      icon: dto.icon,
    })
  }

  /**
   * Atualiza dados de uma categoria existente.
   */
  async updateCategory(id: string, dto: UpdateCategoryDTO): Promise<CategoryRecord> {
    const existing = await this.categoryRepo.findById(id)
    if (!existing) {
      throw new NotFoundError(`Categoria id ${id} não encontrada.`)
    }

    let updatedName = existing.name
    if (dto.name !== undefined) {
      const trimmed = dto.name.trim()
      if (trimmed.length === 0) {
        throw new ValidationError('O nome da categoria não pode ser vazio.')
      }

      if (trimmed.toLowerCase() !== existing.name.toLowerCase()) {
        const categories = await this.categoryRepo.listByHousehold(existing.household_id)
        const duplicate = categories.some(
          (cat) => cat.id !== id && cat.name.toLowerCase() === trimmed.toLowerCase(),
        )
        if (duplicate) {
          throw new ValidationError(`Já existe uma categoria com o nome "${trimmed}" na household.`)
        }
      }
      updatedName = trimmed
    }

    let updatedClassification = existing.classification
    if (dto.classification !== undefined) {
      if (!VALID_CLASSIFICATIONS.has(dto.classification)) {
        throw new ValidationError('A classificação da categoria deve ser Essencial, Fixo, Variável ou Supérfluo.')
      }
      updatedClassification = dto.classification
    }

    return this.categoryRepo.save({
      id: existing.id,
      household_id: existing.household_id,
      name: updatedName,
      classification: updatedClassification,
      color: dto.color !== undefined ? dto.color : existing.color,
      icon: dto.icon !== undefined ? dto.icon : existing.icon,
    })
  }

  /**
   * Obtém categoria por ID sob RLS.
   */
  async getCategoryById(id: string): Promise<CategoryRecord> {
    const category = await this.categoryRepo.findById(id)
    if (!category) {
      throw new NotFoundError(`Categoria id ${id} não encontrada.`)
    }
    return category
  }

  /**
   * Lista categorias da household (Req 7.5).
   */
  async listCategories(householdId: string): Promise<CategoryRecord[]> {
    return this.categoryRepo.listByHousehold(householdId)
  }

  /**
   * Exclui uma categoria (Req 7.6).
   * Se houver transações vinculadas e nenhuma categoria substituta for informada, lança ValidationError.
   */
  async deleteCategory(id: string, replacementCategoryId?: string): Promise<void> {
    const category = await this.getCategoryById(id)

    // Verificar transações associadas
    const txs = await this.transactionRepo.listByHousehold(category.household_id, { categoryId: id })
    if (txs.length > 0) {
      if (!replacementCategoryId) {
        throw new ValidationError('Esta categoria possui transações vinculadas. Selecione uma categoria substituta para prosseguir com a exclusão.')
      }

      const replacement = await this.categoryRepo.findById(replacementCategoryId)
      if (!replacement) {
        throw new NotFoundError(`Categoria substituta id ${replacementCategoryId} não encontrada.`)
      }

      // Reatribuir transações para a categoria substituta
      for (const tx of txs) {
        await this.transactionRepo.save({
          ...tx,
          category_id: replacementCategoryId,
        })
      }
    }

    await this.categoryRepo.delete(id)
  }
}
