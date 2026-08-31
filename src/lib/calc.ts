// Consolidações e cálculos (equivale à aba "Calc_Data")
import type {
  Categoria,
  Despesa,
  ResumoIndicadores,
  GastoPorCategoria,
  GastoPorMes,
} from '../types'

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatarCompacto(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

const MESES_ABREV = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-')
  const idx = Number(m) - 1
  return `${MESES_ABREV[idx] ?? m}/${ano}`
}

export function calcularIndicadores(despesas: Despesa[]): ResumoIndicadores {
  let totalGastos = 0
  let totalPago = 0
  let totalPendente = 0

  for (const d of despesas) {
    totalGastos += d.valor
    if (d.pago) totalPago += d.valor
    else totalPendente += d.valor
  }

  return { totalGastos, totalPago, totalPendente }
}

export function calcularPorCategoria(
  despesas: Despesa[],
  categorias: Categoria[],
): GastoPorCategoria[] {
  const mapa = new Map<string, number>()
  for (const d of despesas) {
    mapa.set(d.categoriaId, (mapa.get(d.categoriaId) ?? 0) + d.valor)
  }

  return categorias
    .map((c) => ({
      categoriaId: c.id,
      nome: c.nome,
      cor: c.cor,
      total: mapa.get(c.id) ?? 0,
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function calcularPorMes(despesas: Despesa[]): GastoPorMes[] {
  const mapa = new Map<string, number>()
  for (const d of despesas) {
    const mes = d.data.slice(0, 7) // YYYY-MM
    mapa.set(mes, (mapa.get(mes) ?? 0) + d.valor)
  }

  return Array.from(mapa.entries())
    .map(([mes, total]) => ({ mes, rotulo: rotuloMes(mes), total }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
}

export function listarPendentes(despesas: Despesa[]): Despesa[] {
  return despesas.filter((d) => !d.pago)
}

// Lista de meses disponíveis (para filtro), do mais recente ao mais antigo
export function mesesDisponiveis(despesas: Despesa[]): { valor: string; rotulo: string }[] {
  const set = new Set<string>()
  for (const d of despesas) set.add(d.data.slice(0, 7))
  return Array.from(set)
    .sort((a, b) => b.localeCompare(a))
    .map((m) => ({ valor: m, rotulo: rotuloMes(m) }))
}

// Variação percentual do mês mais recente em relação ao anterior
export function variacaoMensal(porMes: GastoPorMes[]): number | null {
  if (porMes.length < 2) return null
  const atual = porMes[porMes.length - 1].total
  const anterior = porMes[porMes.length - 2].total
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}
