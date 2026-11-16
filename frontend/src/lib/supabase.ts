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

/** URL колбеку після підтвердження email / Google. `next` — куди повернути після входу. */
export function callbackUrl(next?: string): string {
  const base = `${window.location.origin}/auth/callback`
  return next ? `${base}?next=${encodeURIComponent(next)}` : base
}

/**
 * Реєстрація. Ім'я кладемо в raw_user_meta_data.display_name — саме це поле
 * читає тригер handle_new_user() Ролі 3 і записує в profiles.display_name.
 * `name` дублюємо для сумісності (так його називають Google та інші провайдери).
 */
export async function signUp(email: string, password: string, name: string, next?: string) {
  const trimmed = name.trim() || undefined
  return requireSupabase().auth.signUp({
    email,
    password,
    options: {
      data: { display_name: trimmed, name: trimmed },
      emailRedirectTo: callbackUrl(next),
    },
  })
}

/** Повторно надіслати лист підтвердження реєстрації. */
export async function resendSignupEmail(email: string, next?: string) {
  return requireSupabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: callbackUrl(next) } })
}

export async function signIn(email: string, password: string) {
  return requireSupabase().auth.signInWithPassword({ email, password })
}

export async function signInWithGoogle(next?: string) {
  return requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl(next) },
  })
}

/** Лист із посиланням на /auth/reset, де користувач задає новий пароль. */
export async function sendPasswordReset(email: string) {
  return requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset`,
  })
}

export async function updatePassword(password: string) {
  return requireSupabase().auth.updateUser({ password })
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
