import { useQuery } from '@tanstack/react-query'
import { Bell, X } from 'lucide-react'
import { useState } from 'react'
import { getEvents } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { useSubscriptions } from '../../lib/use-subscriptions'
import type { Event, EventCategory, Subscription } from '../../types'
import { Button } from '../ui/Button'

const DISMISSED_KEY = 'eventera:waited-banner-dismissed'

const NEW_THING: Record<EventCategory, string> = {
  concert: 'з’явився новий концерт',
  theatre: 'з’явилася нова вистава',
  festival: 'з’явився новий фестиваль',
  opera: 'з’явилася нова вистава',
  other: 'з’явилася нова подія',
}

function readDismissed(): number[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.map(Number) : []
  } catch {
    return []
  }
}

function writeDismissed(ids: number[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-50)))
  } catch {
    /* приватне вікно — просто сховаємо до перезавантаження */
  }
}

/** Чи стосується подія підписки: artist → artist_id у artists події; keyword → title або імена артистів. */
function matches(sub: Subscription, e: Event): boolean {
  if (sub.kind === 'artist') return sub.artist_id !== null && e.artists.some((a) => a.id === sub.artist_id)
  if (sub.kind === 'keyword') {
    const kw = (sub.keyword ?? '').trim().toLowerCase()
    if (kw.length < 2) return false
    return e.title.toLowerCase().includes(kw) || e.artists.some((a) => a.name.toLowerCase().includes(kw))
  }
  return false
}

/** Найближча майбутня подія з підписок, яку ще не закрили. */
function findHit(events: Event[], subscriptions: Subscription[], dismissed: number[]) {
  for (const e of events) {
    if (dismissed.includes(e.id) || e.status === 'cancelled') continue
    const sub = subscriptions.find((s) => matches(s, e))
    if (sub) return { event: e, label: sub.label || sub.keyword || e.artists[0]?.name || e.title }
  }
  return null
}

/** «Ти чекала на «…» — з’явився новий концерт». Лише залогіненим, закривається хрестиком. */
export function WaitedBanner() {
  const { user } = useAuth()
  const { subscriptions } = useSubscriptions()
  const [dismissed, setDismissed] = useState(readDismissed)

  const { data } = useQuery({
    queryKey: ['events', 'waited-banner'],
    queryFn: () => getEvents({ period: 'year', limit: 300 }),
    enabled: Boolean(user) && subscriptions.length > 0,
    staleTime: 5 * 60_000,
  })

  const hit = findHit(data?.items ?? [], subscriptions, dismissed)

  if (!user || !hit) return null

  const close = () => {
    const next = [...dismissed, hit.event.id]
    setDismissed(next)
    writeDismissed(next)
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-[26px] border-[1.5px] border-coral/45 bg-card px-3 py-3 shadow-soft sm:flex-nowrap sm:gap-4 sm:px-4"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral-deep" aria-hidden>
        <Bell size={18} />
      </span>
      <p className="min-w-0 flex-1 text-sm text-ink sm:text-[15px]">
        Ти чекала на «{hit.label}» — {NEW_THING[hit.event.category]}.
      </p>
      <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
        <Button to={`/event/${hit.event.id}`} className="flex-1 sm:flex-none">
          Дивитись подію
        </Button>
        <button
          type="button"
          onClick={close}
          aria-label="Закрити сповіщення"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-plum-soft transition hover:bg-plum/5 hover:text-plum"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
