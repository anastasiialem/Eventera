// Єдиний шар даних. Порядок джерел:
//   1) API Ролі 3 (якщо задано VITE_API_URL)
//   2) Supabase напряму (view event_feed і таблиці зі схеми supabase/migrations/)
//   3) моки (src/mocks/events.ts)
// Читання ніколи не падає: при помилці — console.warn і наступне джерело.
import { mockEvents, mockStats, mockSubscriptions } from '../mocks/events'
import type {
  ClickKind,
  Event,
  EventFeedRow,
  EventFilters,
  EventGenre,
  FeedbackInput,
  NotificationPrefs,
  Period,
  Profile,
  ProfilePatch,
  Stats,
  Subscription,
  SubscriptionKind,
  TelegramStatus,
} from '../types'
import { normalizeCategory } from './eventImage'
import { getAccessToken, getUserId, supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || null
const API_TIMEOUT_MS = 6000
const EVENT_FEED_COLUMNS =
  'id, slug, title, description, category, status, starts_at, ends_at, is_all_day, price_min, price_max, currency, is_free, ticket_status, image_url, ticket_url, first_seen_at, is_new, venue_id, venue_name, venue_address, artists, genres, sources'

// ---------------------------------------------------------------------------
// Допоміжне
// ---------------------------------------------------------------------------

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL не задано')
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: AbortSignal.timeout(API_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`API ${init.method ?? 'GET'} ${path} → ${res.status}`)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** API → Supabase → моки. `api`/`db` = null, якщо джерело не налаштоване. */
async function readChain<T>(
  name: string,
  api: (() => Promise<T>) | null,
  db: (() => Promise<T>) | null,
  mock: () => T,
): Promise<T> {
  if (api) {
    try {
      return await api()
    } catch (err) {
      console.warn(`[eventera] ${name}: API недоступний, пробую ${db ? 'Supabase' : 'моки'}`, err)
    }
  }
  if (db) {
    try {
      return await db()
    } catch (err) {
      console.warn(`[eventera] ${name}: Supabase недоступний, показую моки`, err)
    }
  }
  return mock()
}

const apiOr = <T>(fn: () => Promise<T>) => (API_URL ? fn : null)
const dbOr = <T>(fn: () => Promise<T>) => (supabase ? fn : null)

/** API може віддати масив або { items | data | events: [...] }. */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['items', 'data', 'events', 'subscriptions']) {
      if (Array.isArray(obj[key])) return obj[key] as T[]
    }
  }
  throw new Error('Неочікуваний формат відповіді API')
}

const toNum = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v)

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// ---------------------------------------------------------------------------
// Події
// ---------------------------------------------------------------------------

/** Рядок event_feed (з API або Supabase) → Event. */
export function normalizeEvent(row: EventFeedRow): Event {
  const price_min = toNum(row.price_min)
  const price_max = toNum(row.price_max)
  const is_new = Boolean(row.is_new)
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    category: normalizeCategory(row.category),
    status: row.status ?? 'scheduled',
    starts_at: row.starts_at,
    ends_at: row.ends_at ?? null,
    is_all_day: Boolean(row.is_all_day),
    price_min,
    price_max,
    currency: row.currency ?? 'UAH',
    is_free: row.is_free ?? price_max === 0,
    ticket_status: row.ticket_status ?? 'unknown',
    image_url: row.image_url || null,
    ticket_url: row.ticket_url || null,
    first_seen_at: row.first_seen_at,
    is_new,
    venue_id: toNum(row.venue_id),
    venue_name: row.venue_name ?? null,
    venue_address: row.venue_address ?? null,
    artists: row.artists ?? [],
    genres: row.genres ?? [],
    sources: (row.sources ?? []).map((s) => ({ ...s, price_min: toNum(s.price_min) })),
    badge: row.ticket_status === 'few_left' ? 'few_tickets' : is_new ? 'new' : null,
  }
}

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 31, season: 92, year: 365 }

