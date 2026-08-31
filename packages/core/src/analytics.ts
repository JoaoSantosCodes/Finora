// Consolidações puras (semente do Financial Core, migrada de src/lib/calc.ts do V0).
// Valores em centavos. Puro: sem I/O, sem browser APIs.

import type { Cents } from './money'

export type TxType = 'income' | 'expense' | 'transfer'
export type PaymentStatus = 'paid' | 'pending'

export interface CoreTransaction {
  type: TxType
  amountCents: Cents
  accrualDate: string // YYYY-MM-DD
  paymentStatus: PaymentStatus
  categoryId?: string
}

export interface CoreCategory {
  id: string
  name: string
  color: string
}

export interface Indicadores {
  totalGastosCents: Cents
  totalPagoCents: Cents
  totalPendenteCents: Cents
}

/**
 * Indicadores de despesa. Transferências NÃO entram em gastos
 * (Correctness Property 1). Total pendente acumula todas as pendências
 * (Correctness Property 6).
 */
export function calcularIndicadores(txs: CoreTransaction[]): Indicadores {
  let totalGastosCents = 0
  let totalPagoCents = 0
  let totalPendenteCents = 0

  for (const t of txs) {
    if (t.type !== 'expense') continue // transfer e income não são "gasto"
    totalGastosCents += t.amountCents
    if (t.paymentStatus === 'paid') totalPagoCents += t.amountCents
    else totalPendenteCents += t.amountCents
  }

  return { totalGastosCents, totalPagoCents, totalPendenteCents }
}

export interface GastoPorCategoria {
  categoriaId: string
  nome: string
  cor: string
  totalCents: Cents
}

export function calcularPorCategoria(
  txs: CoreTransaction[],
  categorias: CoreCategory[],
): GastoPorCategoria[] {
  const mapa = new Map<string, Cents>()
  for (const t of txs) {
    if (t.type !== 'expense' || !t.categoryId) continue
    mapa.set(t.categoryId, (mapa.get(t.categoryId) ?? 0) + t.amountCents)
  }
  return categorias
    .map((c) => ({
      categoriaId: c.id,
      nome: c.name,
      cor: c.color,
      totalCents: mapa.get(c.id) ?? 0,
    }))
    .filter((i) => i.totalCents > 0)
    .sort((a, b) => b.totalCents - a.totalCents)
}

export interface GastoPorMes {
  mes: string // YYYY-MM
  totalCents: Cents
}

export function calcularPorMes(txs: CoreTransaction[]): GastoPorMes[] {
  const mapa = new Map<string, Cents>()
  for (const t of txs) {
    if (t.type !== 'expense') continue
    const mes = t.accrualDate.slice(0, 7)
    mapa.set(mes, (mapa.get(mes) ?? 0) + t.amountCents)
  }
  return Array.from(mapa.entries())
    .map(([mes, totalCents]) => ({ mes, totalCents }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
}

/** Variação percentual do último mês vs anterior (null se < 2 meses ou base 0). */
export function variacaoMensal(porMes: GastoPorMes[]): number | null {
  if (porMes.length < 2) return null
  const atual = porMes[porMes.length - 1].totalCents
  const anterior = porMes[porMes.length - 2].totalCents
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}
