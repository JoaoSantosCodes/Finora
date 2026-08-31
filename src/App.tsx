import { Suspense, lazy, useState } from 'react'
import { FinoraProvider } from './store'
import {
  IconDashboard,
  IconList,
  IconSettings,
} from './components/icons'

const Dashboard = lazy(() => import('./components/Dashboard'))
const Lancamentos = lazy(() => import('./components/Lancamentos'))
const Configuracoes = lazy(() => import('./components/Configuracoes'))

type Aba = 'dashboard' | 'lancamentos' | 'configuracoes'

const abas: { id: Aba; label: string; Icon: typeof IconDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconDashboard },
  { id: 'lancamentos', label: 'Lançamentos', Icon: IconList },
  { id: 'configuracoes', label: 'Configurações', Icon: IconSettings },
]

export default function App() {
  const [aba, setAba] = useState<Aba>('dashboard')

  return (
    <FinoraProvider>
      <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col gap-1 border-r border-slate-200/80 bg-white/70 backdrop-blur-sm px-4 py-6">
          <Logo />
          <nav className="mt-6 flex flex-col gap-1">
            {abas.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setAba(id)}
                className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  aba === id
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon
                  className={aba === id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}
                />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto text-xs text-slate-400 px-1">
            Dados salvos neste navegador
          </div>
        </aside>

        {/* Conteúdo */}
        <div className="flex flex-col min-h-screen">
          {/* Topbar (mobile) */}
          <header className="lg:hidden sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200/80 px-4 py-3">
            <div className="flex items-center justify-between">
              <Logo compact />
            </div>
            <nav className="mt-3 flex gap-1">
              {abas.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setAba(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
                    aba === id
                      ? 'bg-brand-500 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon width={16} height={16} />
                  {label}
                </button>
              ))}
            </nav>
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-6xl w-full mx-auto">
            <Suspense fallback={<Carregando />}>
              <div key={aba} className="animate-fade-in">
                {aba === 'dashboard' && <Dashboard />}
                {aba === 'lancamentos' && <Lancamentos />}
                {aba === 'configuracoes' && <Configuracoes />}
              </div>
            </Suspense>
          </main>
        </div>
      </div>
    </FinoraProvider>
  )
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white font-extrabold flex items-center justify-center shadow-sm">
        F
      </div>
      <div className="leading-tight">
        <p className="font-bold text-slate-800">Finora</p>
        {!compact && <p className="text-xs text-slate-400">Controle financeiro</p>}
      </div>
    </div>
  )
}

function Carregando() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
      <div className="w-5 h-5 border-2 border-slate-300 border-t-brand-500 rounded-full animate-spin mr-2" />
      Carregando…
    </div>
  )
}
