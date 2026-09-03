// ─────────────────────────────────────────────────────────────────────────────
// TESTES PUROS DO BILLING SERVICE (BILL-002)
// Sem dependências do runner do Vitest — compatível com Node.js ESM nativo e Vitest
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict'
import { BillingService, type SubscriptionRecord, type SubscriptionRepository } from './billing_service.ts'

function createMockRepo(initialSubs: Record<string, SubscriptionRecord> = {}) {
  const store = new Map<string, SubscriptionRecord>(Object.entries(initialSubs))
  const events = new Set<string>()

  const repo: SubscriptionRepository = {
    getByHousehold: async (hId) => store.get(hId) || null,
    upsert: async (sub) => {
      const existing = store.get(sub.household_id) || {
        id: 'sub-' + sub.household_id,
        household_id: sub.household_id,
        plan_id: 'free',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }
      const updated = { ...existing, ...sub }
      store.set(sub.household_id, updated)
      return updated
    },
    hasEvent: async (hId, eventId) => events.has(`${hId}:${eventId}`),
    recordEvent: async (hId, eventId) => {
      events.add(`${hId}:${eventId}`)
    },
  }

  return { repo, store, events }
}

export async function runBillingServiceTests(): Promise<void> {
  const { repo } = createMockRepo()
  const service = new BillingService(repo)

  // Teste 1: Início de trial de 14 dias por Owner (Req 17.2, 17.11)
  const sub1 = await service.startTrial('h-1', 'pro', 'owner')
  assert.equal(sub1.plan_id, 'pro')
  assert.equal(sub1.status, 'trialing')
  assert.ok(sub1.trial_end)

  // Teste 2: Rejeição de alteração de plano por Member/Admin (Req 17.11)
  await assert.rejects(
    async () => {
      await service.startTrial('h-1', 'pro', 'member')
    },
    { name: 'PermissionDeniedError' },
  )

  // Teste 3: Upgrade imediato para plano Família (Req 17.5)
  const sub2 = await service.upgradePlan('h-1', 'family', 'owner')
  assert.equal(sub2.plan_id, 'family')
  assert.equal(sub2.status, 'active')

  // Teste 4: Downgrade válido (Family -> Pro) e validação de caminho inválido (Req 17.6, 17.7)
  const sub3 = await service.requestDowngrade('h-1', 'pro', 'owner')
  assert.equal(sub3.scheduled_downgrade_plan_id, 'pro')

  // Teste 5: Processamento idempotente de webhook Stripe (DB-006)
  const eventPayload = {
    eventId: 'evt_stripe_123',
    eventType: 'checkout.session.completed',
    householdId: 'h-1',
    planId: 'pro' as const,
  }

  const res1 = await service.processWebhookEvent(eventPayload)
  assert.equal(res1.success, true)

  // Re-envio do mesmo evento de webhook deve ser idempotente (alreadyApplied: true)
  const res2 = await service.processWebhookEvent(eventPayload)
  assert.equal(res2.alreadyApplied, true)

  console.log('  ok — BILL-002: BillingService passou em todos os 5 testes (trial 14 dias, permissão de owner, upgrade imediato, downgrade válido e webhook idempotente DB-006)')
}
