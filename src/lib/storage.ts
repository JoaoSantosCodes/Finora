import type { FinoraState, Categoria } from '../types'

const STORAGE_KEY = 'finora:state:v1'

// Categorias padrão (equivale à aba "Banco de dados")
export const categoriasPadrao: Categoria[] = [
  { id: 'cat-moradia', nome: 'Moradia', cor: '#F97316', classificacao: 'Fixo' },
  { id: 'cat-alimentacao', nome: 'Alimentação', cor: '#10B981', classificacao: 'Essencial' },
  { id: 'cat-transporte', nome: 'Transporte', cor: '#3B82F6', classificacao: 'Essencial' },
  { id: 'cat-saude', nome: 'Saúde', cor: '#EF4444', classificacao: 'Essencial' },
  { id: 'cat-lazer', nome: 'Lazer', cor: '#8B5CF6', classificacao: 'Supérfluo' },
  { id: 'cat-educacao', nome: 'Educação', cor: '#F59E0B', classificacao: 'Fixo' },
  { id: 'cat-outros', nome: 'Outros', cor: '#6B7280', classificacao: 'Variável' },
]

const estadoInicial: FinoraState = {
  categorias: categoriasPadrao,
  despesas: [],
}

export function carregarEstado(): FinoraState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return estadoInicial
    const parsed = JSON.parse(raw) as FinoraState
    return {
      categorias: parsed.categorias?.length ? parsed.categorias : categoriasPadrao,
      despesas: parsed.despesas ?? [],
    }
  } catch {
    return estadoInicial
  }
}

export function salvarEstado(state: FinoraState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Silencioso: em modo privado o localStorage pode falhar
  }
}
