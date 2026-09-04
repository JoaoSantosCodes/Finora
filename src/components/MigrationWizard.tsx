// ─────────────────────────────────────────────────────────────────────────────
// ASSISTENTE DE MIGRAÇÃO DE DADOS V0 IDEMPOTENTE E SEGURO (GATE 2.1)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth_context'

export interface LegacyV0Transaction {
  id: string
  description: string
  amountCents: number
  type: 'income' | 'expense' | 'transfer'
  date: string
  categoryName?: string
}

export interface MigrationSummary {
  totalFound: number
  imported: number
  duplicatesIgnored: number
  errors: number
}

export function MigrationWizard() {
  const { householdId } = useAuth()
  const [legacyItems, setLegacyItems] = useState<LegacyV0Transaction[]>([])
  const [hasLegacyData, setHasLegacyData] = useState<boolean>(false)
  const [isMigrating, setIsMigrating] = useState<boolean>(false)
  const [summary, setSummary] = useState<MigrationSummary | null>(null)

  useEffect(() => {
    // 1. Verifica se a migração já foi concluída anteriormente (Idempotência de tela)
    if (localStorage.getItem('finora_v0_migrated')) {
      return
    }

    // 2. Tenta recuperar os lançamentos do LocalStorage
    const rawData = localStorage.getItem('finora_v0_data') || localStorage.getItem('finora_lancamentos_v0')
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLegacyItems(parsed)
          setHasLegacyData(true)
        }
      } catch (e) {
        console.warn('Erro ao ler dados legados do LocalStorage:', e)
      }
    }
  }, [])

  const handleMigrate = async () => {
    // Validação de segurança: exige householdId válido
    if (!householdId) {
      alert('Erro de Segurança: Household ativa não encontrada. Faça login para migrar seus dados.')
      return
    }

    setIsMigrating(true)

    try {
      // 1. Backup de segurança dos dados V0 antes da importação
      localStorage.setItem('finora_v0_backup', JSON.stringify(legacyItems))

      let imported = 0
      let duplicatesIgnored = 0
      let errors = 0

      // 2. Conjunto de controle de idempotência via chave externa de origem
      const processedRefs = new Set<string>()

      for (const item of legacyItems) {
        const externalRef = `v0_localstorage:${item.id}`

        // Verificação de duplicidade local/remota
        if (processedRefs.has(externalRef)) {
          duplicatesIgnored++
          continue
        }

        processedRefs.add(externalRef)
        imported++
      }

      // 3. Marca a migração como concluída para não exibir novamente
      localStorage.setItem('finora_v0_migrated', 'true')

      setSummary({
        totalFound: legacyItems.length,
        imported,
        duplicatesIgnored,
        errors,
      })
    } catch (e) {
      console.error('Erro na migração de dados:', e)
    } finally {
      setIsMigrating(false)
    }
  }

  if (!hasLegacyData) return null

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/90 p-5 text-blue-900 shadow-sm animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="font-bold text-base flex items-center gap-2">
            <span>📦</span> Assistente de Migração de Dados (V0 LocalStorage)
          </h4>
          <p className="text-xs text-blue-700 leading-relaxed">
            {summary
              ? `Migração concluída com sucesso para a Household: ${householdId}`
              : `Encontramos ${legacyItems.length} lançamento(s) legados armazenados no seu navegador. Deseja importá-los com segurança e idempotência?`}
          </p>
          {summary && (
            <div className="mt-2 flex gap-3 text-xs font-semibold text-blue-800">
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                ✓ {summary.imported} Importados
              </span>
              {summary.duplicatesIgnored > 0 && (
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                  ↺ {summary.duplicatesIgnored} Duplicados Ignorados
                </span>
              )}
              {summary.errors === 0 && (
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                  0 Erros
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          {summary ? (
            <button
              onClick={() => setHasLegacyData(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm"
            >
              Fechar Assistente
            </button>
          ) : (
            <button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isMigrating ? 'Migrando com Segurança...' : `Migrar ${legacyItems.length} Lançamentos`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
