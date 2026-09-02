// ─────────────────────────────────────────────────────────────────────────────
// CREDIT CARD APPLICATION SERVICE (API-002E)
// ─────────────────────────────────────────────────────────────────────────────

import { canCreate } from '../../../packages/core/src/entitlement.ts'
import type { PlanId } from '../../../packages/core/src/plans.ts'
import { invoiceDueDate } from '../../../packages/core/src/invoice.ts'
import { NotFoundError, PlanLimitExceededError, ValidationError } from '../errors.ts'
import { AccountRepository } from '../repositories/account.repository.ts'
import { CreditCardRepository, type CreditCardInvoiceRecord, type CreditCardRecord } from '../repositories/credit_card.repository.ts'
import { TransactionRepository } from '../repositories/transaction.repository.ts'

export interface CreateCreditCardDTO {
  householdId: string
  name: string
  limitCents: number | bigint
  closingDay: number
  dueDay: number
  planId?: PlanId
}

export interface UpdateCreditCardDTO {
  name?: string
  limitCents?: number | bigint
  closingDay?: number
  dueDay?: number
}

export interface PayInvoiceDTO {
  cardId: string
  cycle: string
  paymentAccountId: string
  amountCents: number | bigint
}

export class CreditCardService {
  private readonly cardRepo: CreditCardRepository
  private readonly transactionRepo: TransactionRepository
  private readonly accountRepo: AccountRepository

  constructor(
    cardRepo: CreditCardRepository,
    transactionRepo: TransactionRepository,
    accountRepo: AccountRepository,
  ) {
    this.cardRepo = cardRepo
    this.transactionRepo = transactionRepo
    this.accountRepo = accountRepo
  }

  /**
   * Cria um novo cartão de crédito na household ativa (Req 10.1, Req 18.1).
   * Valida limite do plano via FeatureGate (`canCreate`) e faixa de dias (1-31).
   */
  async createCreditCard(dto: CreateCreditCardDTO): Promise<CreditCardRecord> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError('O nome do cartão é obrigatório.')
    }

    const limit = Number(dto.limitCents)
    if (!Number.isInteger(limit) || limit < 0) {
      throw new ValidationError('O limite do cartão deve ser um valor inteiro não negativo em centavos.')
    }

    if (!Number.isInteger(dto.closingDay) || dto.closingDay < 1 || dto.closingDay > 31) {
      throw new ValidationError('O dia de fechamento deve ser um número inteiro entre 1 e 31.')
    }

    if (!Number.isInteger(dto.dueDay) || dto.dueDay < 1 || dto.dueDay > 31) {
      throw new ValidationError('O dia de vencimento deve ser um número inteiro entre 1 e 31.')
    }

    const plan: PlanId = dto.planId || 'free'
    const existingCards = await this.cardRepo.listByHousehold(dto.householdId)
    const activeCount = existingCards.length

    // Verificação de limite do plano via FeatureGate (Req 18.1)
    const decision = canCreate(plan, 'creditCards', activeCount)
    if (!decision.allowed) {
      throw new PlanLimitExceededError('creditCards', decision.limit || activeCount)
    }

    return this.cardRepo.save({
      household_id: dto.householdId,
      name: dto.name.trim(),
      limit_cents: limit,
      closing_day: dto.closingDay,
      due_day: dto.dueDay,
    })
  }

  /**
   * Atualiza limite, nome ou dias de fechamento/vencimento de um cartão.
   */
  async updateCreditCard(id: string, dto: UpdateCreditCardDTO): Promise<CreditCardRecord> {
    const existing = await this.cardRepo.findById(id)
    if (!existing) {
      throw new NotFoundError(`Cartão de crédito id ${id} não encontrado.`)
    }

    if (dto.closingDay !== undefined) {
      if (!Number.isInteger(dto.closingDay) || dto.closingDay < 1 || dto.closingDay > 31) {
        throw new ValidationError('O dia de fechamento deve ser um número inteiro entre 1 e 31.')
      }
    }

    if (dto.dueDay !== undefined) {
      if (!Number.isInteger(dto.dueDay) || dto.dueDay < 1 || dto.dueDay > 31) {
        throw new ValidationError('O dia de vencimento deve ser um número inteiro entre 1 e 31.')
      }
    }

    return this.cardRepo.save({
      id: existing.id,
      household_id: existing.household_id,
      name: dto.name !== undefined ? dto.name.trim() : existing.name,
      limit_cents: dto.limitCents !== undefined ? dto.limitCents : existing.limit_cents,
      closing_day: dto.closingDay !== undefined ? dto.closingDay : existing.closing_day,
      due_day: dto.dueDay !== undefined ? dto.dueDay : existing.due_day,
    })
  }

  /**
   * Obtém cartão por id sob RLS.
   */
  async getCreditCardById(id: string): Promise<CreditCardRecord> {
    const card = await this.cardRepo.findById(id)
    if (!card) {
      throw new NotFoundError(`Cartão de crédito id ${id} não encontrado.`)
    }
    return card
  }

  /**
   * Lista os cartões de crédito da household (Req 10.7).
   */
  async listCreditCards(householdId: string): Promise<CreditCardRecord[]> {
    return this.cardRepo.listByHousehold(householdId)
  }

  /**
   * Obtém ou deriva a fatura de um cartão em determinado ciclo YYYY-MM (Req 10.2, 10.3).
   */
  async getCardInvoice(cardId: string, cycle: string): Promise<CreditCardInvoiceRecord> {
    const card = await this.getCreditCardById(cardId)
    const existingInvoice = await this.cardRepo.getInvoice(cardId, cycle)

    if (existingInvoice) {
      return existingInvoice
    }

    // Derivar data de vencimento usando a regra pura do Financial Core
    const dueDateStr = invoiceDueDate(cycle, card.due_day)

    return {
      household_id: card.household_id,
      credit_card_id: cardId,
      cycle,
      due_date: dueDateStr,
      status: 'open',
    }
  }

  /**
   * Registra o pagamento de uma fatura de cartão (Req 10.5).
   * Marca fatura como paga e gera o débito na conta bancária de pagamento.
   */
  async payInvoice(dto: PayInvoiceDTO): Promise<CreditCardInvoiceRecord> {
    const card = await this.getCreditCardById(dto.cardId)
    const paymentAccount = await this.accountRepo.findById(dto.paymentAccountId)
    if (!paymentAccount) {
      throw new NotFoundError(`Conta de pagamento id ${dto.paymentAccountId} não encontrada.`)
    }

    const amount = Number(dto.amountCents)
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('O valor do pagamento da fatura deve ser maior que zero.')
    }

    const invoice = await this.getCardInvoice(dto.cardId, dto.cycle)

    // Criar lançamento de despesa de pagamento da fatura na conta bancária
    await this.transactionRepo.save({
      household_id: card.household_id,
      type: 'expense',
      amount_cents: amount,
      account_id: dto.paymentAccountId,
      accrual_date: invoice.due_date,
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      credit_card_id: dto.cardId,
      external_ref: `Pagamento Fatura ${card.name} (${dto.cycle})`,
      source: 'manual',
    })

    invoice.status = 'paid'
    return invoice
  }
}
