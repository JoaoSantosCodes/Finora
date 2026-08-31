import { useMemo, useState } from 'react'
import { useFinora } from '../store'
import { formatarMoeda } from '../lib/calc'
import { IconPlus, IconTrash } from './icons'

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function Lancamentos() {
  const { despesas, categorias, adicionarDespesa, removerDespesa, alternarPago } =
    useFinora()

  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? '')
  const [data, setData] = useState(hoje())
  const [valor, setValor] = useState('')
  const [parcelado, setParcelado] = useState(false)
  const [parcelas, setParcelas] = useState('1')
  const [pago, setPago] = useState(false)
  const [busca, setBusca] = useState('')

  const nomeCategoria = (id: string) =>
    categorias.find((c) => c.id === id)?.nome ?? '—'
  const corCategoria = (id: string) =>
    categorias.find((c) => c.id === id)?.cor ?? '#94a3b8'

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = termo
      ? despesas.filter(
          (d) =>
            d.descricao.toLowerCase().includes(termo) ||
            nomeCategoria(d.categoriaId).toLowerCase().includes(termo),
        )
      : despesas
    return [...lista].sort((a, b) => b.data.localeCompare(a.data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [despesas, busca])

  function limpar() {
    setDescricao('')
    setValor('')
    setParcelado(false)
    setParcelas('1')
    setPago(false)
    setData(hoje())
  }

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    const valorNum = Number(valor.replace(',', '.'))
    if (!descricao.trim() || !categoriaId || !valorNum || valorNum <= 0) return

    adicionarDespesa({
      descricao: descricao.trim(),
      categoriaId,
      data,
      valor: valorNum,
      parcelado,
      parcelas: parcelado ? Math.max(1, Number(parcelas)) : 1,
      pago,
    })
    limpar()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Lançamentos</h1>
        <p className="text-sm text-slate-500">Registre e acompanhe cada despesa.</p>
      </div>

      <form onSubmit={submeter} className="card p-5 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
        <h2 className="md:col-span-2 font-semibold text-slate-800">Nova despesa</h2>

        <Campo label="Descrição">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input"
            placeholder="Ex: Conta de luz"
            required
          />
        </Campo>

        <Campo label="Categoria">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="input"
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Data">
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input"
          />
        </Campo>

        <Campo label="Valor (R$)">
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="input"
            inputMode="decimal"
            placeholder="0,00"
            required
          />
        </Campo>

        <div className="md:col-span-2 flex flex-wrap items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              className="accent-brand-500 w-4 h-4"
              checked={parcelado}
              onChange={(e) => setParcelado(e.target.checked)}
            />
            Parcelado
          </label>
          {parcelado && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Parcelas
              <input
                type="number"
                min={1}
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
                className="input w-20"
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              className="accent-emerald-500 w-4 h-4"
              checked={pago}
              onChange={(e) => setPago(e.target.checked)}
            />
            Já pago
          </label>

          <button type="submit" className="btn-primary ml-auto">
            <IconPlus width={16} height={16} />
            Adicionar
          </button>
        </div>
      </form>

      <div className="card p-5 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="font-semibold text-slate-800">
            Despesas ({filtradas.length})
          </h2>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input sm:w-64"
            placeholder="Buscar por descrição ou categoria…"
          />
        </div>

        {filtradas.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">
            {despesas.length === 0 ? 'Nenhuma despesa ainda.' : 'Nada encontrado para a busca.'}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2.5 px-1 font-medium">Descrição</th>
                  <th className="py-2.5 px-1 font-medium">Categoria</th>
                  <th className="py-2.5 px-1 font-medium">Data</th>
                  <th className="py-2.5 px-1 font-medium text-right">Valor</th>
                  <th className="py-2.5 px-1 font-medium text-center">Parc.</th>
                  <th className="py-2.5 px-1 font-medium text-center">Status</th>
                  <th className="py-2.5 px-1 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((d) => (
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
                    <td className="py-2.5 px-1 text-center text-slate-500">
                      {d.parcelado ? `${d.parcelas}x` : '—'}
                    </td>
                    <td className="py-2.5 px-1 text-center">
                      <button
                        onClick={() => alternarPago(d.id)}
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                          d.pago
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                        }`}
                      >
                        {d.pago ? 'Pago' : 'Pendente'}
                      </button>
                    </td>
                    <td className="py-2.5 px-1 text-center">
                      <button
                        onClick={() => removerDespesa(d.id)}
                        className="text-slate-400 hover:text-red-500 transition inline-flex"
                        title="Excluir"
                      >
                        <IconTrash width={16} height={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-600">
      {label}
      {children}
    </label>
  )
}
