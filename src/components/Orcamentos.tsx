import { useState } from 'react'

export interface BudgetItem {
  id: string
  categoryName: string
  allocatedCents: number
  spentCents: number
}

export default function Orcamentos() {
  const [orcamentos, setOrcamentos] = useState<BudgetItem[]>([
    { id: 'b-1', categoryName: 'Alimentação & Mercado', allocatedCents: 150000, spentCents: 112000 },
    { id: 'b-2', categoryName: 'Lazer & Entretenimento', allocatedCents: 40000, spentCents: 38500 },
    { id: 'b-3', categoryName: 'Transporte & Combustível', allocatedCents: 50000, spentCents: 54000 },
    { id: 'b-4', categoryName: 'Saúde & Farmácia', allocatedCents: 30000, spentCents: 12000 },
  ])

  const [modalAberto, setModalAberto] = useState(false)
  const [categoria, setCategoria] = useState('')
  const [limite, setLimite] = useState('')

  const handleCriarOrcamento = (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoria.trim()) return

    const limiteCents = Math.round(parseFloat(limite.replace(',', '.') || '0') * 100)
    const novoOrcamento: BudgetItem = {
      id: `b-${Date.now()}`,
      categoryName: categoria.trim(),
      allocatedCents: Number.isNaN(limiteCents) ? 0 : limiteCents,
      spentCents: 0,
    }

    setOrcamentos((prev) => [...prev, novoOrcamento])
    setCategoria('')
    setLimite('')
    setModalAberto(false)
  }

  const formatarMoeda = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const totalPlanejado = orcamentos.reduce((acc, b) => acc + b.allocatedCents, 0)
  const totalGasto = orcamentos.reduce((acc, b) => acc + b.spentCents, 0)

  const getPercentual = (spent: number, allocated: number) => {
    if (allocated === 0) return 0
    return Math.min(Math.round((spent / allocated) * 100), 100)
  }

  const getStatusColor = (spent: number, allocated: number) => {
    if (allocated === 0) return 'bg-emerald-500'
    const pct = (spent / allocated) * 100
    if (pct >= 100) return 'bg-red-500'
    if (pct >= 80) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orçamentos Mensais</h1>
          <p className="text-sm text-slate-500">
            Defina tetos de gastos por categoria e acompanhe seu consumo em tempo real.
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-700 transition-colors"
        >
          + Novo Orçamento
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Planejado</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{formatarMoeda(totalPlanejado)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Consumido</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{formatarMoeda(totalGasto)}</p>
        </div>
      </div>

      {/* Lista de Orçamentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orcamentos.map((b) => {
          const pct = getPercentual(b.spentCents, b.allocatedCents)
          const colorClass = getStatusColor(b.spentCents, b.allocatedCents)
          const estourado = b.spentCents >= b.allocatedCents && b.allocatedCents > 0

          return (
            <div
              key={b.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-slate-800">{b.categoryName}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gasto: {formatarMoeda(b.spentCents)} de {formatarMoeda(b.allocatedCents)}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    estourado
                      ? 'bg-red-50 text-red-700'
                      : pct >= 80
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {pct}%
                </span>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full ${colorClass} transition-all duration-500 rounded-full`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>

              {estourado && (
                <p className="text-xs font-medium text-red-600">
                  ⚠️ Limite de orçamento excedido em {formatarMoeda(b.spentCents - b.allocatedCents)}.
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Novo Orçamento */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <h2 className="text-xl font-bold text-slate-800">Novo Orçamento Por Categoria</h2>

            <form onSubmit={handleCriarOrcamento} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Categoria
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Educação, Vestuário"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Limite Mensal (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={limite}
                  onChange={(e) => setLimite(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 transition-colors"
                >
                  Salvar Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
