// FeatureGate: decisões puras de acesso por plano. Sem I/O.
// Recebe o estado necessário (plano + contagem de uso) como parâmetro e retorna a decisão.
// Regras: design.md §Billing (FeatureGate como fonte única); limites da Matriz (requirements.md).
import {
  PLANS,
  type PlanId,
  type CountedResource,
  type FeatureFlag,
  type Limit,
} from './plans.ts'

export interface GateDecision {
  allowed: boolean
  /** Motivo quando negado (para UI/mensagem). */
  reason?: 'limit_reached' | 'feature_not_in_plan'
  /** Limite do plano para o recurso (null = ilimitado), quando aplicável. */
  limit?: Limit
}

const ALLOW: GateDecision = { allowed: true }

/** Limite quantitativo do plano para um recurso (null = ilimitado). */
export function limitFor(plan: PlanId, resource: CountedResource): Limit {
  return PLANS[plan].counted[resource]
}

/** Uma feature booleana está habilitada no plano? */
export function hasFeature(plan: PlanId, feature: FeatureFlag): boolean {
  return PLANS[plan].features[feature]
}

/** Janela de histórico de relatórios em meses (null = ilimitado). */
export function reportHistoryMonths(plan: PlanId): Limit {
  return PLANS[plan].reportHistoryMonths
}

/**
 * Pode CRIAR mais um item de um recurso contado, dado o uso atual?
 * Regra (Req 18.1): criar é permitido enquanto currentCount < limite.
 * No limite exato (currentCount === limite) → negado. Ilimitado (null) → sempre permitido.
 * currentCount é a contagem de itens ATIVOS (não arquivados/excluídos) — nota da Matriz.
 */
export function canCreate(
  plan: PlanId,
  resource: CountedResource,
  currentCount: number,
): GateDecision {
  const limit = limitFor(plan, resource)
  if (limit === null) return ALLOW
  if (currentCount < limit) return ALLOW
  return { allowed: false, reason: 'limit_reached', limit }
}

/**
 * Pode USAR uma feature booleana? (Req 18.2)
 * Negado quando a feature não está habilitada no plano.
 */
export function canUse(plan: PlanId, feature: FeatureFlag): GateDecision {
  if (hasFeature(plan, feature)) return ALLOW
  return { allowed: false, reason: 'feature_not_in_plan' }
}

/**
 * Uso atual excede o limite do plano? (usado após downgrade — Req 17.8)
 * Ilimitado (null) nunca excede. Excede quando currentCount > limite
 * (itens acima do limite ficam somente-leitura; criação de novos é bloqueada por canCreate).
 */
export function exceedsLimit(
  plan: PlanId,
  resource: CountedResource,
  currentCount: number,
): boolean {
  const limit = limitFor(plan, resource)
  if (limit === null) return false
  return currentCount > limit
}
