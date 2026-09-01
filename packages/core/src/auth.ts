// ─────────────────────────────────────────────────────────────────────────────
// REGRA PURA DE DOMÍNIO: AUTENTICAÇÃO, SENHAS E TRATAMENTO DE SESSÃO
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_INACTIVITY_MAX_HOURS = 24
export const PASSWORD_RESET_EXPIRATION_MINUTES = 60
export const RATE_LIMIT_MAX_ATTEMPTS = 5
export const RATE_LIMIT_WINDOW_MINUTES = 15

export interface PasswordValidationResult {
  valid: boolean
  reason?: string
}

/**
  * Valida se a senha cumpre os requisitos do sistema (Req 1.3):
  * Mínimo de 8 caracteres, contendo ao menos 1 letra e 1 dígito.
  */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || password.length < 8) {
    return { valid: false, reason: 'A senha deve conter no mínimo 8 caracteres.' }
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos uma letra.' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos um número.' }
  }
  return { valid: true }
}

export interface UnlinkedSessionCheck {
  isUnlinked: boolean
  message?: string
}

/**
  * Detecta se existe uma sessão autenticada cujo perfil do banco de dados retornou vazio.
  * Ocorre em casos onde o login via OAuth Google utilizou um e-mail já existente sem o
  * Automatic Linking ativo, evitando que a UI renderize um "usuário fantasma" sem household.
  */
export function detectUnlinkedSession(
  authenticatedUserEmail: string | null | undefined,
  profile: unknown | null | undefined,
): UnlinkedSessionCheck {
  if (authenticatedUserEmail && (!profile || (typeof profile === 'object' && Object.keys(profile).length === 0))) {
    return {
      isUnlinked: true,
      message:
        'Sua conta Google utiliza um e-mail já cadastrado via Senha. Por favor, faça login utilizando E-mail e Senha para acessar sua conta.',
    }
  }
  return { isUnlinked: false }
}
