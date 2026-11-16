import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Поточна сесія Supabase. `loading` — поки не прочитали збережену сесію.
 * Без налаштованого Supabase завжди { session: null, loading: false }.
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}

/** Ім'я для аватара: display_name з метаданих, інакше частина email до @. */
export function displayNameOf(session: Session | null): string {
  if (!session) return ''
  const meta = session.user.user_metadata as { display_name?: string; full_name?: string; name?: string }
  return meta.display_name || meta.full_name || meta.name || session.user.email?.split('@')[0] || ''
}
