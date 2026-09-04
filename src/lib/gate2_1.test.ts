// ─────────────────────────────────────────────────────────────────────────────
// VITEST WRAPPER PARA OS TESTES DO GATE 2.1
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { runGate2_1Tests } from './gate2_1.pure.ts'

describe('GATE 2.1 — Hardening & Idempotência', () => {
  it('executa os 3 testes de idempotência e contexto de segurança com sucesso', async () => {
    await runGate2_1Tests()
  })
})
