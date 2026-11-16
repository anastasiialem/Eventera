/** Тексти помилок Supabase Auth українською. */

const NETWORK = 'Немає з’єднання з мережею. Перевір інтернет і спробуй ще раз.'

interface AuthLikeError {
  code?: string
  message?: string
  name?: string
  status?: number
}

export function authErrorMessage(err: unknown): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return NETWORK

  const e = (err ?? {}) as AuthLikeError
  const code = e.code ?? ''
  const msg = (e.message ?? '').toLowerCase()

  if (
    e.name === 'AuthRetryableFetchError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  )
    return NETWORK

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials'))
    return 'Невірний email або пароль.'

  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered'))
    return 'Цей email уже зареєстровано. Спробуй увійти.'

  if (code.startsWith('over_') || e.status === 429 || msg.includes('rate limit') || msg.includes('for security purposes'))
    return 'Забагато спроб. Зачекай хвилину і спробуй ще раз.'

  if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
    return 'Спершу підтверди email — посилання в листі від нас.'

  if (code === 'weak_password' || msg.includes('password should be'))
    return 'Пароль надто простий. Потрібно щонайменше 8 символів.'

  if (code === 'same_password') return 'Новий пароль має відрізнятися від старого.'

  if (code === 'email_address_invalid' || msg.includes('unable to validate email') || msg.includes('invalid format'))
    return 'Перевір, чи правильно введено email.'

  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('invalid or has expired'))
    return 'Посилання застаріло або вже використане. Запроси нове.'

  if (code === 'provider_disabled' || msg.includes('provider is not enabled'))
    return 'Вхід через Google поки не налаштовано.'

  if (code === 'signup_disabled') return 'Реєстрацію тимчасово вимкнено.'

  return 'Щось пішло не так. Спробуй ще раз.'
}

/** Помилка, яку Supabase кладе в URL редіректу (?error_description=… або #error_description=…). */
export function urlAuthError(): string | null {
  const read = (raw: string) => new URLSearchParams(raw.replace(/^[#?]/, ''))
  for (const p of [read(window.location.search), read(window.location.hash)]) {
    const code = p.get('error_code') ?? undefined
    const message = p.get('error_description') ?? p.get('error') ?? undefined
    if (code || message) return authErrorMessage({ code, message })
  }
  return null
}

/** Безпечний `next`: лише внутрішній шлях, інакше fallback. */
export function safeNext(raw: string | null | undefined, fallback = '/waitlist'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/auth')) return fallback
  return raw
}

export const MIN_PASSWORD = 8

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}
