// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DE BILLING E SCHEDULED JOBS (BILL-002 / JOB-001)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runBillingServiceTests } from './billing_service.pure.ts'
import { runJobSchedulerTests } from '../jobs/job_scheduler.pure.ts'

describe('Billing & Scheduled Jobs (BILL-002 / JOB-001)', () => {
  it('executa os 5 testes do BillingService com sucesso', async () => {
    await runBillingServiceTests()
  })

  it('executa os 3 testes do JobScheduler com sucesso', async () => {
    await runJobSchedulerTests()
  })
})
