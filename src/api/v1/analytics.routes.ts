// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS REST ROUTES /v1/analytics/dashboard (API-002J)
// ─────────────────────────────────────────────────────────────────────────────

import { AnalyticsService } from '../services/analytics.service.ts'
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

export class AnalyticsController {
  private readonly service: AnalyticsService

  constructor(service: AnalyticsService) {
    this.service = service
  }

  /**
   * Router simples para /v1/analytics/dashboard.
   */
  async handle(req: ApiRequest): Promise<ApiResponse> {
    try {
      const { method, query, context } = req

      // GET /v1/analytics/dashboard
      if (method === 'GET') {
        const month = query?.month
        const summary = await this.service.getDashboardSummary(context.householdId, { month })
        return { status: 200, body: { data: summary } }
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
      if (err.name === 'ValidationError') status = 422

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
