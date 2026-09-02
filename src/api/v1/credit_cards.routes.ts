// ─────────────────────────────────────────────────────────────────────────────
// CREDIT CARDS REST ROUTES /v1/credit-cards (API-002E)
// ─────────────────────────────────────────────────────────────────────────────

import { CreditCardService } from '../services/credit_card.service.ts'
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

export class CreditCardsController {
  private readonly service: CreditCardService

  constructor(service: CreditCardService) {
    this.service = service
  }

  /**
   * Router simples para /v1/credit-cards e sub-rotas.
   */
  async handle(req: ApiRequest): Promise<ApiResponse> {
    try {
      const { method, params, body, context } = req

      // GET /v1/credit-cards
      if (method === 'GET' && !params?.id) {
        const cards = await this.service.listCreditCards(context.householdId)
        return { status: 200, body: { data: cards } }
      }

      // GET /v1/credit-cards/:id
      if (method === 'GET' && params?.id && !params?.action) {
        const card = await this.service.getCreditCardById(params.id)
        return { status: 200, body: { data: card } }
      }

      // GET /v1/credit-cards/:id/invoices/:cycle
      if (method === 'GET' && params?.id && params?.cycle) {
        const invoice = await this.service.getCardInvoice(params.id, params.cycle)
        return { status: 200, body: { data: invoice } }
      }

      // POST /v1/credit-cards
      if (method === 'POST' && !params?.id) {
        const card = await this.service.createCreditCard({
          householdId: context.householdId,
          ...body,
        })
        return { status: 201, body: { data: card } }
      }

      // PATCH /v1/credit-cards/:id
      if (method === 'PATCH' && params?.id) {
        const card = await this.service.updateCreditCard(params.id, body)
        return { status: 200, body: { data: card } }
      }

      // POST /v1/credit-cards/:id/invoices/:cycle/pay
      if (method === 'POST' && params?.id && params?.cycle && params?.action === 'pay') {
        const invoice = await this.service.payInvoice({
          cardId: params.id,
          cycle: params.cycle,
          paymentAccountId: body.paymentAccountId,
          amountCents: body.amountCents,
        })
        return { status: 200, body: { data: invoice } }
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
