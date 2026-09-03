import { useState } from 'react'

export interface ReportCategorySummary {
  categoryName: string
  amountCents: number
  percentage: number
}

export default function Relatorios() {
  const [periodo, setPeriodo] = useState('2026-09')

  const totalReceitaCents = 850000
  const totalDespesaCents = 425000
  const saldoLiquidoCents = totalReceitaCents - totalDespesaCents

  const categorias: ReportCategorySummary[] = [
    { categoryName: 'Alimentação & Mercado', amountCents: 150000, percentage: 35.3 },
    { categoryName: 'Moradia & Aluguel', amountCents: 180000, percentage: 42.4 },
    { categoryName: 'Lazer & Entretenimento', amountCents: 45000, percentage: 10.6 },
    { categoryName: 'Transporte', amountCents: 50000, percentage: 11.7 },
  ]

  const formatarMoeda = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const exportarCSV = () => {
    let csv = 'Categoria,Valor (R$),Percentual (%)\n'
    categorias.forEach((c) => {
      csv += `"${c.categoryName}",${(c.amountCents / 100).toFixed(2)},${c.percentage}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `relatorio-finora-${periodo}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportarJSON = () => {
    const data = {
      periodo,
      totalReceita: totalReceitaCents / 100,
      totalDespesa: totalDespesaCents / 100,
      saldoLiquido: saldoLiquidoCents / 100,
      despesasPorCategoria: categorias.map((c) => ({
        categoria: c.categoryName,
        valor: c.amountCents / 100,
        percentual: c.percentage,
      })),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `relatorio-finora-${periodo}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatórios Financeiros</h1>
          <p className="text-sm text-slate-500">
            Analise o balanço mensal da Household e exporte dados para auditoria.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={exportarCSV}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 transition-colors"
          >
            Exportar CSV
          </button>
          <button
            onClick={exportarJSON}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            Exportar JSON
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total de Receitas</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{formatarMoeda(totalReceitaCents)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total de Despesas</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{formatarMoeda(totalDespesaCents)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Saldo Líquido</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{formatarMoeda(saldoLiquidoCents)}</p>
        </div>
      </div>

      {/* Tabela de Distribuição por Categoria */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50">
          <h2 className="text-base font-bold text-slate-800">Distribuição de Despesas Por Categoria</h2>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200/80">
            <tr>
              <th className="px-6 py-3">Categoria</th>
              <th className="px-6 py-3">Total Gasto</th>
              <th className="px-6 py-3">Proporção</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categorias.map((c) => (
              <tr key={c.categoryName} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-slate-800">{c.categoryName}</td>
                <td className="px-6 py-4 font-bold text-slate-900">{formatarMoeda(c.amountCents)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${c.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{c.percentage}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
