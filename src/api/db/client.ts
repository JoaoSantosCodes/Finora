// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE DE BANCO DE DADOS SOB SESSÃO JWT DO USUÁRIO (API-001)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
  * Instancia o cliente Supabase associado estritamente à sessão JWT do usuário.
  * O PostgREST do Supabase repassa o token Authorization: Bearer <userJwtToken>
  * para o PostgreSQL, populando auth.uid() nativamente em cada instrução RLS.
  *
  * Nenhum repositório financeiro utiliza service_role ou GUCs SET LOCAL em produção.
  */
export function createDbClient(
  userJwtToken: string,
  supabaseUrl?: string,
  supabaseAnonKey?: string,
): SupabaseClient {
  const url =
    supabaseUrl ||
    (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL : undefined) ||
    'https://placeholder.supabase.co'

  const key =
    supabaseAnonKey ||
    (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY : undefined) ||
    'placeholder-anon-key'

  return createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwtToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