function periodRange(period: Period, now = new Date()): { from: Date; to: Date } {
  const to = new Date(now)
  to.setDate(to.getDate() + PERIOD_DAYS[period])
  return { from: now, to }
}

const TZ = 'Europe/Kyiv'
/** «Київський» настінний час моменту d, записаний як UTC (для арифметики з датами). */
function kyivWall(d: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')))
}

const kyivOffsetMs = (d: Date) => kyivWall(d).getTime() - Math.floor(d.getTime() / 1000) * 1000

/** Північ за Києвом через `addDays` днів від дня моменту `d` (з урахуванням переходу на літній час). */
function kyivMidnight(d: Date, addDays = 0): Date {
  const wall = kyivWall(d)
  const wallMidnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + addDays)
  const guess = new Date(wallMidnight - kyivOffsetMs(d))
  return new Date(wallMidnight - kyivOffsetMs(guess))
}

/** Діапазон дат для фільтрів: when (сьогодні / вихідні) → period → null (усі майбутні). */
export function dateRange(f: Pick<EventFilters, 'period' | 'when'>, now = new Date()): { from: Date; to: Date } | null {
  if (f.when === 'today') return { from: kyivMidnight(now), to: kyivMidnight(now, 1) }
  if (f.when === 'weekend') {
    const weekday = kyivWall(now).getUTCDay() // 0 — неділя
    const toSaturday = weekday === 0 ? -1 : 6 - weekday
    const saturday = kyivMidnight(now, toSaturday)
    const today = kyivMidnight(now)
    return { from: saturday > today ? saturday : today, to: kyivMidnight(now, toSaturday + 2) }
  }
  if (f.period) return periodRange(f.period, now)
  return null
}

/** Ті самі фільтри для моків, що й для Supabase. */
export function filterEvents(events: Event[], f: EventFilters = {}): Event[] {
  let list = [...events]
  const range = dateRange(f)
  const fromMs = range ? range.from.getTime() : Date.now()
  const toMs = range ? range.to.getTime() : Infinity
  list = list.filter((e) => {
    const t = new Date(e.starts_at).getTime()
    return t >= fromMs && t < toMs
  })
  if (f.category) list = list.filter((e) => e.category === f.category)
  if (f.free) list = list.filter((e) => e.is_free)
  if (f.price_max !== undefined) list = list.filter((e) => e.price_min === null || e.price_min <= f.price_max!)
  if (f.genre) list = list.filter((e) => e.genres.some((g) => g.slug === f.genre))
  if (f.q?.trim()) {
    const q = f.q.trim().toLowerCase()
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.venue_name ?? '').toLowerCase().includes(q) ||
        e.artists.some((a) => a.name.toLowerCase().includes(q)),
    )
  }
  list.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return list
}

