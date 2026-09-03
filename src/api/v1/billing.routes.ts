// ─────────────────────────────────────────────────────────────────────────────
// BILLING REST ROUTES /v1/billing/* (BILL-002)
// Controller REST backend para webhooks Stripe e gestão de assinaturas
// ─────────────────────────────────────────────────────────────────────────────

import { BillingService } from '../billing/billing_service.ts'
import { DomainError } from '../errors.ts'

export interface ServiceContext {
  userId: string
  householdId: string
  role: 'owner' | 'admin' | 'member'
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

export class BillingController {
  private readonly service: BillingService

  constructor(service: BillingService) {
    this.service = service
  }

  async handle(req: ApiRequest): Promise<ApiResponse> {
    try {
      const { method, url, body, context } = req

      // POST /v1/billing/webhook
      if (method === 'POST' && url.endsWith('/webhook')) {
        const res = await this.service.processWebhookEvent(body)
        return { status: 200, body: res }
      }

      // POST /v1/billing/trial
      if (method === 'POST' && url.endsWith('/trial')) {
        const sub = await this.service.startTrial(context.householdId, body.planId, context.role)
        return { status: 200, body: { data: sub } }
      }

      // POST /v1/billing/upgrade
      if (method === 'POST' && url.endsWith('/upgrade')) {
        const sub = await this.service.upgradePlan(context.householdId, body.planId, context.role)
        return { status: 200, body: { data: sub } }
      }

      // POST /v1/billing/downgrade
      if (method === 'POST' && url.endsWith('/downgrade')) {
        const sub = await this.service.requestDowngrade(context.householdId, body.targetPlanId, context.role)
        return { status: 200, body: { data: sub } }
      }

      // POST /v1/billing/cancel
      if (method === 'POST' && url.endsWith('/cancel')) {
        const sub = await this.service.cancelSubscription(context.householdId, context.role)
        return { status: 200, body: { data: sub } }
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
