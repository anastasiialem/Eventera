import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CATEGORY_LABEL, formatDay, formatMonth, formatPrice, formatWeekdayTime } from '../lib/format'
import type { Event } from '../types'
import { EventImage } from './EventImage'
import { Badge } from './ui/Badge'

export function EventCard({ event }: { event: Event }) {
  return (
    <Link
      to={`/event/${event.id}`}
      className="group block overflow-hidden rounded-card bg-card shadow-soft transition-transform hover:-translate-y-1"
    >
      <div className="relative h-44">
        <EventImage event={event} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <Badge tone="category" className="absolute left-4 top-4">
          {CATEGORY_LABEL[event.category]}
        </Badge>
        <div className="absolute bottom-3 left-4 flex items-end gap-2 text-white">
          <span className="font-pixel text-5xl leading-none">{formatDay(event.starts_at)}</span>
          <span className="pb-1">
            <span className="block font-display uppercase">{formatMonth(event.starts_at)}</span>
            <span className="block text-xs opacity-80">{formatWeekdayTime(event)}</span>
          </span>
        </div>
      </div>
      <div className="space-y-2 p-4">
        <h3 className="font-display text-lg leading-snug">{event.title}</h3>
        {event.venue_name && (
          <p className="flex items-center gap-1 text-sm text-plum-soft">
            <MapPin size={14} /> {event.venue_name}
          </p>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-display">{formatPrice(event)}</span>
          {event.badge === 'few_tickets' && (
            <Badge tone="few">Мало квитків</Badge>
          )}
          {event.badge === 'new' && <Badge tone="new">Нове</Badge>}
          {event.sources[0] && <span className="ml-auto text-xs text-plum/50">{event.sources[0].source}</span>}
        </div>
      </div>
    </Link>
  )
}
