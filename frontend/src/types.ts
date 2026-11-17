// Типи під схему Ролі 3 (supabase/migrations/). Подія читається з view `event_feed`.

export type EventCategory = 'concert' | 'theatre' | 'festival' | 'opera' | 'other'
export type EventStatus = 'scheduled' | 'postponed' | 'cancelled'
export type TicketStatus = 'unknown' | 'available' | 'few_left' | 'sold_out'
export type EventBadge = 'few_tickets' | 'new' | null

export interface EventArtist {
  id: number
  name: string
  slug: string
}

export interface EventGenre {
  slug: string
  name: string
}

export interface EventSource {
  source: string
  url: string
  price_min: number | null
}

/** Сирий рядок `event_feed` (як повертає PostgREST / API). */
export interface EventFeedRow {
  id: number | string
  slug: string
  title: string
  description: string | null
  category: EventCategory
  status: EventStatus
  starts_at: string
  ends_at: string | null
  is_all_day: boolean
  price_min: number | string | null
  price_max: number | string | null
  currency: string
  is_free: boolean | null
  ticket_status: TicketStatus
  image_url: string | null
  ticket_url: string | null
  first_seen_at: string
  is_new: boolean
  venue_id: number | string | null
  venue_name: string | null
  venue_address: string | null
  artists: EventArtist[] | null
  genres: EventGenre[] | null
  sources: EventSource[] | null
}

/** Нормалізована подія, з якою працюють компоненти. */
export interface Event {
  id: number
  slug: string
  title: string
  description: string | null
  category: EventCategory
  status: EventStatus
  starts_at: string
  ends_at: string | null
  is_all_day: boolean
  price_min: number | null
  price_max: number | null
  currency: string
  is_free: boolean
  ticket_status: TicketStatus
  image_url: string | null
  ticket_url: string | null
  first_seen_at: string
  is_new: boolean
  venue_id: number | null
  venue_name: string | null
  venue_address: string | null
  artists: EventArtist[]
  genres: EventGenre[]
  sources: EventSource[]
  /** Похідне: few_left → few_tickets, інакше is_new → new. */
  badge: EventBadge
}

export type Period = 'week' | 'month' | 'season' | 'year'

/** Швидкі фільтри з hero: «Сьогодні», «Ці вихідні» (за часом Києва). Мають пріоритет над period. */
export type When = 'today' | 'weekend'

export interface EventFilters {
  period?: Period
  when?: When
  category?: EventCategory
  price_max?: number
  free?: boolean
  /** slug жанру з таблиці genres */
  genre?: string
  q?: string
  limit?: number
  offset?: number
}

export interface Stats {
  /** Нових подій цього тижня */
  events_this_week: number
  /** Подій від артистів зі списку користувача */
  from_your_artists: number
}

export interface Profile {
  id: string
  display_name: string | null
  email_alerts: boolean
  telegram_alerts: boolean
}

/** Чекбокси «Як повідомляти». Два останні — лише якщо колонки є в profiles. */
export interface NotificationPrefs {
  email_alerts: boolean
  telegram_alerts: boolean
  remind_day_before?: boolean
  /** null — без обмеження ціни */
  max_price?: number | null
}

export interface TelegramStatus {
  linked: boolean
  username: string | null
}

export type ProfilePatch = Partial<Pick<Profile, 'display_name' | 'email_alerts' | 'telegram_alerts'>>

export type SubscriptionKind = 'artist' | 'event' | 'keyword'

export interface Subscription {
  id: number
  kind: SubscriptionKind
  artist_id: number | null
  event_id: number | null
  keyword: string | null
  created_at: string
  /** Що показати в списку: ім'я артиста / ключове слово / назва події */
  label: string
}

export type ClickKind = 'donate' | 'subscribe' | 'ticket' | 'telegram'

export type WouldPay = 'yes' | 'maybe' | 'no'

export interface FeedbackInput {
  rating: number
  liked?: string
  disliked?: string
  would_pay?: WouldPay
  page?: string
}
