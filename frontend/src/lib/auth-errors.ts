/** Тексти помилок Supabase Auth українською. */

const NETWORK = 'Немає з’єднання з мережею. Перевір інтернет і спробуй ще раз.'

interface AuthLikeError {
  code?: string
  message?: string
  name?: string
  status?: number
  /** AuthWeakPasswordError (supabase-js): 'length' | 'characters' | 'pwned' */
  reasons?: unknown
  /** сира відповідь Auth API: { weak_password: { reasons: [...] } } */
  weak_password?: { reasons?: unknown }
}

export const MIN_PASSWORD = 8

/** Постійна підказка під полем пароля (вимоги, які знаємо заздалегідь). */
export const PASSWORD_HINT = `Мінімум ${MIN_PASSWORD} символів`

/** «Додай великі й малі літери та цифру» — з набору символів у повідомленні Supabase. */
function charactersMessage(msg: string): string {
  // «Password should contain at least one character of each: abc…xyz, ABC…XYZ, 0123456789, !@#…»
  const sets = msg.split(/each:/i)[1]
  if (!sets) return 'Додай великі й малі літери, цифру або символ.'
  const lower = /[a-z]{3,}/.test(sets)
  const upper = /[A-Z]{3,}/.test(sets)
  const digit = /[0-9]{3,}/.test(sets)
  const symbol = /[!@#$%^&*]/.test(sets)
  const parts: string[] = []
  if (lower && upper) parts.push('великі й малі літери')
  else if (lower) parts.push('малі літери')
  else if (upper) parts.push('великі літери')
  if (digit) parts.push('цифру')
  if (symbol) parts.push('символ (напр. ! або #)')
  if (!parts.length) return 'Додай великі й малі літери, цифру або символ.'
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} і ${parts[parts.length - 1]}`
  return `Додай ${list}.`
}

/**
 * Помилка, що стосується самого пароля (weak_password, same_password) → текст під полем пароля.
 * Для інших помилок — null.
 */
export function passwordErrorMessage(err: unknown): string | null {
  const e = (err ?? {}) as AuthLikeError
  const code = e.code ?? ''
  const rawMsg = e.message ?? ''
  const msg = rawMsg.toLowerCase()

  if (code === 'same_password' || msg.includes('should be different from the old'))
    return 'Новий пароль має відрізнятися від старого.'

  const isWeak =
    code === 'weak_password' ||
    e.name === 'AuthWeakPasswordError' ||
    msg.includes('password should') ||
    msg.includes('known to be weak')
  if (!isWeak) return null

  const raw = Array.isArray(e.reasons) ? e.reasons : Array.isArray(e.weak_password?.reasons) ? e.weak_password.reasons : []
  const reasons = new Set(raw.filter((r): r is string => typeof r === 'string'))
  // reasons немає (старий клієнт / URL-помилка) — визначаємо з тексту
  if (!reasons.size) {
    if (/at least \d+ characters/.test(msg)) reasons.add('length')
    if (msg.includes('character of each')) reasons.add('characters')
    if (msg.includes('known to be weak') || msg.includes('pwned') || msg.includes('leaked')) reasons.add('pwned')
  }

  const out: string[] = []
  if (reasons.has('length')) {
    const n = Number(msg.match(/at least (\d+) characters/)?.[1]) || MIN_PASSWORD
    out.push(`Мінімум ${n} символів.`)
  }
  if (reasons.has('characters')) out.push(charactersMessage(rawMsg))
  if (reasons.has('pwned')) out.push('Цей пароль є в базах зламаних паролів — придумай інший.')
  return out.length ? out.join(' ') : 'Пароль занадто простий — спробуй довший із цифрами.'
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

  const passwordMsg = passwordErrorMessage(err)
  if (passwordMsg) return passwordMsg

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

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}
