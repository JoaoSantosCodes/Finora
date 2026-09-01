import { describe, expect, it } from 'vitest'
import { validatePassword, detectUnlinkedSession } from './auth'

describe('Auth Domain Rules', () => {
  describe('validatePassword()', () => {
    it('rejeita senhas com menos de 8 caracteres', () => {
      expect(validatePassword('Abc123').valid).toBe(false)
    })

    it('rejeita senhas sem letras', () => {
      expect(validatePassword('123456789').valid).toBe(false)
    })

    it('rejeita senhas sem números', () => {
      expect(validatePassword('Abcdefghij').valid).toBe(false)
    })

    it('aceita senhas válidas com 8+ caracteres, letra e número', () => {
      expect(validatePassword('Senha123').valid).toBe(true)
      expect(validatePassword('Minha$enha99!').valid).toBe(true)
    })
  })

  describe('detectUnlinkedSession()', () => {
    it('retorna false quando perfil existe e está vinculado', () => {
      const res = detectUnlinkedSession('user@test.com', { id: 'p1', email: 'user@test.com' })
      expect(res.isUnlinked).toBe(false)
    })

    it('detecta sessão não vinculada (usuário autenticado sem perfil no banco)', () => {
      const res = detectUnlinkedSession('user@test.com', null)
      expect(res.isUnlinked).toBe(true)
      expect(res.message).toContain('Sua conta Google utiliza um e-mail já cadastrado via Senha')
    })
  })
})
