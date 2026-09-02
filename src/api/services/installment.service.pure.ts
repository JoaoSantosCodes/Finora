// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO APPLICATION SERVICE DE PARCELAMENTOS (API-002D)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { NotFoundError, ValidationError } from '../errors.ts'
import { AccountRepository, type AccountRecord } from '../repositories/account.repository.ts'
import { CategoryRepository, type CategoryRecord } from '../repositories/category.repository.ts'
import { TransactionRepository } from '../repositories/transaction.repository.ts'
import { InstallmentService } from './installment.service.ts'

const mockAccount: AccountRecord = {
  id: 'acc-1',
  household_id: 'h-1',
  name: 'Conta Corrente',
  type: 'checking',
  initial_balance_cents: 100000,
  archived: false,
}

const mockCategory: CategoryRecord = {
  id: 'cat-1',
  household_id: 'h-1',
  name: 'Eletrônicos',
  classification: 'Variável',
}

function createService(
  account: AccountRecord | null = mockAccount,
  category: CategoryRecord | null = mockCategory,
) {
  let createPlanCalledWith: any = null

  const accountRepo = {
    findById: async (id: string) => (account && account.id === id ? account : null),
  } as unknown as AccountRepository

  const categoryRepo = {
    findById: async (id: string) => (category && category.id === id ? category : null),
  } as unknown as CategoryRepository

  const transactionRepo = {
    createInstallmentPlan: async (params: any) => {
      createPlanCalledWith = params
      return {
        installmentPlanId: 'plan-1',
        transactionId: 'tx-parent-1',
      }
    },
  } as unknown as TransactionRepository

  return {
    service: new InstallmentService(transactionRepo, accountRepo, categoryRepo),
    getCreatePlanCalledWith: () => createPlanCalledWith,
  }
}

export async function runInstallmentServiceTests(): Promise<void> {
  // 1. Criação legítima de parcelamento (N=3)
  const { service: s1, getCreatePlanCalledWith: getPlan1 } = createService()
  const result = await s1.createInstallmentPlan({
    householdId: 'h-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    totalCents: 15000,
    installmentsCount: 3,
    firstDueDate: '2026-09-10',
    description: 'Notebook em 3x',
    planId: 'free', // No free parcelamentos são habilitados por padrão na matriz
  })

  assert.equal(result.installmentPlanId, 'plan-1')
  assert.equal(result.transactionId, 'tx-parent-1')
  assert.deepEqual(getPlan1(), {
    householdId: 'h-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    totalCents: 15000,
    installmentsCount: 3,
    firstDueDate: '2026-09-10',
    description: 'Notebook em 3x',
  })

  // 2. Bloqueio por N < 2 parcelas (Req 11.1)
  const { service: s2 } = createService()
  await assert.rejects(
    async () => {
      await s2.createInstallmentPlan({
        householdId: 'h-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        totalCents: 10000,
        installmentsCount: 1,
        firstDueDate: '2026-09-10',
        description: 'Compra 1x',
      })
    },
    (err: any) => err instanceof ValidationError && err.message.includes('mínimo 2'),
  )

  // 3. Bloqueio por valor total <= 0 (Req 8.5, 11.1)
  const { service: s3 } = createService()
  await assert.rejects(
    async () => {
      await s3.createInstallmentPlan({
        householdId: 'h-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        totalCents: 0,
        installmentsCount: 3,
        firstDueDate: '2026-09-10',
        description: 'Compra 0 reais',
      })
    },
    (err: any) => err instanceof ValidationError && err.message.includes('maior que zero'),
  )

  // 4. Bloqueio por conta inexistente
  const { service: s4 } = createService(null, mockCategory) // Sem conta
  await assert.rejects(
    async () => {
      await s4.createInstallmentPlan({
        householdId: 'h-1',
        accountId: 'acc-invalid',
        categoryId: 'cat-1',
        totalCents: 5000,
        installmentsCount: 2,
        firstDueDate: '2026-09-10',
        description: 'Compra invalida',
      })
    },
    (err: any) => err instanceof NotFoundError && err.message.includes('Conta'),
  )

  // 5. Bloqueio por categoria inexistente
  const { service: s5 } = createService(mockAccount, null) // Sem categoria
  await assert.rejects(
    async () => {
      await s5.createInstallmentPlan({
        householdId: 'h-1',
        accountId: 'acc-1',
        categoryId: 'cat-invalid',
        totalCents: 5000,
        installmentsCount: 2,
        firstDueDate: '2026-09-10',
        description: 'Compra sem categoria',
      })
    },
    (err: any) => err instanceof NotFoundError && err.message.includes('Categoria'),
  )

  console.log('  ok — API-002D: InstallmentService passou em todos os 5 testes (parcelamento em N=3, mínimo de 2 parcelas rejeitado, valor zero rejeitado, validação de conta/categoria)')
}
