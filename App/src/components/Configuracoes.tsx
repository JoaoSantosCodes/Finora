import { useState } from 'react'
import { useFinora } from '../store'
import type { Classificacao } from '../types'
import { IconPlus, IconTrash } from './icons'

const classificacoes: Classificacao[] = ['Essencial', 'Fixo', 'Variável', 'Supérfluo']

const coresClassificacao: Record<Classificacao, string> = {
  Essencial: 'bg-emerald-100 text-emerald-700',
  Fixo: 'bg-blue-100 text-blue-700',
  Variável: 'bg-amber-100 text-amber-700',
  Supérfluo: 'bg-purple-100 text-purple-700',
}

const paleta = [
  '#F97316', '#10B981', '#3B82F6', '#EF4444',
  '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6',
]

export default function Configuracoes() {
  const { categorias, despesas, adicionarCategoria, removerCategoria } = useFinora()

  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#F97316')
  const [classificacao, setClassificacao] = useState<Classificacao>('Variável')

  const emUso = (id: string) => despesas.some((d) => d.categoriaId === id)
  const contagem = (id: string) => despesas.filter((d) => d.categoriaId === id).length

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    adicionarCategoria({ nome: nome.trim(), cor, classificacao })
    setNome('')
    setCor('#F97316')
    setClassificacao('Variável')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configurações</h1>
        <p className="text-sm text-slate-500">
          Gerencie categorias, cores e classificações.
        </p>
      </div>

      <form onSubmit={submeter} className="card p-5 animate-fade-in">
        <h2 className="font-semibold text-slate-800 mb-4">Nova categoria</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-600 md:col-span-2">
            Nome
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input"
              placeholder="Ex: Assinaturas"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-600">
            Classificação
            <select
              value={classificacao}
              onChange={(e) => setClassificacao(e.target.value as Classificacao)}
              className="input"
            >
              {classificacoes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-600">
            Cor
            <div className="flex items-center gap-1.5 flex-wrap h-[42px]">
              {paleta.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={`w-6 h-6 rounded-full transition ${
                    cor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button type="submit" className="btn-primary">
            <IconPlus width={16} height={16} />
            Adicionar categoria
          </button>
        </div>
      </form>

      <div className="card p-5 animate-fade-in">
        <h2 className="font-semibold text-slate-800 mb-4">
          Categorias ({categorias.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categorias.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between border border-slate-200/80 rounded-xl px-3.5 py-3 hover:shadow-card transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-8 h-8 rounded-lg shrink-0"
                  style={{ backgroundColor: c.cor }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{c.nome}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${coresClassificacao[c.classificacao]}`}
                    >
                      {c.classificacao}
                    </span>
                    {contagem(c.id) > 0 && (
                      <span className="text-[11px] text-slate-400">
                        {contagem(c.id)} lançamento{contagem(c.id) > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => removerCategoria(c.id)}
                disabled={emUso(c.id)}
                title={emUso(c.id) ? 'Categoria em uso por despesas' : 'Remover'}
                className="text-slate-300 hover:text-red-500 disabled:text-slate-200 disabled:cursor-not-allowed transition shrink-0"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
