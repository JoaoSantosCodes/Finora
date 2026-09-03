import { useState } from 'react'
import { IconWallet } from './icons'

export interface AccountItem {
  id: string
  name: string
  type: 'checking' | 'savings' | 'wallet' | 'credit_card'
  initialBalanceCents: number
  archived: boolean
}

export default function Contas() {
  const [contas, setContas] = useState<AccountItem[]>([
    { id: 'acc-1', name: 'Conta Principal', type: 'checking', initialBalanceCents: 150000, archived: false },
    { id: 'acc-2', name: 'Reserva de Emergência', type: 'savings', initialBalanceCents: 500000, archived: false },
    { id: 'acc-3', name: 'Carteira Física', type: 'wallet', initialBalanceCents: 25000, archived: false },
  ])

  const [modalAberto, setModalAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<AccountItem['type']>('checking')
  const [saldoInicial, setSaldoInicial] = useState('')

  const handleCriarConta = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    const valorCents = Math.round(parseFloat(saldoInicial.replace(',', '.') || '0') * 100)
    const novaConta: AccountItem = {
      id: `acc-${Date.now()}`,
      name: nome.trim(),
      type: tipo,
      initialBalanceCents: Number.isNaN(valorCents) ? 0 : valorCents,
      archived: false,
    }

    setContas((prev) => [...prev, novaConta])
    setNome('')
    setSaldoInicial('')
    setModalAberto(false)
  }

  const handleArquivar = (id: string) => {
    setContas((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, archived: true } : acc)),
    )
  }

  const formatarMoeda = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const getTipoLabel = (t: AccountItem['type']) => {
    switch (t) {
      case 'checking':
        return 'Conta Corrente'
      case 'savings':
        return 'Poupança'
      case 'wallet':
        return 'Carteira'
      case 'credit_card':
        return 'Cartão de Crédito'
    }
  }

  const contasAtivas = contas.filter((c) => !c.archived)
  const totalSaldoAtivo = contasAtivas.reduce((acc, c) => acc + c.initialBalanceCents, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contas Bancárias</h1>
          <p className="text-sm text-slate-500">
            Gerencie suas contas, saldos e carteiras ativas na Household.
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-700 transition-colors"
        >
          + Nova Conta
        </button>
      </div>

      {/* Card de Resumo de Saldo */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Saldo Total Consolidado
          </p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {formatarMoeda(totalSaldoAtivo)}
          </p>
        </div>
        <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
          <IconWallet className="h-6 w-6" />
        </div>
      </div>

      {/* Grid de Contas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contasAtivas.map((acc) => (
          <div
            key={acc.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-orange-200 transition-all space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {getTipoLabel(acc.type)}
                </span>
                <h3 className="text-lg font-semibold text-slate-800 mt-2">{acc.name}</h3>
              </div>
              <button
                onClick={() => handleArquivar(acc.id)}
                className="text-xs text-slate-400 hover:text-red-600 transition-colors"
                title="Arquivar conta"
              >
                Arquivar
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-400">Saldo Atual</p>
              <p className="text-xl font-bold text-slate-900">
                {formatarMoeda(acc.initialBalanceCents)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Criação de Conta */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <h2 className="text-xl font-bold text-slate-800">Nova Conta Bancária</h2>

            <form onSubmit={handleCriarConta} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome da Conta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nubank, Itaú, Carteira"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tipo de Conta
                </label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as AccountItem['type'])}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
                >
                  <option value="checking">Conta Corrente</option>
                  <option value="savings">Poupança</option>
                  <option value="wallet">Carteira Física</option>
                  <option value="credit_card">Cartão de Crédito</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Saldo Inicial (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
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
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
