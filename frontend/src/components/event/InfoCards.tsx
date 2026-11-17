import { CalendarDays, MapPin, RefreshCw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatAgo, formatShortDate, formatTime } from '../../lib/format'
import type { Event } from '../../types'

function InfoCard({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3.5 rounded-card bg-card p-4 shadow-soft sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lavender-soft text-plum">
        <Icon size={20} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-plum-soft">{label}</p>
        <div className="mt-0.5 text-[0.95rem] leading-snug text-ink">{children}</div>
      </div>
    </div>
  )
}

const mapsUrl = (e: Event) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [e.venue_name, e.venue_address, 'Львів'].filter(Boolean).join(', '),
  )}`

/** Три картки під описом: Коли / Де / Джерело. */
export function InfoCards({ event }: { event: Event }) {
  const time = event.is_all_day
    ? 'весь день'
    : event.ends_at
      ? `${formatTime(event.starts_at)}–${formatTime(event.ends_at)}`
      : formatTime(event.starts_at)
  const source = event.sources[0]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <InfoCard icon={CalendarDays} label="Коли">
        <p>{formatShortDate(event.starts_at)}</p>
        <p>{time}</p>
      </InfoCard>

      <InfoCard icon={MapPin} label="Де">
        <p className="break-words">{event.venue_name ?? 'Місце уточнюємо'}</p>
        {event.venue_address && <p className="text-sm text-plum-soft">{event.venue_address}</p>}
        {(event.venue_name || event.venue_address) && (
          <a
            href={mapsUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline decoration-plum/40 underline-offset-2 hover:text-coral-deep"
          >
            Відкрити на мапі
          </a>
        )}
      </InfoCard>

      <InfoCard icon={RefreshCw} label="Джерело">
        {source ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-lg hover:text-coral-deep"
          >
            {source.source}
          </a>
        ) : (
          <p>Eventera</p>
        )}
        {event.first_seen_at && <p className="text-sm text-plum-soft">оновлено {formatAgo(event.first_seen_at)}</p>}
      </InfoCard>
    </div>
  )
}
