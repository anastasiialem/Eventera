import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, displayNameOf, type AuthState, type Profile } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { FRESH_QUERY } from '../lib/fresh-query'

/**
 * Стан авторизації для всього застосунку.
 * Без налаштованого Supabase: { user: null, loading: false } — сайт працює як гість.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    // getSession чекає, поки supabase-js обробить токени/код з URL (колбек, скидання пароля)
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setLoading(false)
    })
    // Увага: всередині колбеку не можна await-ити інші виклики supabase (дедлок у supabase-js)
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const user = session?.user ?? null
  const userId = user?.id

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(supabase && userId),
    ...FRESH_QUERY,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase!.from('profiles').select('*').eq('id', userId!).maybeSingle()
      if (error) throw error
      return data as Profile | null
    },
  })
  const profile = userId ? (profileQuery.data ?? null) : null
  const { refetch } = profileQuery

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    queryClient.removeQueries({ queryKey: ['profile'] })
    queryClient.removeQueries({ queryKey: ['subscriptions'] })
  }, [queryClient])

  const refreshProfile = useCallback(async () => {
    await refetch()
  }, [refetch])

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      profile,
      loading,
      displayName: displayNameOf(user, profile),
      signOut,
      refreshProfile,
    }),
    [user, session, profile, loading, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
