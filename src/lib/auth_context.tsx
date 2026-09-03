// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTO DE AUTENTICAÇÃO E SESSÃO DE HOUSEHOLD (GATE 2)
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { ServiceContext, MemberRole } from '../api/services/base.service'
import type { PlanId } from '../../packages/core/src/plans'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  householdId: string | null
  userRole: MemberRole | null
  planId: PlanId
  serviceContext: ServiceContext | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  householdId: null,
  userRole: null,
  planId: 'free',
  serviceContext: null,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>('demo-household-id')
  const [userRole, setUserRole] = useState<MemberRole | null>('owner')
  const [planId, setPlanId] = useState<PlanId>('free')
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    // Escuta mudanças de sessão no Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchHouseholdForUser(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchHouseholdForUser(session.user.id)
      } else {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchHouseholdForUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, role')
        .eq('profile_id', userId)
        .limit(1)
        .single()

      if (!error && data) {
        setHouseholdId(data.household_id)
        setUserRole(data.role as MemberRole)

        // Busca o plano ativo da Household em subscriptions
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('plan_id')
          .eq('household_id', data.household_id)
          .single()

        if (subData?.plan_id) {
          setPlanId(subData.plan_id as PlanId)
        }
      }
    } catch (e) {
      console.warn('Usando contexto fallback em ambiente local:', e)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setHouseholdId(null)
    setUserRole(null)
  }

  const serviceContext: ServiceContext | null = user
    ? {
        userId: user.id,
        householdId: householdId || 'demo-household-id',
        userRole: userRole || 'owner',
        planId,
      }
    : {
        userId: 'demo-user-id',
        householdId: householdId || 'demo-household-id',
        userRole: userRole || 'owner',
        planId: 'free',
      }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        householdId,
        userRole,
        planId,
        serviceContext,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