/** Екранування для ilike: % і _ — службові символи. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

/** Значення для PostgREST .or(): прибираємо службові символи (кома, дужки, лапки, wildcard-и). */
const orSafe = (s: string) =>
  s
    .replace(/[,()"'\\%_*:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** id подій, де виступає артист, чия назва містить term. Помилка → [] (пошук працює по назві й місцю). */
async function searchArtistEventIds(term: string): Promise<number[]> {
  try {
    const { data: artists, error } = await supabase!
      .from('artists')
      .select('id')
      .ilike('name', `%${likeEscape(term)}%`)
      .limit(50)
    if (error) throw error
    if (!artists?.length) return []
    const { data: links, error: linksErr } = await supabase!
      .from('event_artists')
      .select('event_id')
      .in(
        'artist_id',
        artists.map((a) => a.id),
      )
      .limit(500)
    if (linksErr) throw linksErr
    return [...new Set((links ?? []).map((l) => Number(l.event_id)))]
  } catch (err) {
    console.warn('[eventera] searchArtistEventIds: шукаю лише по назві й місцю', err)
    return []
  }
}

/** Розмір сторінки афіші на головній. */
export const EVENTS_PAGE_SIZE = 12

export interface EventsPage {
  items: Event[]
  /** Загальна кількість подій з урахуванням фільтрів (не довжина items). */
  total: number
  offset: number
}

/**
 * Одна сторінка афіші. Без `limit` — усі події (без штучного ліміту).
 * `total` — точна кількість за фільтрами (Supabase count: 'exact').
 */
export async function getEvents(filters: EventFilters = {}): Promise<EventsPage> {
  const offset = filters.offset ?? 0
  const limit = filters.limit
  return readChain<EventsPage>(
    'getEvents',
    apiOr(async () => {
      const data = await request<unknown>(`/api/events${buildQuery({ ...filters })}`)
      const items = unwrapList<EventFeedRow>(data).map(normalizeEvent)
      const meta = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, unknown>
      const total = Number(meta.total ?? meta.count ?? NaN)
      return { items, total: Number.isFinite(total) ? total : offset + items.length, offset }
    }),
    dbOr(async () => {
      let q = supabase!
        .from('event_feed')
        .select(EVENT_FEED_COLUMNS, { count: 'exact' })
        .order('starts_at', { ascending: true })
        .order('id', { ascending: true })
      const range = dateRange(filters)
      if (range) q = q.gte('starts_at', range.from.toISOString()).lt('starts_at', range.to.toISOString())
      else q = q.gte('starts_at', new Date().toISOString())
      if (filters.category) q = q.eq('category', filters.category)
      if (filters.free) q = q.eq('is_free', true)
      if (filters.price_max !== undefined) q = q.lte('price_min', filters.price_max)
      if (filters.genre) q = q.contains('genres', [{ slug: filters.genre }])
      const term = orSafe(filters.q ?? '')
      if (term) {
        // Пошук по назві, місцю та іменах артистів (artists → event_artists → id події).
        const ids = await searchArtistEventIds(term)
        const parts = [`title.ilike.*${term}*`, `venue_name.ilike.*${term}*`]
        if (ids.length) parts.push(`id.in.(${ids.join(',')})`)
        q = q.or(parts.join(','))
      }
      if (limit) q = q.range(offset, offset + limit - 1)
      const { data, error, count } = await q
      if (error) throw error
      const items = (data as unknown as EventFeedRow[]).map(normalizeEvent)
      return { items, total: count ?? offset + items.length, offset }
    }),
    () => {
      const all = filterEvents(mockEvents, filters)
      return { items: all.slice(offset, limit ? offset + limit : undefined), total: all.length, offset }
    },
  )
}

/** Жанри для фільтра «Усі жанри» (таблиця genres, фільтр за slug). */
export async function getGenres(): Promise<EventGenre[]> {
  return readChain<EventGenre[]>(
    'getGenres',
    null,
    dbOr(async () => {
      const { data, error } = await supabase!.from('genres').select('slug, name').order('name')
      if (error) throw error
      return (data ?? []) as EventGenre[]
    }),
    () => {
      const map = new Map<string, EventGenre>()
      for (const e of mockEvents) for (const g of e.genres) map.set(g.slug, g)
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'uk'))
    },
  )
}

/** Коли парсер востаннє знайшов нову подію: max(first_seen_at). null — невідомо. */
export async function getLastUpdated(): Promise<string | null> {
  return readChain<string | null>(
    'getLastUpdated',
    null,
    dbOr(async () => {
      const { data, error } = await supabase!
        .from('event_feed')
        .select('first_seen_at')
        .order('first_seen_at', { ascending: false })
        .limit(1)
      if (error) throw error
      return (data?.[0]?.first_seen_at as string | undefined) ?? null
    }),
    () => null,
  )
}

