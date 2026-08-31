// Tipos centrais do Finora (espelham a lógica da planilha)

// Classificação de gasto (aba "Banco de dados")
export type Classificacao = 'Essencial' | 'Fixo' | 'Variável' | 'Supérfluo'

// Categoria com cor associada (aba "Banco de dados")
export interface Categoria {
  id: string
  nome: string
  cor: string
  classificacao: Classificacao
}

// Uma despesa lançada (aba "Planilha Financeira - Orange")
export interface Despesa {
  id: string
  descricao: string
  categoriaId: string
  data: string // ISO: YYYY-MM-DD
  valor: number
  parcelado: boolean
  parcelas: number // 1 = à vista
  pago: boolean
}

// Estado completo persistido
export interface FinoraState {
  categorias: Categoria[]
  despesas: Despesa[]
}

// Resultados consolidados (aba "Calc_Data")
export interface ResumoIndicadores {
  totalGastos: number
  totalPago: number
  totalPendente: number
}

export interface GastoPorCategoria {
  categoriaId: string
  nome: string
  cor: string
  total: number
}

export interface GastoPorMes {
  mes: string // YYYY-MM
  rotulo: string // ex: "ago/2026"
  total: number
}
