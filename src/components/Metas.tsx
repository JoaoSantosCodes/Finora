import { useState } from 'react'

export interface GoalItem {
  id: string
  name: string
  targetCents: number
  currentCents: number
  deadline?: string
}

export default function Metas() {
  const [metas, setMetas] = useState<GoalItem[]>([
    { id: 'g-1', name: 'Viagem de Férias', targetCents: 800000, currentCents: 520000, deadline: '2026-12-15' },
    { id: 'g-2', name: 'Troca de Carro', targetCents: 3500000, currentCents: 1200000, deadline: '2027-06-30' },
    { id: 'g-3', name: 'Fundo de Reserva', targetCents: 1000000, currentCents: 1000000, deadline: '2026-08-01' },
  ])

  const [modalAberto, setModalAberto] = useState(false)
  const [modalAporteAberto, setModalAporteAberto] = useState(false)
  const [metaSelecionada, setMetaSelecionada] = useState<GoalItem | null>(null)

  const [nome, setNome] = useState('')
  const [alvo, setAlvo] = useState('')
  const [dataLimite, setDataLimite] = useState('')
  const [valorAporte, setValorAporte] = useState('')

  const handleCriarMeta = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    const alvoCents = Math.round(parseFloat(alvo.replace(',', '.') || '0') * 100)
    const novaMeta: GoalItem = {
      id: `g-${Date.now()}`,
      name: nome.trim(),
      targetCents: Number.isNaN(alvoCents) ? 0 : alvoCents,
      currentCents: 0,
      deadline: dataLimite || undefined,
    }

    setMetas((prev) => [...prev, novaMeta])
    setNome('')
    setAlvo('')
    setDataLimite('')
    setModalAberto(false)
  }

  const handleRegistrarAporte = (e: React.FormEvent) => {
    e.preventDefault()
    if (!metaSelecionada) return

    const aporteCents = Math.round(parseFloat(valorAporte.replace(',', '.') || '0') * 100)
    if (Number.isNaN(aporteCents) || aporteCents <= 0) return

    setMetas((prev) =>
      prev.map((g) =>
        g.id === metaSelecionada.id
          ? { ...g, currentCents: g.currentCents + aporteCents }
          : g,
      ),
    )

    setValorAporte('')
    setMetaSelecionada(null)
    setModalAporteAberto(false)
  }

  const formatarMoeda = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const totalEconomizado = metas.reduce((acc, g) => acc + g.currentCents, 0)
  const totalAlvoConsolidado = metas.reduce((acc, g) => acc + g.targetCents, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Metas Financeiras</h1>
          <p className="text-sm text-slate-500">
            Acompanhe seus objetivos de economia e registre novos aportes.
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-700 transition-colors"
        >
          + Nova Meta
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Economizado</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{formatarMoeda(totalEconomizado)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Meta Consolidada</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{formatarMoeda(totalAlvoConsolidado)}</p>
        </div>
      </div>

      {/* Grid de Metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {metas.map((g) => {
          const pct = Math.min(Math.round((g.currentCents / g.targetCents) * 100) || 0, 100)
          const concluida = g.currentCents >= g.targetCents

          return (
            <div
              key={g.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4 hover:border-orange-200 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-slate-800 text-lg">{g.name}</h3>
                  {concluida ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      🎉 Concluída!
                    </span>
                  ) : (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                      {pct}%
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-xs text-slate-400">Acumulado</p>
                  <p className="text-2xl font-bold text-slate-900">{formatarMoeda(g.currentCents)}</p>
                  <p className="text-xs text-slate-500">Alvo: {formatarMoeda(g.targetCents)}</p>
                </div>

                {/* Barra de Progresso */}
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${concluida ? 'bg-emerald-500' : 'bg-orange-500'} transition-all duration-500 rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {g.deadline && (
                  <p className="text-xs text-slate-400 pt-1">
                    Data Limite: {new Date(g.deadline).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              {!concluida && (
                <button
                  onClick={() => {
                    setMetaSelecionada(g)
                    setModalAporteAberto(true)
                  }}
                  className="w-full rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                >
                  + Registrar Aporte
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Nova Meta */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <h2 className="text-xl font-bold text-slate-800">Nova Meta Financeira</h2>

            <form onSubmit={handleCriarMeta} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome da Meta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Viagem, Reserva de Emergência"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valor Alvo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={alvo}
                  onChange={(e) => setAlvo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Data Limite (Opcional)
                </label>
                <input
                  type="date"
                  value={dataLimite}
                  onChange={(e) => setDataLimite(e.target.value)}
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
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Aporte */}
      {modalAporteAberto && metaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Registrar Aporte</h2>
            <p className="text-sm text-slate-600">
              Meta: <strong className="text-slate-900">{metaSelecionada.name}</strong>
            </p>

            <form onSubmit={handleRegistrarAporte} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valor do Aporte (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={valorAporte}
                  onChange={(e) => setValorAporte(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMetaSelecionada(null)
                    setModalAporteAberto(false)
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
