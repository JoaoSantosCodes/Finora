export interface InsightCard {
  id: string
  title: string
  description: string
  type: 'warning' | 'info' | 'success'
}

export default function Insights() {
  const insights: InsightCard[] = [
    {
      id: 'ins-1',
      title: 'Atenção aos Gastos de Moradia',
      description: 'A categoria Moradia & Aluguel representou 42.4% de todas as suas despesas neste mês. Recomenda-se manter esta proporção abaixo de 30%.',
      type: 'warning',
    },
    {
      id: 'ins-2',
      title: 'Lembrete de Vencimento de Fatura',
      description: 'Sua fatura do cartão Itaú Personalité no valor de R$ 3.200,00 vence em 3 dias. Verifique seu saldo em conta.',
      type: 'info',
    },
    {
      id: 'ins-3',
      title: 'Parabéns! Redução em Lazer',
      description: 'Você economizou R$ 250,00 na categoria Lazer em comparação com o mês anterior (redução de 12%).',
      type: 'success',
    },
  ]

  const getCardStyle = (t: InsightCard['type']) => {
    switch (t) {
      case 'warning':
        return 'border-amber-200 bg-amber-50/40 text-amber-900'
      case 'info':
        return 'border-blue-200 bg-blue-50/40 text-blue-900'
      case 'success':
        return 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
    }
  }

  const getBadgeStyle = (t: InsightCard['type']) => {
    switch (t) {
      case 'warning':
        return 'bg-amber-100 text-amber-800'
      case 'info':
        return 'bg-blue-100 text-blue-800'
      case 'success':
        return 'bg-emerald-100 text-emerald-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Insights Financeiros Inteligentes</h1>
        <p className="text-sm text-slate-500">
          Diagnósticos automáticos e recomendações de otimização para a sua Household.
        </p>
      </div>

      {/* Grid de Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl border p-6 shadow-sm space-y-3 ${getCardStyle(item.type)}`}
          >
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${getBadgeStyle(item.type)}`}>
                {item.type === 'warning' ? 'Alerta' : item.type === 'info' ? 'Aviso' : 'Oportunidade'}
              </span>
            </div>
            <h3 className="font-bold text-lg">{item.title}</h3>
            <p className="text-sm opacity-90 leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
