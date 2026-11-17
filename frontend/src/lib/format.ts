import type { Event, EventCategory } from '../types'

const TZ = 'Europe/Kyiv'

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  concert: 'Концерт',
  theatre: 'Театр',
  festival: 'Фестиваль',
  opera: 'Опера',
  other: 'Інше',
}

/** «21» */
export const formatDay = (iso: string) =>
  new Intl.DateTimeFormat('uk-UA', { day: '2-digit', timeZone: TZ }).format(new Date(iso))

/** «листопада» */
export const formatMonth = (iso: string) =>
  new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: TZ })
    .format(new Date(iso))
    .replace(/^\d+\s*/, '')

/** «Сб · 19:00» або «Сб · весь день» */
export function formatWeekdayTime(e: Pick<Event, 'starts_at' | 'is_all_day'>) {
  const d = new Date(e.starts_at)
  const wd = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', timeZone: TZ }).format(d)
  const time = e.is_all_day
    ? 'весь день'
    : new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d)
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} · ${time}`
}

const num = (n: number) => new Intl.NumberFormat('uk-UA').format(n)

/** «від 450 ₴» / «Вхід вільний» / «Ціну уточнюємо» */
export function formatPrice(e: Pick<Event, 'price_min' | 'is_free'>) {
  if (e.is_free) return 'Вхід вільний'
  if (e.price_min === null) return 'Ціну уточнюємо'
  return `від ${num(e.price_min)} ₴`
}

/** «щойно», «12 хв тому», «3 год тому», «2 дн тому» */
export function formatAgo(iso: string | number, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'щойно'
  if (min < 60) return `${min} хв тому`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} год тому`
  return `${Math.floor(h / 24)} дн тому`
}

/** «1 подія», «3 події», «6 подій» */
export function eventsWord(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'подія'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'події'
  return 'подій'
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('uk-UA', { timeZone: TZ, ...opts }).format(new Date(iso))

/** «19:00» */
export const formatTime = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' })

/** «субота» */
export const formatWeekday = (iso: string) => fmt(iso, { weekday: 'long' })

/** «Сб, 21 листопада» */
export function formatShortDate(iso: string) {
  const wd = fmt(iso, { weekday: 'short' })
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${fmt(iso, { day: 'numeric', month: 'long' })}`
}

/** «21 листопада» */
export const formatDayMonth = (iso: string) => fmt(iso, { day: 'numeric', month: 'long' })

/** «450–1 200 ₴» / «від 450 ₴» / «450 ₴» / «Вхід вільний» / «Ціну уточнюємо» */
export function formatPriceRange(e: Pick<Event, 'price_min' | 'price_max' | 'is_free'>) {
  if (e.is_free) return 'Вхід вільний'
  const { price_min: min, price_max: max } = e
  if (min === null && max === null) return 'Ціну уточнюємо'
  if (min !== null && max !== null && max > min) return `${num(min)}–${num(max)} ₴`
  if (min !== null && max === null) return `від ${num(min)} ₴`
  return `${num((min ?? max)!)} ₴`
}

/** plural(3, ['артист', 'артисти', 'артистів']) → «артисти» */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
