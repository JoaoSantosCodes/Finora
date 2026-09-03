import { Suspense, lazy, useState } from 'react'
import { FinoraProvider } from './store'
import {
  IconDashboard,
  IconList,
  IconSettings,
  IconWallet,
} from './components/icons'

const Dashboard = lazy(() => import('./components/Dashboard'))
const Lancamentos = lazy(() => import('./components/Lancamentos'))
const Contas = lazy(() => import('./components/Contas'))
const Cartoes = lazy(() => import('./components/Cartoes'))
const Faturas = lazy(() => import('./components/Faturas'))
const Orcamentos = lazy(() => import('./components/Orcamentos'))
const Configuracoes = lazy(() => import('./components/Configuracoes'))

type Aba = 'dashboard' | 'lancamentos' | 'contas' | 'cartoes' | 'faturas' | 'orcamentos' | 'configuracoes'

interface NavItem {
  id: Aba
  label: string
  Icon: typeof IconDashboard
}

// Itens funcionais hoje. Os demais módulos aparecem como "Em breve".
const navPrincipal: NavItem[] = [
  { id: 'dashboard', label: 'Visão geral', Icon: IconDashboard },
]

const grupos: { titulo: string; itens: { label: string; ativo?: Aba }[] }[] = [
  {
    titulo: 'Financeiro',
    itens: [
      { label: 'Lançamentos', ativo: 'lancamentos' },
      { label: 'Contas', ativo: 'contas' },
      { label: 'Cartões', ativo: 'cartoes' },
      { label: 'Faturas', ativo: 'faturas' },
    ],
  },
  {
    titulo: 'Planejamento',
    itens: [{ label: 'Orçamentos', ativo: 'orcamentos' }, { label: 'Metas' }],
  },
  {
    titulo: 'Análises',
    itens: [{ label: 'Relatórios' }, { label: 'Insights' }],
  },
]

export default function App() {
  const [aba, setAba] = useState<Aba>('dashboard')

  return (
    <FinoraProvider>
      <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col border-r border-slate-200/80 bg-white/70 backdrop-blur-sm px-3 py-5">
          <div className="px-2">
            <Logo />
          </div>

          <nav className="mt-6 flex-1 overflow-y-auto">
            {navPrincipal.map(({ id, label, Icon }) => (
              <NavButton
                key={id}
                label={label}
                Icon={Icon}
                active={aba === id}
                onClick={() => setAba(id)}
              />
            ))}

            {grupos.map((g) => (
              <div key={g.titulo} className="mt-5">
                <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {g.titulo}
                </p>
                {g.itens.map((item) =>
                  item.ativo ? (
                    <NavButton
                      key={item.label}
                      label={item.label}
                      Icon={IconList}
                      active={aba === item.ativo}
                      onClick={() => setAba(item.ativo!)}
                    />
                  ) : (
                    <NavDisabled key={item.label} label={item.label} />
                  ),
                )}
              </div>
            ))}

            <div className="mt-5 border-t border-slate-100 pt-3">
              <NavButton
                label="Configurações"
                Icon={IconSettings}
                active={aba === 'configuracoes'}
                onClick={() => setAba('configuracoes')}
              />
            </div>
          </nav>

          <ProfileFooter />
        </aside>

        {/* Conteúdo */}
        <div className="flex flex-col min-h-screen">
          {/* Topbar (mobile) */}
          <header className="lg:hidden sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200/80 px-4 py-3">
            <Logo compact />
            <nav className="mt-3 flex gap-1 overflow-x-auto">
              <MobileTab label="Visão geral" Icon={IconDashboard} active={aba === 'dashboard'} onClick={() => setAba('dashboard')} />
              <MobileTab label="Lançamentos" Icon={IconList} active={aba === 'lancamentos'} onClick={() => setAba('lancamentos')} />
              <MobileTab label="Contas" Icon={IconWallet} active={aba === 'contas'} onClick={() => setAba('contas')} />
              <MobileTab label="Config." Icon={IconSettings} active={aba === 'configuracoes'} onClick={() => setAba('configuracoes')} />
            </nav>
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-6xl w-full mx-auto">
            <Suspense fallback={<Carregando />}>
              <div key={aba} className="animate-fade-in">
                {aba === 'dashboard' && <Dashboard onNovoLancamento={() => setAba('lancamentos')} />}
                {aba === 'lancamentos' && <Lancamentos />}
                {aba === 'contas' && <Contas />}
                {aba === 'cartoes' && <Cartoes />}
                {aba === 'faturas' && <Faturas />}
                {aba === 'orcamentos' && <Orcamentos />}
                {aba === 'configuracoes' && <Configuracoes />}
              </div>
            </Suspense>
          </main>
        </div>
      </div>
    </FinoraProvider>
  )
}

function NavButton({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string
  Icon: typeof IconDashboard
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className={active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} width={18} height={18} />
      {label}
    </button>
  )
}

function NavDisabled({ label }: { label: string }) {
  return (
    <div
      className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 cursor-not-allowed select-none"
      title="Em breve"
    >
      <span className="flex items-center gap-3">
        <IconList className="text-slate-200" width={18} height={18} />
        {label}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-300 border border-slate-200 rounded-full px-1.5 py-0.5">
        breve
      </span>
    </div>
  )
}

function MobileTab({ label, Icon, active, onClick }: { label: string; Icon: typeof IconDashboard; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
        active ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon width={16} height={16} />
      {label}
    </button>
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

function ProfileFooter() {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5">
      <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 font-semibold flex items-center justify-center text-sm">
        JS
      </div>
      <div className="leading-tight min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">João Santos</p>
        <p className="text-xs text-brand-600 font-medium">Plano Pro</p>
      </div>
    </div>
  )
}

function Carregando() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
      <div className="w-5 h-5 border-2 border-slate-300 border-t-brand-500 rounded-full animate-spin mr-2" />
      <IconWallet className="hidden" />
      Carregando…
    </div>
  )
}
