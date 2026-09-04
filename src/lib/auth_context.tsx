// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTO DE AUTENTICAÇÃO E SESSÃO DE HOUSEHOLD ROBUSTO (GATE 2.1)
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { ServiceContext, MemberRole } from '../api/services/base.service'
import type { PlanId } from '../../packages/core/src/plans'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'

interface AuthState {
  status: AuthStatus
  session: Session | null
  user: User | null
  loading: boolean
  householdId: string | null
  userRole: MemberRole | null
  planId: PlanId
  serviceContext: ServiceContext | null
  errorMessage: string | null
  signOut: () => Promise<void>
  refreshHousehold: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  status: 'loading',
  session: null,
  user: null,
  loading: true,
  householdId: null,
  userRole: null,
  planId: 'free',
  serviceContext: null,
  errorMessage: null,
  signOut: async () => {},
  refreshHousehold: async () => {},
})

// Cobre a corrida entre o signup e o trigger handle_new_user() (cria o household em segundo plano).
const HOUSEHOLD_RETRY_DELAYS_MS = [600, 1500]

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<MemberRole | null>(null)
  const [planId, setPlanId] = useState<PlanId>('free')
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Descarta respostas de fetches antigos se o usuário trocar de sessão no meio do caminho.
  const fetchTokenRef = useRef(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionChange(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionChange(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSessionChange = (session: Session | null) => {
    setSession(session)
    setUser(session?.user ?? null)

    if (session?.user) {
      fetchHouseholdForUser(session.user.id)
    } else {
      fetchTokenRef.current++
      setHouseholdId(null)
      setUserRole(null)
      setErrorMessage(null)
      setStatus('unauthenticated')
    }
  }

  const fetchHouseholdForUser = async (userId: string, attempt = 0) => {
    const token = attempt === 0 ? ++fetchTokenRef.current : fetchTokenRef.current

    try {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, role')
        .eq('profile_id', userId)
        .limit(1)
        .maybeSingle()

      if (token !== fetchTokenRef.current) return // sessão mudou enquanto aguardávamos a resposta

      if (error) throw error

      if (data) {
        setHouseholdId(data.household_id)
        setUserRole(data.role as MemberRole)
        setErrorMessage(null)
        setStatus('authenticated')

        const { data: subData } = await supabase
          .from('subscriptions')
          .select('plan_id')
          .eq('household_id', data.household_id)
          .maybeSingle()

        if (subData?.plan_id) {
          setPlanId(subData.plan_id as PlanId)
        }
        return
      }

      if (attempt < HOUSEHOLD_RETRY_DELAYS_MS.length) {
        await esperar(HOUSEHOLD_RETRY_DELAYS_MS[attempt])
        if (token !== fetchTokenRef.current) return
        await fetchHouseholdForUser(userId, attempt + 1)
        return
      }

      setHouseholdId(null)
      setUserRole(null)
      setErrorMessage('Não encontramos uma household vinculada a esta conta. Tente novamente em instantes.')
      setStatus('error')
    } catch (e) {
      if (token !== fetchTokenRef.current) return
      console.error('Erro ao carregar household do usuário:', e)
      setHouseholdId(null)
      setUserRole(null)
      setErrorMessage('Não foi possível carregar os dados da sua conta. Verifique sua conexão e tente novamente.')
      setStatus('error')
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    fetchTokenRef.current++
    setSession(null)
    setUser(null)
    setHouseholdId(null)
    setUserRole(null)
    setErrorMessage(null)
    setStatus('unauthenticated')
  }

  const refreshHousehold = async () => {
    if (user) {
      setStatus('loading')
      fetchTokenRef.current++
      await fetchHouseholdForUser(user.id)
    }
  }

  const serviceContext: ServiceContext | null =
    user && householdId
      ? {
          userId: user.id,
          householdId,
          userRole: userRole ?? 'member',
          planId,
        }
      : null

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        user,
        loading: status === 'loading',
        householdId,
        userRole,
        planId,
        serviceContext,
        errorMessage,
        signOut,
        refreshHousehold,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
