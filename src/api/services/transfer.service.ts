// ─────────────────────────────────────────────────────────────────────────────
// TRANSFER APPLICATION SERVICE (API-002C)
// ─────────────────────────────────────────────────────────────────────────────

import { NotFoundError, ValidationError } from '../errors.ts'
import { AccountRepository } from '../repositories/account.repository.ts'
import { TransactionRepository } from '../repositories/transaction.repository.ts'

export interface CreateTransferDTO {
  householdId: string
  sourceAccountId: string
  targetAccountId: string
  amountCents: number | bigint
  accrualDate: string
  description?: string
}

export interface TransferResult {
  transactionId: string
}

export class TransferService {
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
   * Executa uma transferência atômica entre duas contas distintas da mesma household (Req 8.3, 8.4, 8.5).
   */
  async transferFunds(dto: CreateTransferDTO): Promise<TransferResult> {
    // 1. Validação: Conta origem ≠ Conta destino (Req 8.4)
    if (dto.sourceAccountId === dto.targetAccountId) {
      throw new ValidationError('A conta de origem e a conta de destino devem ser diferentes.')
    }

    // 2. Validação: Valor > 0 (Req 8.5)
    const amount = Number(dto.amountCents)
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('O valor da transferência deve ser maior que zero.')
    }

    // 3. Verificação de existência da conta de origem sob RLS
    const sourceAcc = await this.accountRepo.findById(dto.sourceAccountId)
    if (!sourceAcc) {
      throw new NotFoundError(`Conta de origem id ${dto.sourceAccountId} não encontrada.`)
    }

    // 4. Verificação de existência da conta de destino sob RLS
    const targetAcc = await this.accountRepo.findById(dto.targetAccountId)
    if (!targetAcc) {
      throw new NotFoundError(`Conta de destino id ${dto.targetAccountId} não encontrada.`)
    }

    // 5. Execução atômica via RPC rpc_transfer_funds no PostgreSQL (API-001)
    return this.transactionRepo.transfer({
      householdId: dto.householdId,
      sourceAccountId: dto.sourceAccountId,
      targetAccountId: dto.targetAccountId,
      amountCents: amount,
      accrualDate: dto.accrualDate,
      description: dto.description,
    })
  }
}
