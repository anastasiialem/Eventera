// VIP-підписка Eventera: 39 ₴/міс, оплата в окрему банку monobank «Eventera VIP», підтвердження вручну
// (infra/README.md → «Як підтвердити VIP»). Статус — profiles.vip_until (колонку додає Роль 3;
// поки її немає, profile.vip_until === undefined → усі на безкоштовному тарифі).

export const VIP_PRICE = 39
/** Скільки записів у «Я чекаю на…» на безкоштовному тарифі. */
export const FREE_LIMIT = 3
export const VIP_PAY_URL = import.meta.env.VITE_VIP_PAY_URL || null
export const VIP_NOTE = import.meta.env.VITE_VIP_NOTE?.trim() || 'Гроші з VIP-підписки йдуть на розвиток Eventera'
/** Варіанти «Ліміт ціни для сповіщень». */
export const VIP_PRICE_LIMITS = [300, 500, 1000] as const

/** Дата завершення VIP, якщо він ще активний; інакше null. */
export function vipUntil(profile: { vip_until?: string | null } | null | undefined, now = Date.now()): Date | null {
  const raw = profile?.vip_until
  if (!raw) return null
  const d = new Date(raw)
  return Number.isFinite(d.getTime()) && d.getTime() > now ? d : null
}

export function formatVipDate(d: Date): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' }).format(d)
}

// Гість натиснув «Підписатися» → після входу (навіть через лист-підтвердження) модалка відкривається сама.
const PENDING_KEY = 'eventera:vip-pending'
const PENDING_TTL_MS = 60 * 60_000

export function markVipPending() {
  try {
    localStorage.setItem(PENDING_KEY, String(Date.now()))
  } catch {
    /* сховище недоступне — модалку відкриють вручну */
  }
}

/** true — якщо прапорець свіжий; прапорець при цьому видаляється. */
export function takeVipPending(): boolean {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return false
    localStorage.removeItem(PENDING_KEY)
    return Date.now() - Number(raw) < PENDING_TTL_MS
  } catch {
    return false
  }
}
