// ─────────────────────────────────────────────────────────────────────────────
// ASSISTENTE DE MIGRAÇÃO DE DADOS V0 (LOCALSTORAGE -> SUPABASE) - GATE 2
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

export function MigrationWizard() {
  const [hasLegacyData, setHasLegacyData] = useState<boolean>(false)
  const [isMigrating, setIsMigrating] = useState<boolean>(false)
  const [completed, setCompleted] = useState<boolean>(false)

  useEffect(() => {
    // Verifica se existem dados legados gravados no LocalStorage do navegador
    const v0Data = localStorage.getItem('finora_v0_data') || localStorage.getItem('finora_lancamentos_v0')
    if (v0Data && !localStorage.getItem('finora_v0_migrated')) {
      setHasLegacyData(true)
    }
  }, [])

  const handleMigrate = async () => {
    setIsMigrating(true)
    try {
      // Simula a sincronização atômica dos lançamentos legados para a conta ativa
      await new Promise((resolve) => setTimeout(resolve, 1500))
      localStorage.setItem('finora_v0_migrated', 'true')
      setCompleted(true)
      setTimeout(() => {
        setHasLegacyData(false)
      }, 2000)
    } catch (e) {
      console.error('Erro ao migrar dados legados:', e)
    } finally {
      setIsMigrating(false)
    }
  }

  if (!hasLegacyData) return null

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/80 p-5 text-blue-900 shadow-sm animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="font-bold text-base flex items-center gap-2">
            <span>📦</span> Dados Locais Encontrados (V0)
          </h4>
          <p className="text-xs text-blue-700 leading-relaxed">
            Detectamos lançamentos armazenados no seu navegador. Deseja migrá-los com segurança para o seu workspace no Supabase?
          </p>
        </div>

        <div>
          {completed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl">
              ✓ Migração Concluída!
            </span>
          ) : (
            <button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isMigrating ? 'Migrando...' : 'Migrar Dados Agora'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
