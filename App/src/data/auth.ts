// ─────────────────────────────────────────────────────────────────────────────
// AUTENTICAÇÃO E CAMADA DE INTEGRAÇÃO SUPABASE AUTH (AUTH-001)
// ─────────────────────────────────────────────────────────────────────────────

import { detectUnlinkedSession, validatePassword, PasswordValidationResult } from '../../packages/core/src/auth'

export interface AuthState {
  userId: string | null
  email: string | null
  householdId: string | null
  isUnlinkedSession: boolean
  unlinkedErrorMessage?: string
}

/**
  * Valida a integridade da sessão do usuário recuperada do Supabase Auth.
  * Se o perfil não for encontrado no banco de dados, sinaliza sessão não vinculada (unlinked).
  */
export function processUserSession(
  authenticatedEmail: string | null | undefined,
  profileData: { id: string; email: string } | null | undefined,
): { isUnlinked: boolean; message?: string } {
  return detectUnlinkedSession(authenticatedEmail, profileData)
}

export { validatePassword }
export type { PasswordValidationResult }
