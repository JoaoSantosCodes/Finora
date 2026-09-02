// ─────────────────────────────────────────────────────────────────────────────
// BASE APPLICATION SERVICE & CONTEXT DEFINITIONS (API-002)
// ─────────────────────────────────────────────────────────────────────────────

import type { Client } from 'pg'
import { PermissionDeniedError } from '../errors.ts'
import type { PlanId } from '../../../packages/core/src/plans.ts'

export type MemberRole = 'owner' | 'admin' | 'member'

export interface ServiceContext {
  userId: string
  householdId: string
  /** Papel do usuário no household (obtido via sessão/membership). */
  userRole?: MemberRole
  /** Plano ativo da assinatura do household (default: 'free'). */
  planId?: PlanId
  /** Cliente do Postgres (opcional, para injeção em testes/transações). */
  dbClient?: Client
}

/**
  Validação secundária de membership (fail-closed) no Application Service.
  Garante que a operação ocorra com um usuário válido e membro autenticado.
 */
export async function assertHouseholdMembership(
  client: Client,
  householdId: string,
  userId: string
): Promise<{ isMember: boolean; role: MemberRole }> {
  if (!householdId || !userId) {
    throw new PermissionDeniedError('Contexto inválido: householdId e userId são obrigatórios.')
  }

  const res = await client.query<{ role: MemberRole }>(
    `select role from public.household_members where household_id = $1 and profile_id = $2`,
    [householdId, userId]
  )

  if (res.rows.length === 0) {
    throw new PermissionDeniedError(`Acesso negado: o usuário não é membro do household ${householdId}.`)
  }

  return { isMember: true, role: res.rows[0].role }
}

/**
  Valida se o papel do usuário possui privilégios de administração (Owner ou Admin).
 */
export function assertAdminOrOwnerRole(role?: MemberRole): void {
  if (role !== 'owner' && role !== 'admin') {
    throw new PermissionDeniedError('Operação restrita a administradores ou ao proprietário do household.')
  }
}
