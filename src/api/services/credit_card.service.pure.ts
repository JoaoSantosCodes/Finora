// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO APPLICATION SERVICE DE CARTÕES DE CRÉDITO (API-002E)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { PlanLimitExceededError, ValidationError } from '../errors.ts'
import { AccountRepository, type AccountRecord } from '../repositories/account.repository.ts'
import { CreditCardRepository, type CreditCardRecord } from '../repositories/credit_card.repository.ts'
import { TransactionRepository } from '../repositories/transaction.repository.ts'
import { CreditCardService } from './credit_card.service.ts'

const mockAccount: AccountRecord = {
  id: 'acc-1',
  household_id: 'h-1',
  name: 'Conta Principal',
  type: 'checking',
  initial_balance_cents: 100000,
  archived: false,
}

const mockCard: CreditCardRecord = {
  id: 'card-1',
  household_id: 'h-1',
  name: 'Cartão Black',
  limit_cents: 500000,
  closing_day: 25,
  due_day: 10,
}

function createService(
  cards: CreditCardRecord[] = [mockCard],
  account: AccountRecord | null = mockAccount,
) {
  let savedCard: CreditCardRecord | null = null
  let savedTx: any = null

  const cardRepo = {
    findById: async (id: string) => cards.find((c) => c.id === id) || null,
    listByHousehold: async (_hId: string) => [...cards],
    save: async (card: CreditCardRecord) => {
      savedCard = card
      return { ...card, id: card.id || 'card-new' }
    },
    getInvoice: async (_cId: string, cycle: string) => ({
      household_id: 'h-1',
      credit_card_id: _cId,
      cycle,
      due_date: '2026-10-10',
      status: 'open' as const,
    }),
  } as unknown as CreditCardRepository

  const accountRepo = {
    findById: async (id: string) => (account && account.id === id ? account : null),
  } as unknown as AccountRepository

  const transactionRepo = {
    save: async (tx: any) => {
      savedTx = tx
      return { ...tx, id: 'tx-payment-1' }
    },
  } as unknown as TransactionRepository

  return {
    service: new CreditCardService(cardRepo, transactionRepo, accountRepo),
    getSavedCard: () => savedCard,
    getSavedTx: () => savedTx,
  }
}

export async function runCreditCardServiceTests(): Promise<void> {
  // 1. Criação legítima de cartão de crédito
  const { service: s1, getSavedCard: getCard1 } = createService([])
  const card = await s1.createCreditCard({
    householdId: 'h-1',
    name: 'Cartão Nubank',
    limitCents: 300000,
    closingDay: 25,
    dueDay: 5,
    planId: 'free',
  })
  assert.equal(card.name, 'Cartão Nubank')
  assert.equal(card.closing_day, 25)
  assert.equal(getCard1()?.limit_cents, 300000)

  // 2. Rejeição de dia de fechamento fora da faixa 1-31 (Req 10.1)
  const { service: s2 } = createService([])
  await assert.rejects(
    async () => {
      await s2.createCreditCard({
        householdId: 'h-1',
        name: 'Cartão Inválido',
        limitCents: 100000,
        closingDay: 35, // Inválido
        dueDay: 10,
      })
    },
    (err: any) => err instanceof ValidationError && err.message.includes('fechamento'),
  )

  // 3. Rejeição de dia de vencimento fora da faixa 1-31
  const { service: s3 } = createService([])
  await assert.rejects(
    async () => {
      await s3.createCreditCard({
        householdId: 'h-1',
        name: 'Cartão Inválido',
        limitCents: 100000,
        closingDay: 20,
        dueDay: 0, // Inválido
      })
    },
    (err: any) => err instanceof ValidationError && err.message.includes('vencimento'),
  )

  // 4. Enforcement do FeatureGate (plano Free com limite de 1 cartão)
  const { service: s4 } = createService([mockCard]) // Já existe 1 cartão
  await assert.rejects(
    async () => {
      await s4.createCreditCard({
        householdId: 'h-1',
        name: 'Segundo Cartão',
        limitCents: 200000,
        closingDay: 15,
        dueDay: 10,
        planId: 'free',
      })
    },
    (err: any) => err instanceof PlanLimitExceededError,
  )

  // 5. Pagamento de fatura debitando da conta bancária (Req 10.5)
  const { service: s5, getSavedTx: getTx5 } = createService()
  const paidInvoice = await s5.payInvoice({
    cardId: 'card-1',
    cycle: '2026-09',
    paymentAccountId: 'acc-1',
    amountCents: 150000,
  })

  assert.equal(paidInvoice.status, 'paid')
  assert.equal(getTx5()?.account_id, 'acc-1')
  assert.equal(getTx5()?.amount_cents, 150000)
  assert.equal(getTx5()?.type, 'expense')

  console.log('  ok — API-002E: CreditCardService passou em todos os 5 testes (criação válida, dias 1-31 validados, limite de plano via FeatureGate e pagamento de fatura)')
}
