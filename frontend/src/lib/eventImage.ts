import type { Event, EventCategory } from '../types'

export const CATEGORIES: readonly EventCategory[] = ['concert', 'theatre', 'festival', 'opera', 'other']

/**
 * Скільки фото лежить у public/images/categories/ для кожної категорії ({category}-1.jpg … -N.jpg).
 * Додали файл — збільш число. 0 → беремо фото категорії з CATEGORY_PHOTO_FALLBACK.
 */
export const CATEGORY_PHOTO_COUNT: Record<EventCategory, number> = {
  concert: 4,
  theatre: 1,
  festival: 1,
  opera: 3,
  other: 0,
}
const CATEGORY_PHOTO_FALLBACK: EventCategory = 'concert'

/** Синоніми з парсера / API → категорія event_feed. Порівняння без урахування регістру. */
const CATEGORY_SYNONYMS: Record<string, EventCategory> = {
  concert: 'concert',
  concerts: 'concert',
  концерт: 'concert',
  концерти: 'concert',
  theatre: 'theatre',
  theater: 'theatre',
  театр: 'theatre',
  вистава: 'theatre',
  вистави: 'theatre',
  festival: 'festival',
  фестиваль: 'festival',
  фестивалі: 'festival',
  opera: 'opera',
  опера: 'opera',
  ballet: 'opera',
  балет: 'opera',
  other: 'other',
  standup: 'other',
  'stand-up': 'other',
  стендап: 'other',
  'стенд-ап': 'other',
}

/** Будь-яка категорія з джерела → concert | theatre | festival | opera | other. Невідома → other. */
export function normalizeCategory(raw: unknown): EventCategory {
  if (typeof raw !== 'string') return 'other'
  return CATEGORY_SYNONYMS[raw.trim().toLowerCase()] ?? 'other'
}

/**
 * Детермінований 32-бітний хеш від id (fmix32 з MurmurHash3): та сама подія — завжди те саме число,
 * а сусідні id розкидані по різних фото.
 */
export function hashId(id: number | string): number {
  const s = String(id)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Фото за категорією: /images/categories/{category}-{1..N}.jpg, номер — від хешу id. */
export function categoryPhoto(event: { id: number | string; category: unknown }): string {
  let category = normalizeCategory(event.category)
  if (CATEGORY_PHOTO_COUNT[category] < 1) category = CATEGORY_PHOTO_FALLBACK
  const n = (hashId(event.id) % CATEGORY_PHOTO_COUNT[category]) + 1
  return `/images/categories/${category}-${n}.jpg`
}

export interface EventImageChoice {
  src: string
  /** true — офіційне фото з сайту-джерела (image_url) */
  official: boolean
}

/**
 * Яке фото показати: image_url, якщо є і ще не впало з помилкою (officialFailed);
 * інакше — фото за категорією.
 */
export function pickEventImage(
  event: Pick<Event, 'id' | 'image_url'> & { category: unknown },
  officialFailed = false,
): EventImageChoice {
  const url = event.image_url?.trim()
  if (url && !officialFailed) return { src: url, official: true }
  return { src: categoryPhoto(event), official: false }
}

/** Підпис для офіційного фото: назва джерела, інакше домен картинки. */
export function photoCredit(event: Pick<Event, 'image_url' | 'sources'>): string | null {
  const source = event.sources?.[0]?.source?.trim()
  if (source) return source
  try {
    return event.image_url ? new URL(event.image_url).hostname.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

/** Розмитий градієнт-плейсхолдер у тон категорії, поки фото вантажиться. */
export const CATEGORY_PLACEHOLDER: Record<EventCategory, string> = {
  concert:
    'radial-gradient(60% 70% at 30% 70%, #C45442 0%, transparent 70%), radial-gradient(50% 60% at 80% 20%, #8C5A7E 0%, transparent 70%), #3A2232',
  theatre:
    'radial-gradient(60% 70% at 30% 70%, #9C4A5C 0%, transparent 70%), radial-gradient(50% 60% at 80% 20%, #D9A38C 0%, transparent 70%), #4A2A3F',
  festival:
    'radial-gradient(60% 70% at 30% 70%, #E8806A 0%, transparent 70%), radial-gradient(50% 60% at 80% 20%, #F2C27A 0%, transparent 70%), #5A3550',
  opera:
    'radial-gradient(60% 70% at 30% 70%, #5A4A9C 0%, transparent 70%), radial-gradient(50% 60% at 80% 20%, #C9B6E4 0%, transparent 70%), #2E2440',
  other:
    'radial-gradient(60% 70% at 30% 70%, #7A5C70 0%, transparent 70%), radial-gradient(50% 60% at 80% 20%, #C9B6E4 0%, transparent 70%), #2E1B28',
}
