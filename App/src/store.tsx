import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Categoria, Despesa, FinoraState } from './types'
import { carregarEstado, salvarEstado } from './lib/storage'

interface FinoraContextValue extends FinoraState {
  adicionarDespesa: (d: Omit<Despesa, 'id'>) => void
  atualizarDespesa: (id: string, patch: Partial<Despesa>) => void
  removerDespesa: (id: string) => void
  alternarPago: (id: string) => void
  adicionarCategoria: (c: Omit<Categoria, 'id'>) => void
  removerCategoria: (id: string) => void
}

const FinoraContext = createContext<FinoraContextValue | null>(null)

function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function FinoraProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinoraState>(() => carregarEstado())

  useEffect(() => {
    salvarEstado(state)
  }, [state])

  const value = useMemo<FinoraContextValue>(
    () => ({
      ...state,
      adicionarDespesa: (d) =>
        setState((s) => ({
          ...s,
          despesas: [...s.despesas, { ...d, id: gerarId('desp') }],
        })),
      atualizarDespesa: (id, patch) =>
        setState((s) => ({
          ...s,
          despesas: s.despesas.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removerDespesa: (id) =>
        setState((s) => ({
          ...s,
          despesas: s.despesas.filter((x) => x.id !== id),
        })),
      alternarPago: (id) =>
        setState((s) => ({
          ...s,
          despesas: s.despesas.map((x) =>
            x.id === id ? { ...x, pago: !x.pago } : x,
          ),
        })),
      adicionarCategoria: (c) =>
        setState((s) => ({
          ...s,
          categorias: [...s.categorias, { ...c, id: gerarId('cat') }],
        })),
      removerCategoria: (id) =>
        setState((s) => ({
          ...s,
          categorias: s.categorias.filter((x) => x.id !== id),
        })),
    }),
    [state],
  )

  return <FinoraContext.Provider value={value}>{children}</FinoraContext.Provider>
}

export function useFinora(): FinoraContextValue {
  const ctx = useContext(FinoraContext)
  if (!ctx) throw new Error('useFinora deve ser usado dentro de FinoraProvider')
  return ctx
}
