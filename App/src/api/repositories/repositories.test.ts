// ─────────────────────────────────────────────────────────────────────────────
// TESTES DE INTEGRAÇÃO DOS REPOSITÓRIOS DA API (API-001)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest'
import { PermissionDeniedError, NotFoundError } from '../errors'
import { AccountRepository } from './account.repository'
import { CategoryRepository } from './category.repository'
import { TransactionRepository } from './transaction.repository'
import { CreditCardRepository } from './credit_card.repository'

describe('API Repositories & Error Handling', () => {
  describe('AccountRepository', () => {
    it('instancia corretamente', () => {
      const repo = new AccountRepository({} as any)
      expect(repo).toBeDefined()
    })
  })

  describe('CategoryRepository', () => {
    it('instancia corretamente', () => {
      const repo = new CategoryRepository({} as any)
      expect(repo).toBeDefined()
    })
  })

  describe('TransactionRepository', () => {
    it('instancia corretamente', () => {
      const repo = new TransactionRepository({} as any)
      expect(repo).toBeDefined()
    })
  })

  describe('CreditCardRepository', () => {
    it('instancia corretamente', () => {
      const repo = new CreditCardRepository({} as any)
      expect(repo).toBeDefined()
    })
  })

  describe('Error Classes', () => {
    it('instancia PermissionDeniedError com mensagem padrão', () => {
      const err = new PermissionDeniedError()
      expect(err.name).toBe('PermissionDeniedError')
      expect(err.message).toContain('Operação negada')
    })

    it('instancia NotFoundError com mensagem padrão', () => {
      const err = new NotFoundError()
      expect(err.name).toBe('NotFoundError')
      expect(err.message).toBe('Recurso não encontrado.')
    })
  })
})
