import { useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { useFinora } from '../store'
import {
  calcularResumoFinanceiro,
  calcularPorCategoria,
  calcularEvolucao,
  formatarMoeda,
  formatarCompacto,
  mesesDisponiveis,
  ehReceita,
} from '../lib/calc'
import {
  IconWallet,
  IconCheck,
  IconClock,
  IconArrowUp,
  IconArrowDown,
  IconPlus,
} from './icons'

function saudacao(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard({ onNovoLancamento }: { onNovoLancamento?: () => void }) {
  const { despesas, categorias } = useFinora()
  const [mesFiltro, setMesFiltro] = useState<string>('todos')

  const meses = useMemo(() => mesesDisponiveis(despesas), [despesas])

  const lancFiltrados = useMemo(
    () =>
      mesFiltro === 'todos'
        ? despesas
        : despesas.filter((d) => d.data.slice(0, 7) === mesFiltro),
    [despesas, mesFiltro],
  )

  const resumo = useMemo(() => calcularResumoFinanceiro(lancFiltrados), [lancFiltrados])
  const porCategoria = useMemo(
    () => calcularPorCategoria(lancFiltrados, categorias),
    [lancFiltrados, categorias],
  )
  const evolucao = useMemo(() => calcularEvolucao(despesas), [despesas])

  const nomeCategoria = (id: string) => categorias.find((c) => c.id === id)?.nome ?? '—'
  const corCategoria = (id: string) => categorias.find((c) => c.id === id)?.cor ?? '#94a3b8'

  const ultimos = useMemo(
    () => [...lancFiltrados].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6),
    [lancFiltrados],
  )

  const semDados = lancFiltrados.length === 0

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{saudacao()}, João 👋</h1>
          <p className="text-sm text-slate-500">Aqui está o resumo das suas finanças.</p>
        </div>
        <select
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          className="input w-auto"
        >
          <option value="todos">Todos os meses</option>
          {meses.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.rotulo}
            </option>
          ))}
        </select>
      </div>

      {/* Cards: Saldo primeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardSaldo valor={resumo.saldo} />
        <CardResumo titulo="Receitas" valor={resumo.receitas} Icon={IconArrowUp} tom="income" />
        <CardResumo titulo="Despesas" valor={resumo.despesas} Icon={IconArrowDown} tom="expense" />
        <CardResumo
          titulo="Contas a pagar"
          valor={resumo.pendente}
          Icon={IconClock}
          tom="pending"
          rodape={`${lancFiltrados.filter((d) => !ehReceita(d) && !d.pago).length} pendentes`}
        />
      </div>

      {semDados ? (
        <EstadoVazio onNovoLancamento={onNovoLancamento} primeiroUso={despesas.length === 0} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Evolução (2/3) */}
            <div className="card p-5 lg:col-span-2 animate-fade-in">
              <h2 className="font-semibold text-slate-800 mb-4">Evolução financeira</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolucao} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="rotulo" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatarCompacto(Number(v))}
                  />
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#10B981" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#EF4444" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Donut categorias (1/3) */}
            <div className="card p-5 animate-fade-in">
              <h2 className="font-semibold text-slate-800 mb-4">Gastos por categoria</h2>
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={porCategoria} dataKey="total" nameKey="nome" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                      {porCategoria.map((item) => (
                        <Cell key={item.categoriaId} fill={item.cor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs text-slate-400">Total</span>
                  <span className="text-base font-bold text-slate-800">{formatarCompacto(resumo.despesas)}</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {porCategoria.slice(0, 5).map((c) => (
                  <div key={c.categoriaId} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.cor }} />
                      {c.nome}
                    </span>
                    <span className="text-slate-400">{formatarCompacto(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Últimos lançamentos */}
          <div className="card p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">Últimos lançamentos</h2>
              {onNovoLancamento && (
                <button onClick={onNovoLancamento} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Ver todos →
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {ultimos.map((d) => {
                const receita = ehReceita(d)
                return (
                  <div key={d.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: receita ? '#10B981' : corCategoria(d.categoriaId) }}
                      >
                        {receita ? '+' : '−'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{d.descricao}</p>
                        <p className="text-xs text-slate-400">{nomeCategoria(d.categoriaId)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${receita ? 'text-income-600' : 'text-expense-600'}`}>
                        {receita ? '+' : '−'} {formatarMoeda(d.valor)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* CTA flutuante */}
      {onNovoLancamento && (
        <button
          onClick={onNovoLancamento}
          className="fixed bottom-6 right-6 z-30 btn-primary shadow-hover rounded-full pl-4 pr-5 py-3"
        >
          <IconPlus width={18} height={18} />
          Novo lançamento
        </button>
      )}
    </div>
  )
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 30px -10px rgba(15,23,42,0.15)',
  fontSize: 13,
}

function CardSaldo({ valor }: { valor: number }) {
  const positivo = valor >= 0
  return (
    <div className="rounded-2xl p-5 text-white shadow-card bg-gradient-to-br from-slate-800 to-slate-900 animate-scale-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/70">Saldo disponível</p>
        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
          <IconWallet className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold mt-3">{formatarMoeda(valor)}</p>
      <p className={`mt-2 text-xs flex items-center gap-1 ${positivo ? 'text-income-100' : 'text-expense-100'}`}>
        {positivo ? <IconArrowUp width={14} height={14} /> : <IconArrowDown width={14} height={14} />}
        {positivo ? 'Saldo positivo' : 'Saldo negativo'}
      </p>
    </div>
  )
}

const tons = {
  income: { grad: 'from-income-500 to-income-600', icon: IconArrowUp },
  expense: { grad: 'from-expense-500 to-expense-600', icon: IconArrowDown },
  pending: { grad: 'from-pending-500 to-pending-600', icon: IconClock },
} as const

function CardResumo({
  titulo,
  valor,
  Icon,
  tom,
  rodape,
}: {
  titulo: string
  valor: number
  Icon: typeof IconCheck
  tom: keyof typeof tons
  rodape?: string
}) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-card bg-gradient-to-br ${tons[tom].grad} animate-scale-in`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/80">{titulo}</p>
        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
          <Icon className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold mt-3">{formatarMoeda(valor)}</p>
      <p className="mt-2 text-xs text-white/80">{rodape ?? 'este mês'}</p>
    </div>
  )
}

function EstadoVazio({ onNovoLancamento, primeiroUso }: { onNovoLancamento?: () => void; primeiroUso: boolean }) {
  return (
    <div className="card p-12 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-brand-100 text-brand-500 flex items-center justify-center mx-auto mb-4 text-3xl">
        💰
      </div>
      <p className="text-lg font-semibold text-slate-700">Tudo tranquilo por aqui</p>
      <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
        {primeiroUso
          ? 'Você ainda não possui lançamentos. Comece registrando sua primeira receita ou despesa.'
          : 'Nenhum lançamento neste período.'}
      </p>
      {onNovoLancamento && (
        <button onClick={onNovoLancamento} className="btn-primary mx-auto mt-5">
          <IconPlus width={16} height={16} />
          Adicionar lançamento
        </button>
      )}
    </div>
  )
}
