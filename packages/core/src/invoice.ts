// Cartão de crédito: alocação de ciclo de fatura e total derivado. Puro, sem I/O.
// Regras: design.md §Domain Model (Cartão→Fatura→Parcela), Correctness Property 4.
import type { Cents } from './money'
import type { CreditCard } from './types'

/**
 * Determina o ciclo (mês de referência da fatura) para uma despesa/parcela,
 * dado o dia de fechamento do cartão.
 * Regra: compras ATÉ o dia de fechamento pertencem ao ciclo do próprio mês;
 * compras APÓS o fechamento entram no ciclo do mês seguinte.
 * Retorna o primeiro dia do ciclo em formato YYYY-MM-01.
 */
export function invoiceCycle(accrualDate: string, closingDay: number): string {
  const [y, m, d] = accrualDate.split('-').map(Number)
  let year = y
  let month = m // 1..12
  if (d > closingDay) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/**
 * Deriva a data de vencimento da fatura dado o ciclo (YYYY-MM ou YYYY-MM-01) e o dia de vencimento do cartão.
 */
export function invoiceDueDate(cycle: string, dueDay: number): string {
  const parts = cycle.split('-')
  const year = parts[0]
  const month = parts[1]
  const dayStr = String(dueDay).padStart(2, '0')
  return `${year}-${month}-${dayStr}`
}

export interface InvoiceItem {
  amountCents: Cents
  accrualDate: string
}

/**
 * Total de uma fatura = soma dos itens (transações + parcelas) alocados ao ciclo.
 * A fatura é SEMPRE derivada dos itens; nunca há valor armazenado à parte (Property 4).
 */
export function invoiceTotal(
  items: InvoiceItem[],
  card: CreditCard,
  cycle: string,
): Cents {
  return items
    .filter((it) => invoiceCycle(it.accrualDate, card.closingDay) === cycle)
    .reduce((acc, it) => acc + it.amountCents, 0)
}
