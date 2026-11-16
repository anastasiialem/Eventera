import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** null, якщо Supabase не налаштовано — тоді сайт працює на моках. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null

export const isSupabaseConfigured = supabase !== null

function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase не налаштовано: задайте VITE_SUPABASE_URL і VITE_SUPABASE_ANON_KEY')
  return supabase
}

/**
 * Реєстрація. Ім'я йде в raw_user_meta_data.display_name — саме це поле
 * читає тригер handle_new_user() Ролі 3 і записує в profiles.display_name.
 */
export async function signUp(email: string, password: string, name: string) {
  return requireSupabase().auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name.trim() || undefined },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}

export async function signIn(email: string, password: string) {
  return requireSupabase().auth.signInWithPassword({ email, password })
}

export async function signInWithGoogle() {
  return requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export async function signOut() {
  return requireSupabase().auth.signOut()
}

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function getUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
