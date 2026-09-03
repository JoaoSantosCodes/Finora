import { useState } from 'react'

export interface InvoiceItem {
  id: string
  cardName: string
  period: string
  dueDate: string
  amountCents: number
  status: 'open' | 'closed' | 'paid'
}

export default function Faturas() {
  const [faturas, setFaturas] = useState<InvoiceItem[]>([
    { id: 'inv-1', cardName: 'Nubank Violeta', period: 'Setembro / 2026', dueDate: '2026-09-22', amountCents: 145080, status: 'open' },
    { id: 'inv-2', cardName: 'Itaú Personalité', period: 'Setembro / 2026', dueDate: '2026-09-12', amountCents: 320000, status: 'closed' },
    { id: 'inv-3', cardName: 'Nubank Violeta', period: 'Agosto / 2026', dueDate: '2026-08-22', amountCents: 98050, status: 'paid' },
  ])

  const [filtroStatus, setFiltroStatus] = useState<'all' | 'open' | 'closed' | 'paid'>('all')
  const [faturaSelecionada, setFaturaSelecionada] = useState<InvoiceItem | null>(null)

  const handlePagarFatura = () => {
    if (!faturaSelecionada) return
    setFaturas((prev) =>
      prev.map((f) => (f.id === faturaSelecionada.id ? { ...f, status: 'paid' } : f)),
    )
    setFaturaSelecionada(null)
  }

  const formatarMoeda = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const faturasFiltradas = faturas.filter((f) => {
    if (filtroStatus === 'all') return true
    return f.status === filtroStatus
  })

  const getStatusBadge = (st: InvoiceItem['status']) => {
    switch (st) {
      case 'open':
        return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Aberta</span>
      case 'closed':
        return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Fechada</span>
      case 'paid':
        return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Paga</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Faturas de Cartão</h1>
          <p className="text-sm text-slate-500">
            Acompanhe o fechamento, vencimento e realize o pagamento de faturas.
          </p>
        </div>

        {/* Filtros de Status */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
          <button
            onClick={() => setFiltroStatus('all')}
            className={`rounded-lg px-3 py-1.5 transition ${filtroStatus === 'all' ? 'bg-white text-slate-900 shadow-sm font-semibold' : ''}`}
          >
            Todas
          </button>
          <button
            onClick={() => setFiltroStatus('open')}
            className={`rounded-lg px-3 py-1.5 transition ${filtroStatus === 'open' ? 'bg-white text-slate-900 shadow-sm font-semibold' : ''}`}
          >
            Abertas
          </button>
          <button
            onClick={() => setFiltroStatus('closed')}
            className={`rounded-lg px-3 py-1.5 transition ${filtroStatus === 'closed' ? 'bg-white text-slate-900 shadow-sm font-semibold' : ''}`}
          >
            Fechadas
          </button>
          <button
            onClick={() => setFiltroStatus('paid')}
            className={`rounded-lg px-3 py-1.5 transition ${filtroStatus === 'paid' ? 'bg-white text-slate-900 shadow-sm font-semibold' : ''}`}
          >
            Pagas
          </button>
        </div>
      </div>

      {/* Tabela de Faturas */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200/80">
            <tr>
              <th className="px-6 py-4">Cartão</th>
              <th className="px-6 py-4">Período</th>
              <th className="px-6 py-4">Vencimento</th>
              <th className="px-6 py-4">Valor Total</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {faturasFiltradas.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-slate-800">{f.cardName}</td>
                <td className="px-6 py-4">{f.period}</td>
                <td className="px-6 py-4">{new Date(f.dueDate).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-4 font-bold text-slate-900">{formatarMoeda(f.amountCents)}</td>
                <td className="px-6 py-4">{getStatusBadge(f.status)}</td>
                <td className="px-6 py-4 text-right">
                  {f.status === 'closed' && (
                    <button
                      onClick={() => setFaturaSelecionada(f)}
                      className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-orange-700 transition-colors"
                    >
                      Pagar Fatura
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Confirmar Pagamento */}
      {faturaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Pagamento de Fatura</h2>
            <p className="text-sm text-slate-600">
              Você está prestes a quitar a fatura do cartão{' '}
              <strong className="text-slate-900">{faturaSelecionada.cardName}</strong> no valor de{' '}
              <strong className="text-slate-900">{formatarMoeda(faturaSelecionada.amountCents)}</strong>.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Conta de Origem do Débito
              </label>
              <select className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none">
                <option>Conta Corrente Principal</option>
                <option>Reserva de Emergência</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setFaturaSelecionada(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePagarFatura}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
