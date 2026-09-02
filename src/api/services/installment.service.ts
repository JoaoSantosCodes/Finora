// ─────────────────────────────────────────────────────────────────────────────
// INSTALLMENT APPLICATION SERVICE (API-002D)
// ─────────────────────────────────────────────────────────────────────────────

import { canUse } from '../../../packages/core/src/entitlement.ts'
import type { PlanId } from '../../../packages/core/src/plans.ts'
import { NotFoundError, PlanLimitExceededError, ValidationError } from '../errors.ts'
import { AccountRepository } from '../repositories/account.repository.ts'
import { CategoryRepository } from '../repositories/category.repository.ts'
import { TransactionRepository } from '../repositories/transaction.repository.ts'

export interface CreateInstallmentPlanDTO {
  householdId: string
  accountId: string
  categoryId: string
  totalCents: number | bigint
  installmentsCount: number
  firstDueDate: string
  description: string
  planId?: PlanId
}

export interface CreateInstallmentResult {
  installmentPlanId: string
  transactionId: string
}

export class InstallmentService {
  private readonly transactionRepo: TransactionRepository
  private readonly accountRepo: AccountRepository
  private readonly categoryRepo: CategoryRepository

  constructor(
    transactionRepo: TransactionRepository,
    accountRepo: AccountRepository,
    categoryRepo: CategoryRepository,
  ) {
    this.transactionRepo = transactionRepo
    this.accountRepo = accountRepo
    this.categoryRepo = categoryRepo
  }

  /**
   * Cria atômica e matematicamente um plano de parcelamento (Req 11.1, 11.2, 18.2).
   * Valida autorização da funcionalidade no plano (`canUse`).
   */
  async createInstallmentPlan(dto: CreateInstallmentPlanDTO): Promise<CreateInstallmentResult> {
    const plan: PlanId = dto.planId || 'free'

    // 1. Verificação do FeatureGate (Req 18.2)
    const decision = canUse(plan, 'installments')
    if (!decision.allowed) {
      throw new PlanLimitExceededError('installments', 0, 'O recurso de parcelamento não está disponível no plano atual.')
    }

    // 2. Validação: Valor total > 0 (Req 11.1, 8.5)
    const total = Number(dto.totalCents)
    if (!Number.isInteger(total) || total <= 0) {
      throw new ValidationError('O valor total do parcelamento deve ser maior que zero.')
    }

    // 3. Validação: N >= 2 parcelas (Req 11.1)
    if (!Number.isInteger(dto.installmentsCount) || dto.installmentsCount < 2) {
      throw new ValidationError('O número de parcelas deve ser no mínimo 2.')
    }

    if (!dto.description || dto.description.trim().length === 0) {
      throw new ValidationError('A descrição do parcelamento é obrigatória.')
    }

    // 4. Verificação de existência da conta sob RLS
    const account = await this.accountRepo.findById(dto.accountId)
    if (!account) {
      throw new NotFoundError(`Conta id ${dto.accountId} não encontrada.`)
    }

    // 5. Verificação de existência da categoria sob RLS
    const category = await this.categoryRepo.findById(dto.categoryId)
    if (!category) {
      throw new NotFoundError(`Categoria id ${dto.categoryId} não encontrada.`)
    }

    // 6. Execução atômica via RPC SQL rpc_create_installment_transaction (API-001)
    return this.transactionRepo.createInstallmentPlan({
      householdId: dto.householdId,
      accountId: dto.accountId,
      categoryId: dto.categoryId,
      totalCents: total,
      installmentsCount: dto.installmentsCount,
      firstDueDate: dto.firstDueDate,
      description: dto.description.trim(),
    })
  }
}
