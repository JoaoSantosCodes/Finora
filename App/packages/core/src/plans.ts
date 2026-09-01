// Planos e limites (Matriz de Funcionalidades por Plano — requirements.md).
// Dados puros; nenhuma regra de decisão aqui (isso fica em entitlement.ts).
// A fonte de verdade dos números é a Matriz da spec; não inventar limites.

export type PlanId = 'free' | 'pro' | 'family'

// Recursos com limite QUANTITATIVO (contagem de itens ativos).
export type CountedResource =
  | 'households'      // por Owner
  | 'members'         // por household
  | 'accounts'        // contas ativas
  | 'creditCards'     // cartões de crédito
  | 'categories'      // categorias personalizadas
  | 'goals'           // metas financeiras

// Recursos ILIMITADOS pela matriz (sem limite de plano; limites técnicos à parte).
export type UnlimitedResource = 'transactions'

// Funcionalidades BOOLEANAS (habilitada ou não por plano).
export type FeatureFlag =
  | 'installments'    // parcelamentos
  | 'invoices'        // faturas de cartão
  | 'recurrences'     // V1.1
  | 'budgets'         // V1.2
  | 'familySharing'   // V1.3
  | 'dataExport'      // exportação
  | 'dataImport'      // V1.4
  | 'trial'           // trial de plano pago disponível

// null = ilimitado (sem limite imposto pelo plano).
export type Limit = number | null

export interface PlanDefinition {
  id: PlanId
  counted: Record<CountedResource, Limit>
  features: Record<FeatureFlag, boolean>
  reportHistoryMonths: Limit // null = ilimitado
}

// Espelho fiel da Matriz de Funcionalidades por Plano (requirements.md).
export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    counted: {
      households: 1,
      members: 1,
      accounts: 3,
      creditCards: 1,
      categories: 10,
      goals: 1,
    },
    features: {
      installments: true,
      invoices: true,
      recurrences: false,
      budgets: false,
      familySharing: false,
      dataExport: true,
      dataImport: false,
      trial: false, // Free não tem trial (matriz: "—")
    },
    reportHistoryMonths: 3,
  },
  pro: {
    id: 'pro',
    counted: {
      households: 1,
      members: 1,
      accounts: null,
      creditCards: null,
      categories: null,
      goals: null,
    },
    features: {
      installments: true,
      invoices: true,
      recurrences: true,
      budgets: true,
      familySharing: false,
      dataExport: true,
      dataImport: true,
      trial: true,
    },
    reportHistoryMonths: null,
  },
  family: {
    id: 'family',
    counted: {
      households: 1,
      members: 6,
      accounts: null,
      creditCards: null,
      categories: null,
      goals: null,
    },
    features: {
      installments: true,
      invoices: true,
      recurrences: true,
      budgets: true,
      familySharing: true,
      dataExport: true,
      dataImport: true,
      trial: true,
    },
    reportHistoryMonths: null,
  },
}
