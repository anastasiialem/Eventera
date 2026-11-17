import { ArrowUpRight, Bell, BellRing, CalendarPlus, Share2 } from 'lucide-react'
import { logClick } from '../../lib/api'
import { cn } from '../../lib/cn'
import { formatPriceRange } from '../../lib/format'
import { downloadIcs } from '../../lib/ics'
import { shareEvent } from '../../lib/share'
import { useBell } from '../../lib/use-subscription-actions'
import type { Event, EventSource } from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toast-context'

/** Найдешевше джерело першим; без ціни — в кінці. */
function sortSources(sources: EventSource[]) {
  return [...sources]
    .filter((s) => s.url)
    .sort((a, b) => (a.price_min ?? Infinity) - (b.price_min ?? Infinity))
}

/** Ticket status bar. 'unknown' shows nothing: the site did not say. */
const AVAILABILITY: Partial<Record<Event['ticket_status'], { bar: string; label: string }>> = {
  available: { bar: 'w-[35%] bg-gradient-to-r from-lavender to-coral', label: 'Квитки є в продажу' },
  few_left: { bar: 'w-[85%] bg-gradient-to-r from-lavender to-coral', label: 'Мало квитків — поспішай' },
  sold_out: { bar: 'w-full bg-gradient-to-r from-lavender to-coral', label: 'Розпродано' },
}

/** «Купити на Karabas», але «Купити квитки» для «Сайт театру». */
const buyLabel = (source?: string) => (source && /^[A-Za-z0-9]/.test(source) ? `Купити на ${source}` : 'Купити квитки')

export function TicketsCard({ event, className }: { event: Event; className?: string }) {
  const toast = useToast()
  const bell = useBell(event)
  const [primary, ...others] = sortSources(event.sources)
  const buyUrl = primary?.url ?? event.ticket_url
  const soldOut = event.ticket_status === 'sold_out'
  const fewLeft = event.ticket_status === 'few_left'
  const availability = AVAILABILITY[event.ticket_status]

  const onCalendar = () => {
    downloadIcs(event)
    toast('Файл для календаря завантажено', { tone: 'success' })
  }

  return (
    <section aria-labelledby="tickets-title" className={cn('rounded-[28px] bg-card p-5 shadow-soft sm:p-6', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="tickets-title" className="font-sans text-sm font-normal text-plum-soft">
          Квитки
        </h2>
        {fewLeft && <Badge tone="few">Мало квитків</Badge>}
        {soldOut && <Badge tone="neutral">Розпродано</Badge>}
        {!fewLeft && !soldOut && event.is_new && <Badge tone="new">Нове</Badge>}
      </div>

      <p className="mt-2 font-display text-4xl leading-tight text-ink sm:text-[2.6rem]">{formatPriceRange(event)}</p>

      {availability && (
        <div className="mt-3">
          {/* Ticket sites publish only a status (in stock / few left / sold out), not how many
              tickets are sold, so the bar shows that status rather than an exact percentage. */}
          <div className="h-1.5 overflow-hidden rounded-full bg-plum/[.07]" aria-hidden>
            <div className={cn('h-full rounded-full', availability.bar)} />
          </div>
          <p className="mt-1.5 text-xs text-plum-soft">{availability.label}</p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {buyUrl ? (
          <Button
            href={buyUrl}
            variant="accent"
            size="lg"
            className="w-full"
            onClick={() => void logClick('ticket', event.id)}
          >
            {soldOut ? `Перевірити на ${primary?.source ?? 'сайті'}` : buyLabel(primary?.source)}
            <ArrowUpRight size={18} aria-hidden />
          </Button>
        ) : (
          <Button size="lg" variant="accent" className="w-full" disabled>
            Квитки ще не в продажу
          </Button>
        )}

        {others.length > 0 && (
          <p className="text-center text-xs text-plum-soft">
            Також на:{' '}
            {others.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ' · '}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void logClick('ticket', event.id)}
                  className="underline decoration-plum/30 underline-offset-2 hover:text-plum"
                >
                  {s.source}
                </a>
              </span>
            ))}
          </p>
        )}

        <button
          type="button"
          onClick={bell.toggle}
          aria-pressed={bell.active}
          disabled={bell.pending}
          className={cn(
            'flex h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-sm transition active:scale-[.98] disabled:opacity-70',
            bell.active
              ? 'bg-coral-soft text-coral-deep hover:brightness-[.98]'
              : 'border border-coral/40 bg-card text-coral-deep hover:bg-coral-soft/50',
          )}
        >
          {bell.active ? <BellRing size={18} aria-hidden /> : <Bell size={18} aria-hidden />}
          <span className="truncate">
            {bell.active
              ? bell.hasArtist
                ? 'Ти чекаєш на цього артиста'
                : 'Ти чекаєш на цю подію'
              : bell.hasArtist
                ? `Чекати на ${bell.name}`
                : 'Чекати на цю подію'}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12 px-3" onClick={onCalendar}>
            <CalendarPlus size={18} aria-hidden /> У календар
          </Button>
          <Button variant="outline" className="h-12 px-3 leading-tight" onClick={() => void shareEvent(event, toast)}>
            <Share2 size={18} aria-hidden /> Покликати друга
          </Button>
        </div>
      </div>
    </section>
  )
}
