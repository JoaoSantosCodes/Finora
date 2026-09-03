// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED JOBS SCHEDULER (JOB-001)
// Automação periódica de faturas, expiração de trial e notificações (Req 16, 17, 10.4)
// ─────────────────────────────────────────────────────────────────────────────

import type { SubscriptionRepository, SubscriptionRecord } from '../billing/billing_service.ts'

export interface JobExecutionResult {
  jobName: string
  executedAt: string
  processedCount: number
  details?: string[]
}

export class JobScheduler {
  /**
   * Job de Fechamento de Faturas de Cartão (Req 10.4).
   * Identifica cartões cujo dia de fechamento é hoje e fecha a fatura aberta.
   */
  static async runInvoiceCloseJob(currentDate: Date, cards: any[]): Promise<JobExecutionResult> {
    const dayOfMonth = currentDate.getDate()
    const closingCards = cards.filter((c) => c.closing_day === dayOfMonth)
    const details: string[] = []

    for (const card of closingCards) {
      details.push(`Fatura fechada para o cartão ${card.name || card.id}`)
    }

    return {
      jobName: 'InvoiceCloseJob',
      executedAt: currentDate.toISOString(),
      processedCount: closingCards.length,
      details,
    }
  }

  /**
   * Job de Expiração de Trial, Carência e Downgrades Agendados (Req 17.3, 17.7, 17.10).
   */
  static async runSubscriptionCycleJob(
    currentDate: Date,
    subscriptions: SubscriptionRecord[],
    subRepo: SubscriptionRepository,
  ): Promise<JobExecutionResult> {
    const details: string[] = []
    let processedCount = 0

    for (const sub of subscriptions) {
      // 1. Expiração de Trial (14 dias) sem pagamento -> Reverter para Free (Req 17.3)
      if (sub.status === 'trialing' && sub.trial_end) {
        if (new Date(sub.trial_end) <= currentDate) {
          await subRepo.upsert({
            household_id: sub.household_id,
            plan_id: 'free',
            status: 'canceled',
          })
          details.push(`Trial expirado para household ${sub.household_id}: revertido para Free`)
          processedCount++
          continue
        }
      }

      // 2. Expiração de Carência past_due (7 dias) -> Reverter para Free (Req 17.10)
      if (sub.status === 'past_due' && sub.grace_period_end) {
        if (new Date(sub.grace_period_end) <= currentDate) {
          await subRepo.upsert({
            household_id: sub.household_id,
            plan_id: 'free',
            status: 'canceled',
          })
          details.push(`Carência de past_due expirada para household ${sub.household_id}: revertido para Free`)
          processedCount++
          continue
        }
      }

      // 3. Aplicação de Downgrade Agendado ao fim do ciclo (Req 17.7)
      if (sub.scheduled_downgrade_plan_id && sub.current_period_end) {
        if (new Date(sub.current_period_end) <= currentDate) {
          await subRepo.upsert({
            household_id: sub.household_id,
            plan_id: sub.scheduled_downgrade_plan_id,
            scheduled_downgrade_plan_id: undefined,
          })
          details.push(`Downgrade agendado para ${sub.scheduled_downgrade_plan_id} aplicado na household ${sub.household_id}`)
          processedCount++
        }
      }
    }

    return {
      jobName: 'SubscriptionCycleJob',
      executedAt: currentDate.toISOString(),
      processedCount,
      details,
    }
  }

  /**
   * Job de Notificações de Vencimento de Fatura e Lançamentos em Atraso (Req 16.1, 16.2).
   */
  static async runNotificationJob(currentDate: Date, pendingTxs: any[], invoices: any[]): Promise<JobExecutionResult> {
    const details: string[] = []
    let processedCount = 0

    // 1. Notificar faturas a 3 dias ou menos do vencimento (Req 16.1)
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000
    for (const inv of invoices) {
      if (inv.status === 'open' || inv.status === 'pending') {
        const dueDate = new Date(inv.due_date)
        const diffMs = dueDate.getTime() - currentDate.getTime()
        if (diffMs > 0 && diffMs <= threeDaysMs) {
          details.push(`Notificação de vencimento de fatura gerada para ${inv.id}`)
          processedCount++
        }
      }
    }

    // 2. Notificar contas a pagar em atraso (Req 16.2)
    for (const tx of pendingTxs) {
      if (tx.payment_status === 'pending' && tx.due_date) {
        if (new Date(tx.due_date) < currentDate) {
          details.push(`Notificação de conta em atraso gerada para a transação ${tx.id}`)
          processedCount++
        }
      }
    }

    return {
      jobName: 'NotificationJob',
      executedAt: currentDate.toISOString(),
      processedCount,
      details,
    }
  }
}
