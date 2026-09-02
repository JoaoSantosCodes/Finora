// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO APPLICATION SERVICE DE TRANSFERÊNCIAS (API-002C)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { NotFoundError, ValidationError } from '../errors.ts'
import { AccountRepository, type AccountRecord } from '../repositories/account.repository.ts'
import { TransactionRepository } from '../repositories/transaction.repository.ts'
import { TransferService } from './transfer.service.ts'

const mockAccounts: AccountRecord[] = [
  { id: 'acc-origem', household_id: 'h-1', name: 'Conta Corrente', type: 'checking', initial_balance_cents: 100000, archived: false },
  { id: 'acc-destino', household_id: 'h-1', name: 'Poupança', type: 'savings', initial_balance_cents: 20000, archived: false },
]

function createService(accounts: AccountRecord[] = mockAccounts) {
  let transferCalledWith: any = null

  const accountRepo = {
    findById: async (id: string) => accounts.find((a) => a.id === id) || null,
  } as unknown as AccountRepository

  const transactionRepo = {
    transfer: async (params: any) => {
      transferCalledWith = params
      return { transactionId: 'tx-transfer-1' }
    },
  } as unknown as TransactionRepository

  return {
    service: new TransferService(transactionRepo, accountRepo),
    getTransferCalledWith: () => transferCalledWith,
  }
}

export async function runTransferServiceTests(): Promise<void> {
  // 1. Transferência legítima entre contas distintas
  const { service: s1, getTransferCalledWith: getTransfer1 } = createService()
  const result = await s1.transferFunds({
    householdId: 'h-1',
    sourceAccountId: 'acc-origem',
    targetAccountId: 'acc-destino',
    amountCents: 30000,
    accrualDate: '2026-09-02',
    description: 'Reserva Poupança',
  })

  assert.equal(result.transactionId, 'tx-transfer-1')
  assert.deepEqual(getTransfer1(), {
    householdId: 'h-1',
    sourceAccountId: 'acc-origem',
    targetAccountId: 'acc-destino',
    amountCents: 30000,
    accrualDate: '2026-09-02',
    description: 'Reserva Poupança',
  })

  // 2. Bloqueio quando origem === destino (Req 8.4)
  const { service: s2 } = createService()
  await assert.rejects(
    async () => {
      await s2.transferFunds({
        householdId: 'h-1',
        sourceAccountId: 'acc-origem',
        targetAccountId: 'acc-origem',
        amountCents: 10000,
        accrualDate: '2026-09-02',
      })
    },
    (err: any) => err instanceof ValidationError && err.message.includes('diferentes'),
  )

  // 3. Bloqueio por valor <= 0 (Req 8.5)
  const { service: s3 } = createService()
  await assert.rejects(
    async () => {
      await s3.transferFunds({
        householdId: 'h-1',
        sourceAccountId: 'acc-origem',
        targetAccountId: 'acc-destino',
        amountCents: 0,
        accrualDate: '2026-09-02',
      })
    },
    (err: any) => err instanceof ValidationError && err.message.includes('maior que zero'),
  )

  // 4. Bloqueio por conta de origem inexistente
  const { service: s4 } = createService([mockAccounts[1]]) // Sem conta de origem
  await assert.rejects(
    async () => {
      await s4.transferFunds({
        householdId: 'h-1',
        sourceAccountId: 'acc-origem',
        targetAccountId: 'acc-destino',
        amountCents: 5000,
        accrualDate: '2026-09-02',
      })
    },
    (err: any) => err instanceof NotFoundError && err.message.includes('origem'),
  )

  // 5. Bloqueio por conta de destino inexistente
  const { service: s5 } = createService([mockAccounts[0]]) // Sem conta de destino
  await assert.rejects(
    async () => {
      await s5.transferFunds({
        householdId: 'h-1',
        sourceAccountId: 'acc-origem',
        targetAccountId: 'acc-destino',
        amountCents: 5000,
        accrualDate: '2026-09-02',
      })
    },
    (err: any) => err instanceof NotFoundError && err.message.includes('destino'),
  )

  console.log('  ok — API-002C: TransferService passou em todos os 5 testes (transferência válida, contas iguais rejeitadas, valor nulo rejeitado, validação de existência)')
}
