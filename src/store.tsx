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
import { SyncEngine } from './api/sync/sync_engine'
import { MutationQueue } from './api/sync/mutation_queue'

export interface FinoraContextValue extends FinoraState {
  syncStatus: 'idle' | 'syncing' | 'offline' | 'conflict'
  conflictsCount: number
  adicionarDespesa: (d: Omit<Despesa, 'id'>) => void
  atualizarDespesa: (id: string, patch: Partial<Despesa>) => void
  removerDespesa: (id: string) => void
  alternarPago: (id: string) => void
  adicionarCategoria: (c: Omit<Categoria, 'id'>) => void
  removerCategoria: (id: string) => void
  sincronizar: () => Promise<void>
}

const FinoraContext = createContext<FinoraContextValue | null>(null)

function gerarId(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// Instância singleton do SyncEngine para o frontend
const mutationQueue = new MutationQueue()
export const syncEngine = new SyncEngine(mutationQueue)

export function FinoraProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinoraState>(() => carregarEstado())
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'offline' | 'conflict'>('idle')
  const [conflictsCount, setConflictsCount] = useState(0)

  useEffect(() => {
    salvarEstado(state)
  }, [state])

  // Escutar eventos de conectividade para sincronização automática (Req 19.5)
  useEffect(() => {
    const handleOnline = () => {
      sincronizar()
    }
    const handleOffline = () => {
      setSyncStatus('offline')
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      if (!navigator.onLine) {
        setSyncStatus('offline')
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  const sincronizar = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline')
      return
    }

    setSyncStatus('syncing')
    try {
      // Executor simulado de envio à API (REST /v1/* com verificação de idempotência DB-006)
      await syncEngine.syncPending(async (_mutation) => {
        // Envio bem sucedido
        return { success: true }
      })

      const conflicts = mutationQueue.getConflicts().length
      setConflictsCount(conflicts)

      if (conflicts > 0) {
        setSyncStatus('conflict')
      } else {
        setSyncStatus('idle')
      }
    } catch {
      setSyncStatus('offline')
    }
  }

  const value = useMemo<FinoraContextValue>(
    () => ({
      ...state,
      syncStatus,
      conflictsCount,
      sincronizar,
      adicionarDespesa: (d) => {
        const id = gerarId('desp')
        const novaDespesa: Despesa = { ...d, id }
        setState((s) => ({
          ...s,
          despesas: [...s.despesas, novaDespesa],
        }))
        // Enfileirar mutação no SyncEngine (Req 19.5)
        syncEngine.enqueue('default-household', 'transaction', 'create', novaDespesa)
      },
      atualizarDespesa: (id, patch) => {
        setState((s) => ({
          ...s,
          despesas: s.despesas.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }))
        // Enfileirar mutação no SyncEngine
        syncEngine.enqueue('default-household', 'transaction', 'update', { id, ...patch })
      },
      removerDespesa: (id) => {
        setState((s) => ({
          ...s,
          despesas: s.despesas.filter((x) => x.id !== id),
        }))
        // Enfileirar mutação no SyncEngine
        syncEngine.enqueue('default-household', 'transaction', 'delete', { id })
      },
      alternarPago: (id) => {
        let novoStatus = false
        setState((s) => ({
          ...s,
          despesas: s.despesas.map((x) => {
            if (x.id === id) {
              novoStatus = !x.pago
              return { ...x, pago: novoStatus }
            }
            return x
          }),
        }))
        // Enfileirar mutação no SyncEngine
        syncEngine.enqueue('default-household', 'transaction', 'update', { id, pago: novoStatus })
      },
      adicionarCategoria: (c) => {
        const id = gerarId('cat')
        const novaCat: Categoria = { ...c, id }
        setState((s) => ({
          ...s,
          categorias: [...s.categorias, novaCat],
        }))
        // Enfileirar mutação no SyncEngine
        syncEngine.enqueue('default-household', 'category', 'create', novaCat)
      },
      removerCategoria: (id) => {
        setState((s) => ({
          ...s,
          categorias: s.categorias.filter((x) => x.id !== id),
        }))
        // Enfileirar mutação no SyncEngine
        syncEngine.enqueue('default-household', 'category', 'delete', { id })
      },
    }),
    [state, syncStatus, conflictsCount],
  )

  return <FinoraContext.Provider value={value}>{children}</FinoraContext.Provider>
}

export function useFinora(): FinoraContextValue {
  const ctx = useContext(FinoraContext)
  if (!ctx) throw new Error('useFinora deve ser usado dentro de FinoraProvider')
  return ctx
}
