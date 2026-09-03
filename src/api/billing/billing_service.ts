// ─────────────────────────────────────────────────────────────────────────────
// BILLING APPLICATION SERVICE (BILL-002)
// Gerenciamento de assinaturas, máquina de estados e webhooks (Req 17, DB-006)
// ─────────────────────────────────────────────────────────────────────────────

import type { PlanId } from '../../../packages/core/src/plans.ts'
import { PermissionDeniedError, ValidationError, NotFoundError } from '../errors.ts'

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'

export interface SubscriptionRecord {
  id: string
  household_id: string
  plan_id: PlanId
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  trial_end?: string
  grace_period_end?: string
  scheduled_downgrade_plan_id?: PlanId
  created_at: string
}

export interface WebhookEventPayload {
  eventId: string
  eventType: string
  householdId: string
  planId?: PlanId
  status?: SubscriptionStatus
}

export interface SubscriptionRepository {
  getByHousehold(householdId: string): Promise<SubscriptionRecord | null>
  upsert(subscription: Partial<SubscriptionRecord> & { household_id: string }): Promise<SubscriptionRecord>
  hasEvent(householdId: string, eventId: string): Promise<boolean>
  recordEvent(householdId: string, eventId: string, eventType: string, payload: any): Promise<void>
}

export class BillingService {
  private readonly subRepo: SubscriptionRepository

  constructor(subRepo: SubscriptionRepository) {
    this.subRepo = subRepo
  }

  /**
   * Garante a permissão de Owner para operações de billing (Req 17.11).
   */
  private assertOwnerRole(role: string): void {
    if (role !== 'owner') {
      throw new PermissionDeniedError('Apenas o Owner da Household pode gerenciar planos e dados de cobrança.')
    }
  }

  /**
   * Inicia um período de trial de 14 dias para o plano escolhido (Req 17.2).
   */
  async startTrial(householdId: string, planId: PlanId, role: string): Promise<SubscriptionRecord> {
    this.assertOwnerRole(role)

    if (planId === 'free') {
      throw new ValidationError('Trial indisponível para o plano Free.')
    }

    const now = new Date()
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    return await this.subRepo.upsert({
      household_id: householdId,
      plan_id: planId,
      status: 'trialing',
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      trial_end: trialEnd.toISOString(),
    })
  }

  /**
   * Realiza o upgrade imediato de plano com pagamento confirmado (Req 17.5).
   */
  async upgradePlan(householdId: string, targetPlanId: PlanId, role: string): Promise<SubscriptionRecord> {
    this.assertOwnerRole(role)

    const now = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return await this.subRepo.upsert({
      household_id: householdId,
      plan_id: targetPlanId,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      scheduled_downgrade_plan_id: undefined,
    })
  }

  /**
   * Valida e agenda um downgrade para o próximo ciclo de cobrança (Req 17.6, 17.7).
   */
  async requestDowngrade(householdId: string, targetPlanId: PlanId, role: string): Promise<SubscriptionRecord> {
    this.assertOwnerRole(role)

    const current = await this.subRepo.getByHousehold(householdId)
    if (!current) {
      throw new NotFoundError('Assinatura não encontrada para esta Household.')
    }

    // Validar matriz de downgrade permitida (family -> pro/free; pro -> free) (Req 17.6)
    if (current.plan_id === 'free') {
      throw new ValidationError('Plano Free já é o plano mínimo.')
    }
    if (current.plan_id === 'pro' && targetPlanId !== 'free') {
      throw new ValidationError('Caminho de downgrade inválido para o plano Pro.')
    }
    if (current.plan_id === 'family' && targetPlanId !== 'pro' && targetPlanId !== 'free') {
      throw new ValidationError('Caminho de downgrade inválido para o plano Família.')
    }

    // Agendar downgrade para o fim do ciclo vigente (Req 17.7)
    return await this.subRepo.upsert({
      household_id: householdId,
      scheduled_downgrade_plan_id: targetPlanId,
    })
  }

  /**
   * Cancela a assinatura mantendo o acesso até o fim do ciclo pago (Req 17.9).
   */
  async cancelSubscription(householdId: string, role: string): Promise<SubscriptionRecord> {
    this.assertOwnerRole(role)

    return await this.subRepo.upsert({
      household_id: householdId,
      status: 'canceled',
      scheduled_downgrade_plan_id: 'free',
    })
  }

  /**
   * Aplica o estado past_due em falha de pagamento com 7 dias de carência (Req 17.10).
   */
  async handlePaymentFailure(householdId: string): Promise<SubscriptionRecord> {
    const now = new Date()
    const graceEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    return await this.subRepo.upsert({
      household_id: householdId,
      status: 'past_due',
      grace_period_end: graceEnd.toISOString(),
    })
  }

  /**
   * Processamento idempotente de webhooks do provedor de pagamento (DB-006, Req 17).
   */
  async processWebhookEvent(event: WebhookEventPayload): Promise<{ success: boolean; alreadyApplied?: boolean }> {
    // 1. Verificação de idempotência contra a tabela subscription_events (DB-006)
    const alreadyProcessed = await this.subRepo.hasEvent(event.householdId, event.eventId)
    if (alreadyProcessed) {
      return { success: true, alreadyApplied: true }
    }

    // 2. Processar alteração de estado da assinatura
    if (event.eventType === 'checkout.session.completed' || event.eventType === 'invoice.payment_succeeded') {
      if (event.planId) {
        await this.subRepo.upsert({
          household_id: event.householdId,
          plan_id: event.planId,
          status: 'active',
        })
      }
    } else if (event.eventType === 'invoice.payment_failed') {
      await this.handlePaymentFailure(event.householdId)
    } else if (event.eventType === 'customer.subscription.deleted') {
      await this.subRepo.upsert({
        household_id: event.householdId,
        plan_id: 'free',
        status: 'canceled',
      })
    }

    // 3. Registrar o evento na tabela subscription_events para garantir idempotência
    await this.subRepo.recordEvent(event.householdId, event.eventId, event.eventType, event)

    return { success: true }
  }
}