export async function getEvent(id: number | string): Promise<Event | null> {
  const numId = Number(id)
  return readChain(
    'getEvent',
    apiOr(async () => normalizeEvent(await request<EventFeedRow>(`/api/events/${numId}`))),
    dbOr(async () => {
      const { data, error } = await supabase!.from('event_feed').select(EVENT_FEED_COLUMNS).eq('id', numId).maybeSingle()
      if (error) throw error
      return data ? normalizeEvent(data as unknown as EventFeedRow) : null
    }),
    () => mockEvents.find((e) => e.id === numId) ?? null,
  )
}

export async function getSimilar(id: number | string, limit = 3): Promise<Event[]> {
  const numId = Number(id)
  const fromList = (list: Event[], base: Event | undefined) =>
    list
      .filter((e) => e.id !== numId && (!base || e.category === base.category))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, limit)

  return readChain(
    'getSimilar',
    apiOr(async () => unwrapList<EventFeedRow>(await request(`/api/events/${numId}/similar`)).map(normalizeEvent)),
    dbOr(async () => {
      const base = await getEvent(numId)
      let q = supabase!
        .from('event_feed')
        .select(EVENT_FEED_COLUMNS)
        .neq('id', numId)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(limit)
      if (base) q = q.eq('category', base.category)
      const { data, error } = await q
      if (error) throw error
      return (data as unknown as EventFeedRow[]).map(normalizeEvent)
    }),
    () => {
      const base = mockEvents.find((e) => e.id === numId)
      const similar = fromList(mockEvents, base)
      return similar.length ? similar : fromList(mockEvents, undefined)
    },
  )
}

export async function getStats(): Promise<Stats> {
  return readChain(
    'getStats',
    apiOr(() => request<Stats>('/api/stats')),
    dbOr(async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
      const { count, error } = await supabase!
        .from('events')
        .select('id', { count: 'exact', head: true })
        .gte('first_seen_at', weekAgo)
      if (error) throw error

      let fromYourArtists = 0
      const userId = await getUserId()
      if (userId) {
        const { data: subs, error: subsErr } = await supabase!
          .from('subscriptions')
          .select('artist_id')
          .eq('kind', 'artist')
        if (subsErr) throw subsErr
        const artistIds = (subs ?? []).map((s) => s.artist_id as number)
        if (artistIds.length) {
          const { count: c, error: eaErr } = await supabase!
            .from('event_artists')
            .select('event_id, events!inner(starts_at)', { count: 'exact', head: true })
            .in('artist_id', artistIds)
            .gte('events.starts_at', new Date().toISOString())
          if (eaErr) throw eaErr
          fromYourArtists = c ?? 0
        }
      }
      return { events_this_week: count ?? 0, from_your_artists: fromYourArtists }
    }),
    () => mockStats,
  )
}

// ---------------------------------------------------------------------------
// Профіль (profiles Ролі 3: display_name, email_alerts, telegram_alerts)
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<Profile | null> {
  if (!supabase || !(await getUserId())) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email_alerts, telegram_alerts')
      .maybeSingle()
    if (error) throw error
    return (data as Profile | null) ?? null
  } catch (err) {
    console.warn('[eventera] getProfile: не вдалося завантажити профіль', err)
    return null
  }
}

export async function updateProfile(patch: ProfilePatch): Promise<Profile> {
  const userId = await getUserId()
  if (!supabase || !userId) throw new Error('Потрібно увійти')
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id, display_name, email_alerts, telegram_alerts')
    .single()
  if (error) throw error
  return data as Profile
}

// Налаштування сповіщень (/waitlist → «Як повідомляти»).
// remind_day_before / max_price — з міграції profile_preferences Ролі 3; якщо її ще
// не накотили (колонок немає) — повертаємо extended: false, і чекбокси ховаються.
const BASE_PREFS = 'email_alerts, telegram_alerts'
const EXTENDED_PREFS = `${BASE_PREFS}, remind_day_before, max_price`

