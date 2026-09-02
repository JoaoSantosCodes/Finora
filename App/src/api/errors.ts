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
  constructor(message: string, public readonly originalError?: unknown) {
    super(message)
  }
}
