import { useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useFinora } from '../store'
import {
  calcularIndicadores,
  calcularPorCategoria,
  calcularPorMes,
  formatarMoeda,
  formatarCompacto,
  mesesDisponiveis,
  variacaoMensal,
} from '../lib/calc'
import {
  IconWallet,
  IconCheck,
  IconClock,
  IconArrowUp,
  IconArrowDown,
} from './icons'

export default function Dashboard() {
  const { despesas, categorias } = useFinora()
  const [mesFiltro, setMesFiltro] = useState<string>('todos')

  const meses = useMemo(() => mesesDisponiveis(despesas), [despesas])

  const despesasFiltradas = useMemo(
    () =>
      mesFiltro === 'todos'
        ? despesas
        : despesas.filter((d) => d.data.slice(0, 7) === mesFiltro),
    [despesas, mesFiltro],
  )

  const indicadores = useMemo(
    () => calcularIndicadores(despesasFiltradas),
    [despesasFiltradas],
  )
  const porCategoria = useMemo(
    () => calcularPorCategoria(despesasFiltradas, categorias),
    [despesasFiltradas, categorias],
  )
  const porMes = useMemo(() => calcularPorMes(despesas), [despesas])
  const variacao = useMemo(() => variacaoMensal(porMes), [porMes])

  const nomeCategoria = (id: string) =>
    categorias.find((c) => c.id === id)?.nome ?? '—'
  const corCategoria = (id: string) =>
    categorias.find((c) => c.id === id)?.cor ?? '#94a3b8'

  const percentualPago =
    indicadores.totalGastos > 0
      ? Math.round((indicadores.totalPago / indicadores.totalGastos) * 100)
      : 0

  return (
    <div className="space-y-6">
      {/* Cabeçalho + filtro */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Visão geral</h1>
          <p className="text-sm text-slate-500">
            Acompanhe seus gastos, pagamentos e pendências.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Período</label>
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
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CardIndicador
          titulo="Total de Gastos"
          valor={indicadores.totalGastos}
          Icon={IconWallet}
          gradiente="from-slate-700 to-slate-900"
          rodape={
            variacao !== null && mesFiltro === 'todos' ? (
              <Variacao valor={variacao} />
            ) : (
              <span className="text-white/70">{despesasFiltradas.length} lançamentos</span>
            )
          }
        />
        <CardIndicador
          titulo="Total Pago"
          valor={indicadores.totalPago}
          Icon={IconCheck}
          gradiente="from-emerald-500 to-emerald-600"
          rodape={<span className="text-white/80">{percentualPago}% do total</span>}
        />
        <CardIndicador
          titulo="Total Pendente"
          valor={indicadores.totalPendente}
          Icon={IconClock}
          gradiente="from-brand-400 to-brand-600"
          rodape={<span className="text-white/80">{100 - percentualPago}% do total</span>}
        />
      </div>

      {/* Barra de progresso pago vs pendente */}
      {indicadores.totalGastos > 0 && (
        <div className="card p-5 animate-fade-in">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Progresso de pagamento</span>
            <span className="font-semibold text-slate-700">{percentualPago}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
              style={{ width: `${percentualPago}%` }}
            />
          </div>
        </div>
      )}

      {despesasFiltradas.length === 0 ? (
        <EstadoVazio />
      ) : (
        <>
          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card titulo="Gastos por Categoria">
              <div className="relative">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={porCategoria}
                      dataKey="total"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={105}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {porCategoria.map((item) => (
                        <Cell key={item.categoriaId} fill={item.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatarMoeda(v)}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs text-slate-400">Total</span>
                  <span className="text-lg font-bold text-slate-800">
                    {formatarCompacto(indicadores.totalGastos)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {porCategoria.map((c) => (
                  <div key={c.categoriaId} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: c.cor }}
                    />
                    <span className="text-slate-600">{c.nome}</span>
                    <span className="text-slate-400">{formatarCompacto(c.total)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card titulo="Comparação de Meses">
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={porMes} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FB923C" />
                      <stop offset="100%" stopColor="#EA580C" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="rotulo" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatarCompacto(Number(v))}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(v: number) => formatarMoeda(v)}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="total" name="Total" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Detalhamento */}
          <Card titulo="Detalhamento das Despesas">
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="py-2.5 px-1 font-medium">Descrição</th>
                    <th className="py-2.5 px-1 font-medium">Categoria</th>
                    <th className="py-2.5 px-1 font-medium">Data</th>
                    <th className="py-2.5 px-1 font-medium text-right">Valor</th>
                    <th className="py-2.5 px-1 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {despesasFiltradas.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-1 font-medium text-slate-700">{d.descricao}</td>
                      <td className="py-2.5 px-1">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: corCategoria(d.categoriaId) }}
                          />
                          {nomeCategoria(d.categoriaId)}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-slate-500">
                        {new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-1 text-right font-semibold text-slate-700">
                        {formatarMoeda(d.valor)}
                      </td>
                      <td className="py-2.5 px-1 text-center">
                        <Badge pago={d.pago} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
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

function CardIndicador({
  titulo,
  valor,
  Icon,
  gradiente,
  rodape,
}: {
  titulo: string
  valor: number
  Icon: typeof IconWallet
  gradiente: string
  rodape: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-card bg-gradient-to-br ${gradiente} animate-scale-in`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/80">{titulo}</p>
        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
          <Icon className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold mt-3">{formatarMoeda(valor)}</p>
      <div className="mt-2 text-xs">{rodape}</div>
    </div>
  )
}

function Variacao({ valor }: { valor: number }) {
  const subiu = valor >= 0
  return (
    <span className={`inline-flex items-center gap-1 ${subiu ? 'text-red-200' : 'text-emerald-200'}`}>
      {subiu ? <IconArrowUp width={14} height={14} /> : <IconArrowDown width={14} height={14} />}
      {Math.abs(valor).toFixed(1)}% vs mês anterior
    </span>
  )
}

function Badge({ pago }: { pago: boolean }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
        pago ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
      }`}
    >
      {pago ? 'Pago' : 'Pendente'}
    </span>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 animate-fade-in">
      <h2 className="font-semibold text-slate-800 mb-4">{titulo}</h2>
      {children}
    </div>
  )
}

function EstadoVazio() {
  return (
    <div className="card p-12 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-500 flex items-center justify-center mx-auto mb-4">
        <IconWallet width={28} height={28} />
      </div>
      <p className="text-slate-600 font-medium">Nenhuma despesa neste período</p>
      <p className="text-sm text-slate-400 mt-1">
        Adicione lançamentos na aba <strong>Lançamentos</strong> para ver os gráficos aqui.
      </p>
    </div>
  )
}
