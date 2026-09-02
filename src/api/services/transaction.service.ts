// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION APPLICATION SERVICE (API-002B)
// ─────────────────────────────────────────────────────────────────────────────

import { NotFoundError, ValidationError } from '../errors.ts'
import { AccountRepository } from '../repositories/account.repository.ts'
import { TransactionRepository, type TransactionFilter, type TransactionRecord } from '../repositories/transaction.repository.ts'

export interface CreateIncomeDTO {
  householdId: string
  accountId: string
  amountCents: number | bigint
  accrualDate: string
  paymentStatus: 'paid' | 'pending'
  description?: string
}

export interface CreateExpenseDTO {
  householdId: string
  accountId: string
  categoryId?: string
  amountCents: number | bigint
  accrualDate: string
  paymentStatus: 'paid' | 'pending'
  description?: string
}

export interface UpdateTransactionDTO {
  amountCents?: number | bigint
  accountId?: string
  categoryId?: string
  accrualDate?: string
  paymentStatus?: 'paid' | 'pending'
  description?: string
}

export class TransactionService {
  private readonly transactionRepo: TransactionRepository
  private readonly accountRepo: AccountRepository

  constructor(
    transactionRepo: TransactionRepository,
    accountRepo: AccountRepository,
  ) {
    this.transactionRepo = transactionRepo
    this.accountRepo = accountRepo
  }

  /**
   * Cria uma transação de receita na household ativa (Req 8.1, 8.5).
   * Rejeita valores <= 0.
   */
  async createIncome(dto: CreateIncomeDTO): Promise<TransactionRecord> {
    const amount = Number(dto.amountCents)
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('O valor do lançamento deve ser maior que zero.')
    }

    const account = await this.accountRepo.findById(dto.accountId)
    if (!account) {
      throw new NotFoundError(`Conta id ${dto.accountId} não encontrada.`)
    }

    const paidAt = dto.paymentStatus === 'paid' ? new Date().toISOString() : undefined

    return this.transactionRepo.save({
      household_id: dto.householdId,
      type: 'income',
      amount_cents: amount,
      account_id: dto.accountId,
      accrual_date: dto.accrualDate,
      payment_status: dto.paymentStatus,
      paid_at: paidAt,
      external_ref: dto.description,
      source: 'manual',
    })
  }

  /**
   * Cria uma transação de despesa na household ativa (Req 8.2, 8.5).
   * Rejeita valores <= 0.
   */
  async createExpense(dto: CreateExpenseDTO): Promise<TransactionRecord> {
    const amount = Number(dto.amountCents)
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('O valor do lançamento deve ser maior que zero.')
    }

    const account = await this.accountRepo.findById(dto.accountId)
    if (!account) {
      throw new NotFoundError(`Conta id ${dto.accountId} não encontrada.`)
    }

    const paidAt = dto.paymentStatus === 'paid' ? new Date().toISOString() : undefined

    return this.transactionRepo.save({
      household_id: dto.householdId,
      type: 'expense',
      amount_cents: amount,
      account_id: dto.accountId,
      category_id: dto.categoryId,
      accrual_date: dto.accrualDate,
      payment_status: dto.paymentStatus,
      paid_at: paidAt,
      external_ref: dto.description,
      source: 'manual',
    })
  }

  /**
   * Atualiza dados de uma transação existente.
   */
  async updateTransaction(id: string, dto: UpdateTransactionDTO): Promise<TransactionRecord> {
    const existing = await this.transactionRepo.findById(id)
    if (!existing) {
      throw new NotFoundError(`Transação id ${id} não encontrada.`)
    }

    if (dto.amountCents !== undefined) {
      const amount = Number(dto.amountCents)
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new ValidationError('O valor do lançamento deve ser maior que zero.')
      }
    }

    const nextPaymentStatus = dto.paymentStatus !== undefined ? dto.paymentStatus : existing.payment_status
    let paidAt = existing.paid_at
    if (dto.paymentStatus === 'paid' && existing.payment_status === 'pending') {
      paidAt = new Date().toISOString()
    } else if (dto.paymentStatus === 'pending') {
      paidAt = undefined
    }

    return this.transactionRepo.save({
      id: existing.id,
      household_id: existing.household_id,
      type: existing.type,
      amount_cents: dto.amountCents !== undefined ? dto.amountCents : existing.amount_cents,
      account_id: dto.accountId !== undefined ? dto.accountId : existing.account_id,
      counter_account_id: existing.counter_account_id,
      category_id: dto.categoryId !== undefined ? dto.categoryId : existing.category_id,
      accrual_date: dto.accrualDate !== undefined ? dto.accrualDate : existing.accrual_date,
      payment_status: nextPaymentStatus,
      paid_at: paidAt,
      external_ref: dto.description !== undefined ? dto.description : existing.external_ref,
    })
  }

  /**
   * Busca uma transação por ID.
   */
  async getTransactionById(id: string): Promise<TransactionRecord> {
    const tx = await this.transactionRepo.findById(id)
    if (!tx) {
      throw new NotFoundError(`Transação id ${id} não encontrada.`)
    }
    return tx
  }

  /**
   * Lista transações da household com filtros (datas, conta, categoria, status).
   */
  async listTransactions(householdId: string, filter?: TransactionFilter): Promise<TransactionRecord[]> {
    return this.transactionRepo.listByHousehold(householdId, filter)
  }

  /**
   * Exclui uma transação atomicamente gerando registro em audit_logs (Req 8.8 / API-001).
   */
  async deleteTransaction(id: string): Promise<void> {
    await this.transactionRepo.delete(id)
  }
}
