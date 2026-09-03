// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO JOB SCHEDULER (JOB-001)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import type { SubscriptionRecord, SubscriptionRepository } from '../billing/billing_service.ts'
import { JobScheduler } from './job_scheduler.ts'

export async function runJobSchedulerTests(): Promise<void> {
  const currentDate = new Date('2026-09-15T12:00:00Z')

  // Teste 1: Job de Fechamento de Faturas (InvoiceCloseJob)
  const mockCards = [
    { id: 'card-1', name: 'Cartão Visa', closing_day: 15 }, // Fechamento HOJE
    { id: 'card-2', name: 'Cartão Master', closing_day: 20 },
  ]
  const invoiceRes = await JobScheduler.runInvoiceCloseJob(currentDate, mockCards)
  assert.equal(invoiceRes.processedCount, 1)
  assert.equal(invoiceRes.details?.length, 1)

  // Teste 2: Job de Expiração de Trial e Carência (SubscriptionCycleJob)
  const mockSubs: SubscriptionRecord[] = [
    {
      id: 'sub-trial-exp',
      household_id: 'h-trial',
      plan_id: 'pro',
      status: 'trialing',
      current_period_start: '2026-09-01T00:00:00Z',
      current_period_end: '2026-09-14T00:00:00Z',
      trial_end: '2026-09-14T00:00:00Z', // Expirado em 14/09
      created_at: '2026-09-01T00:00:00Z',
    },
    {
      id: 'sub-active',
      household_id: 'h-active',
      plan_id: 'pro',
      status: 'active',
      current_period_start: '2026-09-01T00:00:00Z',
      current_period_end: '2026-09-30T00:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
    },
  ]

  const updatedSubs = new Map<string, any>()
  const mockSubRepo: SubscriptionRepository = {
    getByHousehold: async (hId) => mockSubs.find((s) => s.household_id === hId) || null,
    upsert: async (sub) => {
      updatedSubs.set(sub.household_id, sub)
      return sub as any
    },
    hasEvent: async () => false,
    recordEvent: async () => {},
  }

  const cycleRes = await JobScheduler.runSubscriptionCycleJob(currentDate, mockSubs, mockSubRepo)
  assert.equal(cycleRes.processedCount, 1)
  assert.equal(updatedSubs.get('h-trial')?.plan_id, 'free')

  // Teste 3: Job de Notificações Automáticas (NotificationJob)
  const mockInvoices = [
    { id: 'inv-1', due_date: '2026-09-17T00:00:00Z', status: 'pending' }, // Vence em 2 dias (<= 3 dias) -> Notificar
    { id: 'inv-2', due_date: '2026-09-28T00:00:00Z', status: 'pending' },
  ]
  const mockPendingTxs = [
    { id: 'tx-late', due_date: '2026-09-10T00:00:00Z', payment_status: 'pending' }, // Em atraso -> Notificar
  ]

  const notifRes = await JobScheduler.runNotificationJob(currentDate, mockPendingTxs, mockInvoices)
  assert.equal(notifRes.processedCount, 2)

  console.log('  ok — JOB-001: JobScheduler passou em todos os 3 testes de automação (fechamento de fatura, reversão de trial expirado e notificações de vencimento/atraso)')
}
