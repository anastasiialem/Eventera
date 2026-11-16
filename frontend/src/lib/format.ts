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
