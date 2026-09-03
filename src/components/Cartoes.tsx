import { useState } from 'react'

export interface CreditCardItem {
  id: string
  name: string
  limitCents: number
  closingDay: number
  dueDay: number
  color: string
}

export default function Cartoes() {
  const [cartoes, setCartoes] = useState<CreditCardItem[]>([
    { id: 'card-1', name: 'Nubank Violeta', limitCents: 1200000, closingDay: 15, dueDay: 22, color: 'bg-purple-600' },
    { id: 'card-2', name: 'Itaú Personalité', limitCents: 2500000, closingDay: 5, dueDay: 12, color: 'bg-orange-600' },
  ])

  const [modalAberto, setModalAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [limite, setLimite] = useState('')
  const [fechamento, setFechamento] = useState('15')
  const [vencimento, setVencimento] = useState('22')

  const handleCriarCartao = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    const limiteCents = Math.round(parseFloat(limite.replace(',', '.') || '0') * 100)
    const dayClose = parseInt(fechamento, 10)
    const dayDue = parseInt(vencimento, 10)

    if (dayClose < 1 || dayClose > 31 || dayDue < 1 || dayDue > 31) {
      alert('Os dias de fechamento e vencimento devem estar entre 1 e 31.')
      return
    }

    const novoCartao: CreditCardItem = {
      id: `card-${Date.now()}`,
      name: nome.trim(),
      limitCents: Number.isNaN(limiteCents) ? 0 : limiteCents,
      closingDay: dayClose,
      dueDay: dayDue,
      color: 'bg-slate-800',
    }

    setCartoes((prev) => [...prev, novoCartao])
    setNome('')
    setLimite('')
    setModalAberto(false)
  }

  const formatarMoeda = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const limiteTotalConsolidado = cartoes.reduce((acc, c) => acc + c.limitCents, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cartões de Crédito</h1>
          <p className="text-sm text-slate-500">
            Gerencie seus cartões de crédito, limites e dias de fechamento/vencimento.
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-700 transition-colors"
        >
          + Novo Cartão
        </button>
      </div>

      {/* Resumo de Limites */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Limite de Crédito Consolidado
          </p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {formatarMoeda(limiteTotalConsolidado)}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block rounded-lg bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
            {cartoes.length} Cartões Ativos
          </span>
        </div>
      </div>

      {/* Grid de Cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cartoes.map((c) => (
          <div
            key={c.id}
            className={`rounded-2xl ${c.color} text-white p-6 shadow-lg flex flex-col justify-between h-48 relative overflow-hidden`}
          >
            <div className="flex justify-between items-start z-10">
              <div>
                <p className="text-xs opacity-75 uppercase tracking-wider font-semibold">Cartão de Crédito</p>
                <h3 className="text-xl font-bold mt-1">{c.name}</h3>
              </div>
              <div className="w-10 h-7 rounded bg-amber-400/80 flex items-center justify-center text-[10px] font-bold text-amber-950">
                CHIP
              </div>
            </div>

            <div className="z-10 flex justify-between items-end">
              <div>
                <p className="text-xs opacity-75">Limite Disponível</p>
                <p className="text-2xl font-bold">{formatarMoeda(c.limitCents)}</p>
              </div>
              <div className="text-right text-xs opacity-90">
                <p>Fecha dia {c.closingDay}</p>
                <p className="font-semibold">Vence dia {c.dueDay}</p>
              </div>
            </div>

            {/* Elemento decorativo */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          </div>
        ))}
      </div>

      {/* Modal de Cadastro */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <h2 className="text-xl font-bold text-slate-800">Novo Cartão de Crédito</h2>

            <form onSubmit={handleCriarCartao} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome / Identificador
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nubank, Itaú Black"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Limite Total (R$)
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dia de Fechamento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={fechamento}
                    onChange={(e) => setFechamento(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dia de Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
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
                  Salvar Cartão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
