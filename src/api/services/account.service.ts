// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT APPLICATION SERVICE (API-002A)
// ─────────────────────────────────────────────────────────────────────────────

import { canCreate } from '../../../packages/core/src/entitlement.ts'
import type { PlanId } from '../../../packages/core/src/plans.ts'
import { accountBalance } from '../../../packages/core/src/transactions.ts'
import type { Account, Transaction } from '../../../packages/core/src/types.ts'
import { AccountHasTransactionsError, NotFoundError, PlanLimitExceededError, ValidationError } from '../errors.ts'
import { AccountRepository, type AccountRecord } from '../repositories/account.repository.ts'
import { TransactionRepository } from '../repositories/transaction.repository.ts'

export interface CreateAccountDTO {
  householdId: string
  name: string
  type: 'checking' | 'savings' | 'wallet' | 'credit_card'
  initialBalanceCents?: number | bigint
  planId?: PlanId
}

export interface UpdateAccountDTO {
  name?: string
  type?: 'checking' | 'savings' | 'wallet' | 'credit_card'
  initialBalanceCents?: number | bigint
  archived?: boolean
}

export interface AccountWithBalance extends AccountRecord {
  currentBalanceCents: number | bigint
}

export class AccountService {
  private readonly accountRepo: AccountRepository
  private readonly transactionRepo: TransactionRepository

  constructor(
    accountRepo: AccountRepository,
    transactionRepo: TransactionRepository,
  ) {
    this.accountRepo = accountRepo
    this.transactionRepo = transactionRepo
  }

  /**
   * Cria uma nova conta bancária na household ativa (Req 6.1, 6.2, 6.7).
   * Valida limite do plano via FeatureGate (`canCreate`).
   */
  async createAccount(dto: CreateAccountDTO): Promise<AccountRecord> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError('O nome da conta é obrigatório.')
    }
    const initialCents = dto.initialBalanceCents ? Number(dto.initialBalanceCents) : 0
    if (!Number.isInteger(initialCents) || initialCents < 0) {
      throw new ValidationError('O saldo inicial deve ser um valor inteiro não negativo em centavos.')
    }

    const plan: PlanId = dto.planId || 'free'
    const existingAccounts = await this.accountRepo.listByHousehold(dto.householdId)
    const activeCount = existingAccounts.filter((a) => !a.archived).length

    // Verificação de limite do plano via FeatureGate (Req 6.7)
    const decision = canCreate(plan, 'accounts', activeCount)
    if (!decision.allowed) {
      throw new PlanLimitExceededError('accounts', decision.limit || activeCount)
    }

    return this.accountRepo.save({
      household_id: dto.householdId,
      name: dto.name.trim(),
      type: dto.type,
      initial_balance_cents: initialCents,
      archived: false,
    })
  }

  /**
   * Atualiza dados de uma conta e retorna o saldo atual recalculado (Req 6.4).
   */
  async updateAccount(id: string, dto: UpdateAccountDTO): Promise<AccountWithBalance> {
    const existing = await this.accountRepo.findById(id)
    if (!existing) {
      throw new NotFoundError(`Conta id ${id} não encontrada.`)
    }

    const updated = await this.accountRepo.save({
      id: existing.id,
      household_id: existing.household_id,
      name: dto.name !== undefined ? dto.name.trim() : existing.name,
      type: dto.type !== undefined ? dto.type : existing.type,
      archived: dto.archived !== undefined ? dto.archived : existing.archived,
    })

    return this.getAccountWithBalance(updated.id!)
  }

  /**
   * Obtém uma conta com seu saldo recalculado pelo Financial Core (Req 6.3).
   */
  async getAccountWithBalance(id: string): Promise<AccountWithBalance> {
    const account = await this.accountRepo.findById(id)
    if (!account) {
      throw new NotFoundError(`Conta id ${id} não encontrada.`)
    }

    const dbTxs = await this.transactionRepo.listByHousehold(account.household_id, { accountId: id })
    
    // Converter transações para formato do Financial Core (@finora/core)
    const coreAccount: Account = {
      id: account.id!,
      initialBalanceCents: Number(account.initial_balance_cents || 0),
    }

    const coreTxs: Transaction[] = dbTxs.map((t) => ({
      id: t.id!,
      type: t.type,
      amountCents: Number(t.amount_cents),
      accountId: t.account_id,
      counterAccountId: t.counter_account_id,
      paymentStatus: t.payment_status,
      accrualDate: t.accrual_date,
    }))

    const currentBalance = accountBalance(coreAccount, coreTxs)

    return {
      ...account,
      currentBalanceCents: currentBalance,
    }
  }

  /**
   * Lista as contas da household ativa (Req 6.1).
   */
  async listAccounts(householdId: string, includeArchived = false): Promise<AccountRecord[]> {
    const accounts = await this.accountRepo.listByHousehold(householdId)
    if (includeArchived) return accounts
    return accounts.filter((a) => !a.archived)
  }

  /**
   * Arquiva uma conta ocultando-a da seleção padrão (Req 6.6).
   */
  async archiveAccount(id: string): Promise<void> {
    await this.accountRepo.archive(id)
  }

  /**
   * Tenta excluir uma conta. Se possuir transações associadas, nega a operação (Req 6.5).
   */
  async deleteAccount(id: string): Promise<void> {
    const account = await this.accountRepo.findById(id)
    if (!account) {
      throw new NotFoundError(`Conta id ${id} não encontrada.`)
    }

    // Verificar se existem transações vinculadas à conta
    const txs = await this.transactionRepo.listByHousehold(account.household_id, { accountId: id })
    if (txs.length > 0) {
      throw new AccountHasTransactionsError()
    }

    await this.accountRepo.delete(id)
  }
}
