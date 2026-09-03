// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES REST ROUTES /v1/categories (API-002F)
// ─────────────────────────────────────────────────────────────────────────────

import { CategoryService } from '../services/category.service.ts'
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

export class CategoriesController {
  private readonly service: CategoryService

  constructor(service: CategoryService) {
    this.service = service
  }

  /**
   * Router simples para /v1/categories.
   */
  async handle(req: ApiRequest): Promise<ApiResponse> {
    try {
      const { method, params, body, context } = req

      // GET /v1/categories
      if (method === 'GET' && !params?.id) {
        const categories = await this.service.listCategories(context.householdId)
        return { status: 200, body: { data: categories } }
      }

      // GET /v1/categories/:id
      if (method === 'GET' && params?.id) {
        const category = await this.service.getCategoryById(params.id)
        return { status: 200, body: { data: category } }
      }

      // POST /v1/categories
      if (method === 'POST' && !params?.id) {
        const category = await this.service.createCategory({
          householdId: context.householdId,
          ...body,
        })
        return { status: 201, body: { data: category } }
      }

      // PATCH /v1/categories/:id
      if (method === 'PATCH' && params?.id) {
        const category = await this.service.updateCategory(params.id, body)
        return { status: 200, body: { data: category } }
      }

      // DELETE /v1/categories/:id
      if (method === 'DELETE' && params?.id) {
        const replacementId = body?.replacementCategoryId || req.query?.replacementCategoryId
        await this.service.deleteCategory(params.id, replacementId)
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
