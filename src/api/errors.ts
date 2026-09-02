// ─────────────────────────────────────────────────────────────────────────────
// CLASSES DE ERROS DE DOMÍNIO E REPOSITÓRIO (API-001)
// ─────────────────────────────────────────────────────────────────────────────

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class PermissionDeniedError extends DomainError {
  constructor(message = 'Operação negada por falta de permissão ou restrição de RLS.') {
    super(message)
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Recurso não encontrado.') {
    super(message)
  }
}

export class DatabaseError extends DomainError {
  readonly originalError?: unknown

  constructor(message: string, originalError?: unknown) {
    super(message)
    this.originalError = originalError
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Dados de entrada inválidos.') {
    super(message)
  }
}

export class PlanLimitExceededError extends DomainError {
  readonly resource: string
  readonly limit: number

  constructor(
    resource: string,
    limit: number,
    message = `Limite do plano atingido para o recurso "${resource}" (máximo: ${limit}). Upgrade necessário.`
  ) {
    super(message)
    this.resource = resource
    this.limit = limit
  }
}

export class AccountHasTransactionsError extends DomainError {
  constructor(message = 'Não é possível excluir conta com lançamentos associados. Arquive a conta em vez de excluí-la.') {
    super(message)
  }
}
