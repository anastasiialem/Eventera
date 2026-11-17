import { useQueryClient } from '@tanstack/react-query'
import { Bell, Loader2, MapPin, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { addSubscription, logClick, removeSubscription } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { cn } from '../lib/cn'
import { CATEGORY_LABEL, formatDay, formatMonth, formatPrice, formatWeekdayTime } from '../lib/format'
import { useSubscriptions } from '../lib/use-subscriptions'
import type { Event } from '../types'
import { EventImage } from './EventImage'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { DashedRings } from './ui/DashedRings'
import { useToast } from './ui/toast-context'

const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/** Дзвіночок: підписка на першого артиста події (немає артистів — на назву події як keyword). */
function useBell(event: Event) {
  const { user } = useAuth()
  const { subscriptions } = useSubscriptions()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [pending, setPending] = useState(false)

  const artist = event.artists[0]
  const name = artist?.name ?? event.title
  const current = subscriptions.find((s) =>
    artist ? s.artist_id === artist.id || lower(s.keyword) === lower(artist.name) : lower(s.keyword) === lower(event.title),
  )

  const toggle = async () => {
    if (!user) {
      toast('Зареєструйся, щоб отримати сповіщення про нові концерти')
      navigate(`/auth?mode=signup&next=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    if (pending) return
    setPending(true)
    try {
      if (current) {
        await removeSubscription(current.id)
        toast(`«${current.label || name}» прибрано зі списку «Я чекаю на…»`)
      } else {
        void logClick('subscribe', event.id)
        await addSubscription(name)
        toast(`«${name}» — у списку «Я чекаю на…». Повідомимо, щойно буде нова подія`, { tone: 'success' })
      }
      await queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не вдалося оновити список', { tone: 'error' })
    } finally {
      setPending(false)
    }
  }

  return { active: Boolean(current), pending, toggle, name }
}

async function shareEvent(event: Event, toast: ReturnType<typeof useToast>) {
  const url = `${window.location.origin}/event/${event.id}`
  if (navigator.share) {
    try {
      await navigator.share({ title: event.title, text: `${event.title} — у Львові`, url })
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast('Посилання скопійовано', { tone: 'success' })
  } catch {
    toast('Не вдалося скопіювати посилання', { tone: 'error' })
  }
}

/**
 * Картка афіші. Уся картка веде на /event/:id через «розтягнуте» посилання на назві
 * (after:inset-0), а кнопки лежать над ним (relative z-10) — тож вони не відкривають
 * сторінку події і не вкладені в <a>.
 */
export function EventCard({ event }: { event: Event }) {
  const toast = useToast()
  const bell = useBell(event)
  const ticketUrl = event.ticket_url ?? event.sources[0]?.url ?? null
  const source = event.sources[0]?.source

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card bg-card shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[16/10] shrink-0 overflow-hidden">
        <EventImage event={event} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" aria-hidden />
        <DashedRings rings={2} size={170} inner={60} className="absolute -right-12 -top-14 text-white/45" />
        <Badge tone="category" className="absolute left-4 top-4">
          {CATEGORY_LABEL[event.category]}
        </Badge>
        <div className="absolute bottom-3 left-4 right-4 flex items-end gap-2.5 text-white">
          <span className="font-pixel text-[3.5rem] font-black leading-[0.78]">{formatDay(event.starts_at)}</span>
          <span className="min-w-0 pb-0.5">
            <span className="block truncate font-display text-lg uppercase leading-tight tracking-wide">
              {formatMonth(event.starts_at)}
            </span>
            <span className="block text-xs text-white/75">{formatWeekdayTime(event)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 pb-5">
        <h3 className="line-clamp-2 font-display text-lg leading-snug">
          <Link
            to={`/event/${event.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-coral/70"
          >
            {event.title}
          </Link>
        </h3>

        {event.venue_name && (
          <p className="flex min-w-0 items-start gap-1.5 text-sm text-plum-soft">
            <MapPin size={14} className="mt-[3px] shrink-0" aria-hidden />
            <span className="truncate" title={event.venue_name}>
              {event.venue_name}
            </span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-base">{formatPrice(event)}</span>
          {event.badge === 'few_tickets' && <Badge tone="few">Мало квитків</Badge>}
          {event.badge === 'new' && <Badge tone="new">Нове</Badge>}
          {source && <span className="ml-auto text-xs text-plum/50">{source}</span>}
        </div>

        <div className="relative z-10 mt-auto flex items-center gap-2 pt-3">
          {ticketUrl ? (
            <Button href={ticketUrl} className="flex-1" onClick={() => void logClick('ticket', event.id)}>
              Квитки
            </Button>
          ) : (
            <Button className="flex-1" disabled>
              Квитки
            </Button>
          )}
          <Button
            icon
            variant={bell.active ? 'accent' : 'outline'}
            onClick={bell.toggle}
            disabled={bell.pending}
            aria-pressed={bell.active}
            aria-label={bell.active ? `Не чекати на «${bell.name}»` : `Чекати на «${bell.name}»`}
            title={bell.active ? 'Ти вже чекаєш — натисни, щоб прибрати' : 'Сповістити про нові події'}
            className={cn(bell.active && 'shadow-soft')}
          >
            {bell.pending ? (
              <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Bell size={18} fill={bell.active ? 'currentColor' : 'none'} />
            )}
          </Button>
          <Button icon variant="outline" onClick={() => void shareEvent(event, toast)} aria-label="Поділитися подією">
            <Share2 size={18} />
          </Button>
        </div>
      </div>
    </article>
  )
}
