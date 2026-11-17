import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

/** Рядок public.profiles (міграції Ролі 3). */
export interface Profile {
  id: string
  display_name: string | null
  email_alerts: boolean
  telegram_alerts: boolean
  created_at: string
  updated_at: string
  /** VIP активний до цієї дати. Колонку додає Роль 3; поки її немає — undefined (безкоштовний тариф). */
  vip_until?: string | null
}

export interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  /** true, поки не прочитали збережену сесію (і не обробили токени з URL). */
  loading: boolean
  /** Ім'я для аватара/привітання: profiles → метадані → частина email. */
  displayName: string
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() потрібно викликати всередині <AuthProvider>')
  return ctx
}

export function displayNameOf(user: User | null, profile: Profile | null): string {
  if (!user) return ''
  const meta = user.user_metadata as { display_name?: string; full_name?: string; name?: string }
  return (
    profile?.display_name || meta.display_name || meta.full_name || meta.name || user.email?.split('@')[0] || ''
  )
}
