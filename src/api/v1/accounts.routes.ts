// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS REST ROUTES /v1/accounts (API-002A)
// ─────────────────────────────────────────────────────────────────────────────

import { AccountService } from '../services/account.service.ts'
import { DomainError } from '../errors.ts'

export interface ServiceContext {
  userId: string
  householdId: string
  userJwtToken: string
}

export interface ApiRequest {
  method: string
  url: string
  params?: Record<string, string>
  query?: Record<string, string>
  body?: any
  context: ServiceContext
}

export interface ApiResponse {
  status: number
  body: any
}

export class AccountsController {
  private readonly service: AccountService

  constructor(service: AccountService) {
    this.service = service
  }

  /**
   * Router simples para /v1/accounts e sub-rotas.
   */
  async handle(req: ApiRequest): Promise<ApiResponse> {
    try {
      const { method, params, query, body, context } = req

      // GET /v1/accounts
      if (method === 'GET' && !params?.id) {
        const includeArchived = query?.includeArchived === 'true'
        const accounts = await this.service.listAccounts(context.householdId, includeArchived)
        return { status: 200, body: { data: accounts } }
      }

      // GET /v1/accounts/:id
      if (method === 'GET' && params?.id) {
        const account = await this.service.getAccountWithBalance(params.id)
        return { status: 200, body: { data: account } }
      }

      // POST /v1/accounts
      if (method === 'POST' && !params?.id) {
        const account = await this.service.createAccount({
          householdId: context.householdId,
          ...body,
        })
        return { status: 201, body: { data: account } }
      }

      // PATCH /v1/accounts/:id
      if (method === 'PATCH' && params?.id) {
        const account = await this.service.updateAccount(params.id, body)
        return { status: 200, body: { data: account } }
      }

      // POST /v1/accounts/:id/archive
      if (method === 'POST' && params?.id && params.action === 'archive') {
        await this.service.archiveAccount(params.id)
        return { status: 200, body: { success: true } }
      }

      // DELETE /v1/accounts/:id
      if (method === 'DELETE' && params?.id) {
        await this.service.deleteAccount(params.id)
        return { status: 204, body: null }
      }

      return { status: 404, body: { error: 'Rota não encontrada' } }
    } catch (err: any) {
      return this.formatErrorResponse(err)
    }
  }

  private formatErrorResponse(err: any): ApiResponse {
    if (err instanceof DomainError) {
      let status = 400
      if (err.name === 'PermissionDeniedError') status = 403
      if (err.name === 'NotFoundError') status = 404
      if (err.name === 'PlanLimitExceededError') status = 402 // Payment Required / Upgrade needed
      if (err.name === 'AccountHasTransactionsError') status = 409 // Conflict

      return {
        status,
        body: {
          error: err.name,
          message: err.message,
          ...(err as any),
        },
      }
    }

    return {
      status: 500,
      body: {
        error: 'InternalServerError',
        message: err?.message || 'Erro interno no servidor.',
      },
    }
  }
}