export async function getNotificationPrefs(): Promise<{ prefs: NotificationPrefs; extended: boolean } | null> {
  if (!supabase || !(await getUserId())) return null
  const ext = await supabase.from('profiles').select(EXTENDED_PREFS).maybeSingle()
  if (!ext.error) return ext.data ? { prefs: ext.data as NotificationPrefs, extended: true } : null
  console.warn('[eventera] getNotificationPrefs: немає remind_day_before / max_price, показую базові', ext.error)
  const base = await supabase.from('profiles').select(BASE_PREFS).maybeSingle()
  if (base.error) throw base.error
  return base.data ? { prefs: base.data as NotificationPrefs, extended: false } : null
}

export async function updateNotificationPrefs(patch: Partial<NotificationPrefs>): Promise<void> {
  const userId = await getUserId()
  if (!supabase || !userId) throw new Error('Потрібно увійти')
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Telegram: чи прив'язаний акаунт (telegram_links, RLS «own telegram: read»)
// ---------------------------------------------------------------------------

/** null — невідомо (немає Supabase / RLS не дає читати): показуємо лише «Підключити». */
export async function getTelegramStatus(): Promise<TelegramStatus | null> {
  if (!supabase || !(await getUserId())) return null
  try {
    const { data, error } = await supabase.from('telegram_links').select('username').maybeSingle()
    if (error) throw error
    return data ? { linked: true, username: (data.username as string | null) ?? null } : { linked: false, username: null }
  } catch (err) {
    console.warn('[eventera] getTelegramStatus: не вдалося прочитати telegram_links', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// «Я чекаю на…» (subscriptions Ролі 3: kind + artist_id | event_id | keyword)
// ---------------------------------------------------------------------------

const LOCAL_SUBS_KEY = 'eventera:subscriptions'

function readLocalSubs(): Subscription[] {
  try {
    const raw = localStorage.getItem(LOCAL_SUBS_KEY)
    return raw ? (JSON.parse(raw) as Subscription[]) : [...mockSubscriptions]
  } catch {
    return [...mockSubscriptions]
  }
}

function writeLocalSubs(list: Subscription[]) {
  try {
    localStorage.setItem(LOCAL_SUBS_KEY, JSON.stringify(list))
  } catch {
    /* приватне вікно / заблоковане сховище — працюємо без збереження */
  }
}

interface SubscriptionRow {
  id: number | string
  kind: SubscriptionKind
  artist_id: number | string | null
  event_id: number | string | null
  keyword: string | null
  created_at: string
  label?: string
  artists?: { name: string } | null
  events?: { title: string } | null
}

const SUBSCRIPTION_COLUMNS = 'id, kind, artist_id, event_id, keyword, created_at, artists(name), events(title)'

function normalizeSubscription(row: SubscriptionRow): Subscription {
  return {
    id: Number(row.id),
    kind: row.kind,
    artist_id: toNum(row.artist_id),
    event_id: toNum(row.event_id),
    keyword: row.keyword,
    created_at: row.created_at,
    label: row.label ?? row.artists?.name ?? row.events?.title ?? row.keyword ?? '',
  }
}

/** Бекенд налаштований і користувач увійшов — інакше працюємо з локальним списком. */
async function hasRemoteSession(): Promise<boolean> {
  return Boolean((API_URL || supabase) && (await getUserId()))
}

export async function getSubscriptions(): Promise<Subscription[]> {
  if (!(await hasRemoteSession())) return readLocalSubs()
  return readChain(
    'getSubscriptions',
    apiOr(async () => unwrapList<SubscriptionRow>(await request('/api/subscriptions')).map(normalizeSubscription)),
    dbOr(async () => {
      const { data, error } = await supabase!
        .from('subscriptions')
        .select(SUBSCRIPTION_COLUMNS)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as SubscriptionRow[]).map(normalizeSubscription)
    }),
    readLocalSubs,
  )
}

/** Шукаємо артиста в таблиці artists за назвою або аліасом (без урахування регістру назви). */
async function findArtistId(name: string): Promise<number | null> {
  const byName = await supabase!.from('artists').select('id').ilike('name', likeEscape(name)).limit(1)
  if (byName.error) throw byName.error
  if (byName.data?.length) return Number(byName.data[0].id)

  const byAlias = await supabase!.from('artists').select('id').contains('aliases', [name]).limit(1)
  if (byAlias.error) throw byAlias.error
  return byAlias.data?.length ? Number(byAlias.data[0].id) : null
}

/**
 * Додати артиста / виставу в «Я чекаю на…».
 * Є в artists → kind='artist' + artist_id; немає → kind='keyword'.
 */
export async function addSubscription(name: string, opts: { artistId?: number } = {}): Promise<Subscription> {
  const clean = name.trim()
  if (clean.length < 2) throw new Error('Назва має містити щонайменше 2 символи')

  if (!(await hasRemoteSession())) {
    const list = readLocalSubs()
    const sub: Subscription = {
      id: Date.now(),
      kind: opts.artistId ? 'artist' : 'keyword',
      artist_id: opts.artistId ?? null,
      event_id: null,
      keyword: opts.artistId ? null : clean,
      created_at: new Date().toISOString(),
      label: clean,
    }
    writeLocalSubs([sub, ...list])
    return sub
  }

  if (API_URL) {
    try {
      const row = await request<SubscriptionRow>('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ name: clean }),
      })
      return normalizeSubscription(row)
    } catch (err) {
      if (!supabase) throw err
      console.warn('[eventera] addSubscription: API недоступний, пишу в Supabase напряму', err)
    }
  }

  const userId = (await getUserId())!
  const artistId = opts.artistId ?? (await findArtistId(clean))
  const insert: { user_id: string; kind: SubscriptionKind; artist_id: number | null; keyword: string | null } =
    artistId
      ? { user_id: userId, kind: 'artist', artist_id: artistId, keyword: null }
      : { user_id: userId, kind: 'keyword', artist_id: null, keyword: clean }
  const { data, error } = await supabase!.from('subscriptions').insert(insert).select(SUBSCRIPTION_COLUMNS).single()
  if (error) {
    if (error.code === '23505') throw new Error('Вже є у твоєму списку')
    throw error
  }
  return normalizeSubscription(data as unknown as SubscriptionRow)
}

export async function removeSubscription(id: number): Promise<void> {
  if (!(await hasRemoteSession())) {
    writeLocalSubs(readLocalSubs().filter((s) => s.id !== id))
    return
  }
  if (API_URL) {
    try {
      await request(`/api/subscriptions/${id}`, { method: 'DELETE' })
      return
    } catch (err) {
      if (!supabase) throw err
      console.warn('[eventera] removeSubscription: API недоступний, видаляю в Supabase напряму', err)
    }
  }
  const { error } = await supabase!.from('subscriptions').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Аналітика: clicks і feedback (infra/supabase/schema.sql). Ніколи не кидають.
// insert без .select(): читати ці таблиці anon/authenticated не можуть.
// ---------------------------------------------------------------------------

export async function logClick(kind: ClickKind, eventId?: number | string): Promise<void> {
  if (!supabase) {
    console.info('[eventera] click (не записано — Supabase не налаштовано):', kind, eventId ?? '')
    return
  }
  try {
    const { error } = await supabase.from('clicks').insert({
      kind,
      event_id: eventId === undefined ? null : Number(eventId),
      user_id: await getUserId(),
    })
    if (error) throw error
  } catch (err) {
    console.warn('[eventera] logClick: не вдалося записати клік', err)
  }
}

export async function sendFeedback(data: FeedbackInput): Promise<boolean> {
  if (!supabase) {
    console.info('[eventera] feedback (не записано — Supabase не налаштовано):', data)
    return false
  }
  try {
    const { error } = await supabase.from('feedback').insert({
      rating: data.rating,
      liked: data.liked?.trim() || null,
      disliked: data.disliked?.trim() || null,
      would_pay: data.would_pay ?? null,
      page: data.page ?? window.location.pathname,
      user_id: await getUserId(),
    })
    if (error) throw error
    return true
  } catch (err) {
    console.warn('[eventera] sendFeedback: не вдалося надіслати відгук', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Прив'язка Telegram через бекенд Ролі 3 (backend/README.md):
// POST ${VITE_BACKEND_URL}/api/telegram/link, Bearer <access_token> → { url }
// ---------------------------------------------------------------------------

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, '') || null
export const TELEGRAM_BOT_URL = import.meta.env.VITE_TELEGRAM_BOT_URL || 'https://t.me/Eventera_lviv_bot'
/** Render засинає: перший запит після сну може йти до ~50 с. */
const TELEGRAM_LINK_TIMEOUT_MS = 60_000

export type TelegramLinkResult =
  /** гість — відправили на реєстрацію */
  | 'auth'
  /** відкрили персональне посилання з токеном */
  | 'linked'
  /** бекенд не відповів — відкрили просто бота */
  | 'fallback'

export interface LinkTelegramOptions {
  /** Чи є сесія (з useAuth) — перевіряємо синхронно, щоб не втратити жест користувача. */
  isLoggedIn: boolean
  /** Перехід усередині SPA (useNavigate). */
  navigate: (to: string) => void
  /** Куди повернути гостя після реєстрації. За замовчуванням — поточна сторінка. */
  next?: string
}

/**
 * Кнопка «Сповіщення в Telegram». ВИКЛИКАТИ ПРЯМО В ОБРОБНИКУ КЛІКУ:
 * порожня вкладка відкривається синхронно (до першого await), інакше браузер заблокує попап.
 */
export async function linkTelegram({ isLoggedIn, navigate, next }: LinkTelegramOptions): Promise<TelegramLinkResult> {
  void logClick('telegram')

  if (!isLoggedIn) {
    const back = next ?? `${window.location.pathname}${window.location.search}`
    navigate(`/auth?mode=signup&next=${encodeURIComponent(back)}`)
    return 'auth'
  }

  // Синхронно, у межах жесту користувача. Без noopener — інакше window.open поверне null.
  const tab = window.open('', '_blank')
  try {
    if (tab) {
      tab.document.title = 'Прокидаємо бота…'
      tab.document.body.style.cssText =
        'margin:0;display:grid;place-items:center;height:100vh;background:#F5E9EC;color:#4A2A3F;font:500 18px system-ui,sans-serif'
      tab.document.body.textContent = 'Прокидаємо бота… це може зайняти до хвилини'
    }
  } catch {
    /* вкладка вже з іншого origin — не страшно */
  }
  const openInTab = (url: string) => {
    if (tab && !tab.closed) tab.location.href = url
    else window.open(url, '_blank', 'noopener')
  }

  try {
    if (!BACKEND_URL) throw new Error('VITE_BACKEND_URL не задано')
    const token = await getAccessToken()
    if (!token) throw new Error('Немає access_token')
    const res = await fetch(`${BACKEND_URL}/api/telegram/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TELEGRAM_LINK_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`POST /api/telegram/link → ${res.status}`)
    const { url } = (await res.json()) as { url?: string }
    if (!url || !/^https:\/\/t\.me\//.test(url)) throw new Error('Неочікувана відповідь бекенду')
    openInTab(url)
    return 'linked'
  } catch (err) {
    console.warn('[eventera] linkTelegram: бекенд недоступний, відкриваю бота без токена', err)
    openInTab(TELEGRAM_BOT_URL)
    return 'fallback'
  }
}

/** Скільки разів натискали «Задонатити» (RPC donate_clicks_count з infra/supabase/schema.sql). */
export async function getDonateCount(): Promise<number> {
  if (!supabase) return 0
  try {
    const { data, error } = await supabase.rpc('donate_clicks_count')
    if (error) throw error
    return Number(data ?? 0)
  } catch (err) {
    console.warn('[eventera] getDonateCount: RPC недоступний', err)
    return 0
  }
}
