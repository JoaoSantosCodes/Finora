// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTO DE AUTENTICAÇÃO E SESSÃO DE HOUSEHOLD ROBUSTO (GATE 2.1)
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { ServiceContext, MemberRole } from '../api/services/base.service'
import type { PlanId } from '../../packages/core/src/plans'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  session: Session | null
  user: User | null
  loading: boolean
  householdId: string | null
  userRole: MemberRole | null
  planId: PlanId
  serviceContext: ServiceContext | null
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
  signOut: async () => {},
  refreshHousehold: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>('demo-household-id')
  const [userRole, setUserRole] = useState<MemberRole | null>('owner')
  const [planId, setPlanId] = useState<PlanId>('free')
  const [status, setStatus] = useState<AuthStatus>('loading')

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
      setStatus('unauthenticated')
    }
  }

  const fetchHouseholdForUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, role')
        .eq('profile_id', userId)
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        setHouseholdId(data.household_id)
        setUserRole(data.role as MemberRole)
        setStatus('authenticated')

        const { data: subData } = await supabase
          .from('subscriptions')
          .select('plan_id')
          .eq('household_id', data.household_id)
          .maybeSingle()

        if (subData?.plan_id) {
          setPlanId(subData.plan_id as PlanId)
        }
      } else {
        // Fallback gracioso para ambiente local/demo
        setHouseholdId('demo-household-id')
        setUserRole('owner')
        setStatus('authenticated')
      }
    } catch (e) {
      console.warn('Usando contexto fallback local:', e)
      setHouseholdId('demo-household-id')
      setUserRole('owner')
      setStatus('authenticated')
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setHouseholdId(null)
    setUserRole(null)
    setStatus('unauthenticated')
  }

  const refreshHousehold = async () => {
    if (user) {
      await fetchHouseholdForUser(user.id)
    }
  }

  const serviceContext: ServiceContext | null = {
    userId: user?.id || 'demo-user-id',
    householdId: householdId || 'demo-household-id',
    userRole: userRole || 'owner',
    planId: planId || 'free',
  }

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
