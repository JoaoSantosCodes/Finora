// ─────────────────────────────────────────────────────────────────────────────
// INSTALLMENTS REST ROUTES /v1/installment-plans (API-002D)
// ─────────────────────────────────────────────────────────────────────────────

import { InstallmentService } from '../services/installment.service.ts'
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

export class InstallmentsController {
  private readonly service: InstallmentService

  constructor(service: InstallmentService) {
    this.service = service
  }

  /**
   * Router simples para /v1/installment-plans.
   */
  async handle(req: ApiRequest): Promise<ApiResponse> {
    try {
      const { method, body, context } = req

      // POST /v1/installment-plans
      if (method === 'POST') {
        const result = await this.service.createInstallmentPlan({
          householdId: context.householdId,
          ...body,
        })
        return { status: 201, body: { data: result } }
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
      if (err.name === 'PlanLimitExceededError') status = 402 // Upgrade Needed
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
