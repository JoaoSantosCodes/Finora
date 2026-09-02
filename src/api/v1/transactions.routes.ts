// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS REST ROUTES /v1/transactions (API-002B)
// ─────────────────────────────────────────────────────────────────────────────

import { TransactionService } from '../services/transaction.service.ts'
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

export class TransactionsController {
  private readonly service: TransactionService

  constructor(service: TransactionService) {
    this.service = service
  }

  /**
   * Router simples para /v1/transactions e sub-rotas.
   */
  async handle(req: ApiRequest): Promise<ApiResponse> {
    try {
      const { method, params, query, body, context } = req

      // GET /v1/transactions
      if (method === 'GET' && !params?.id) {
        const filter = {
          startDate: query?.startDate,
          endDate: query?.endDate,
          accountId: query?.accountId,
          categoryId: query?.categoryId,
          paymentStatus: query?.paymentStatus as 'paid' | 'pending' | undefined,
        }
        const txs = await this.service.listTransactions(context.householdId, filter)
        return { status: 200, body: { data: txs } }
      }

      // GET /v1/transactions/:id
      if (method === 'GET' && params?.id) {
        const tx = await this.service.getTransactionById(params.id)
        return { status: 200, body: { data: tx } }
      }

      // POST /v1/transactions (type: 'income' | 'expense')
      if (method === 'POST' && !params?.id) {
        const type = body?.type || 'expense'
        let tx: any
        if (type === 'income') {
          tx = await this.service.createIncome({
            householdId: context.householdId,
            ...body,
          })
        } else {
          tx = await this.service.createExpense({
            householdId: context.householdId,
            ...body,
          })
        }
        return { status: 201, body: { data: tx } }
      }

      // PATCH /v1/transactions/:id
      if (method === 'PATCH' && params?.id) {
        const tx = await this.service.updateTransaction(params.id, body)
        return { status: 200, body: { data: tx } }
      }

      // DELETE /v1/transactions/:id
      if (method === 'DELETE' && params?.id) {
        await this.service.deleteTransaction(params.id)
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
      if (err.name === 'ValidationError') status = 422 // Unprocessable Entity

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
