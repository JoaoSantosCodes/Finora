// Tipos de domínio do Financial Core. Puro, sem I/O.
// Valores monetários sempre em centavos (Cents). Ver money.ts.
import type { Cents } from './money'

export type TxType = 'income' | 'expense' | 'transfer'
export type PaymentStatus = 'paid' | 'pending'

/** Transação canônica do domínio (independente de persistência). */
export interface Transaction {
  id: string
  type: TxType
  amountCents: Cents
  accountId: string
  counterAccountId?: string // apenas transfer (destino)
  categoryId?: string
  accrualDate: string // YYYY-MM-DD (competência)
  paymentStatus: PaymentStatus
}

export interface Account {
  id: string
  initialBalanceCents: Cents
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface CreditCard {
  id: string
  closingDay: number // 1..31
  dueDay: number // 1..31
}
