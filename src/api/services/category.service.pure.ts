// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO APPLICATION SERVICE DE CATEGORIAS (API-002F)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { ValidationError } from '../errors.ts'
import { CategoryRepository, type CategoryRecord } from '../repositories/category.repository.ts'
import { TransactionRepository, type TransactionRecord } from '../repositories/transaction.repository.ts'
import { CategoryService } from './category.service.ts'

const mockCategories: CategoryRecord[] = [
  { id: 'cat-1', household_id: 'h-1', name: 'Alimentação', classification: 'Essencial', color: '#ff0000' },
  { id: 'cat-2', household_id: 'h-1', name: 'Lazer', classification: 'Supérfluo', color: '#00ff00' },
]

const mockTransactions: TransactionRecord[] = [
  { id: 'tx-1', household_id: 'h-1', type: 'expense', amount_cents: 5000, account_id: 'acc-1', category_id: 'cat-1', payment_status: 'paid', accrual_date: '2026-09-01' },
]

function createService(
  categories: CategoryRecord[] = mockCategories,
  txs: TransactionRecord[] = mockTransactions,
) {
  let savedCategory: CategoryRecord | null = null
  let deletedCategoryId: string | null = null
  let updatedTxs: TransactionRecord[] = []

  const categoryRepo = {
    findById: async (id: string) => categories.find((c) => c.id === id) || null,
    listByHousehold: async (_hId: string) => [...categories],
    save: async (cat: CategoryRecord) => {
      savedCategory = cat
      return { ...cat, id: cat.id || 'cat-new' }
    },
    delete: async (id: string) => {
      deletedCategoryId = id
    },
  } as unknown as CategoryRepository

  const transactionRepo = {
    listByHousehold: async (_hId: string, filter?: any) => {
      let result = [...txs]
      if (filter?.categoryId) result = result.filter((t) => t.category_id === filter.categoryId)
      return result
    },
    save: async (tx: TransactionRecord) => {
      updatedTxs.push(tx)
      return tx
    },
  } as unknown as TransactionRepository

  return {
    service: new CategoryService(categoryRepo, transactionRepo),
    getSavedCategory: () => savedCategory,
    getDeletedCategoryId: () => deletedCategoryId,
    getUpdatedTxs: () => updatedTxs,
  }
}

export async function runCategoryServiceTests(): Promise<void> {
  // 1. Criação legítima de categoria
  const { service: s1, getSavedCategory: getCat1 } = createService([])
  const cat = await s1.createCategory({
    householdId: 'h-1',
    name: 'Mercado',
    classification: 'Essencial',
    color: '#123456',
  })
  assert.equal(cat.name, 'Mercado')
  assert.equal(cat.classification, 'Essencial')
  assert.equal(getCat1()?.color, '#123456')

  // 2. Rejeição de nome duplicado case-insensitive (Req 7.7)
  const { service: s2 } = createService([mockCategories[0]]) // "Alimentação"
  await assert.rejects(
    async () => {
      await s2.createCategory({
        householdId: 'h-1',
        name: 'alimentação', // minúsculas igual ao existente
        classification: 'Fixo',
      })
    },
    (err: any) => err instanceof ValidationError && err.message.includes('Já existe uma categoria'),
  )

  // 3. Rejeição de classificação inválida (Req 7.3)
  const { service: s3 } = createService([])
  await assert.rejects(
    async () => {
      await s3.createCategory({
        householdId: 'h-1',
        name: 'Restaurante',
        classification: 'Invalida' as any,
      })
    },
    (err: any) => err instanceof ValidationError && err.message.includes('classificação'),
  )

  // 4. Rejeição de exclusão de categoria com transações sem substituta (Req 7.6)
  const { service: s4 } = createService()
  await assert.rejects(
    async () => {
      await s4.deleteCategory('cat-1') // cat-1 possui tx-1 vinculada
    },
    (err: any) => err instanceof ValidationError && err.message.includes('substituta'),
  )

  // 5. Exclusão com sucesso ao informar categoria substituta (Req 7.6)
  const { service: s5, getDeletedCategoryId: getDel5, getUpdatedTxs: getUpdated5 } = createService()
  await s5.deleteCategory('cat-1', 'cat-2')

  assert.equal(getDel5(), 'cat-1')
  assert.equal(getUpdated5().length, 1)
  assert.equal(getUpdated5()[0].category_id, 'cat-2')

  console.log('  ok — API-002F: CategoryService passou em todos os 5 testes (criação válida, duplicidade case-insensitive, classificação estrita, exclusão com reatribuição obrigatoria)')
}
