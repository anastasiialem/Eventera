import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EventCard } from '../components/EventCard'
import { getEvent, getSimilar } from '../lib/api'
import { formatDay, formatMonth, formatPrice, formatWeekdayTime } from '../lib/format'

export default function EventPage() {
  const { id = '' } = useParams()
  const { data: event, isLoading } = useQuery({ queryKey: ['event', id], queryFn: () => getEvent(id) })
  const { data: similar = [] } = useQuery({ queryKey: ['similar', id], queryFn: () => getSimilar(id) })

  if (isLoading) return <p className="text-plum/60">Завантажуємо…</p>
  if (!event)
    return (
      <p>
        Подію не знайдено.{' '}
        <Link to="/" className="underline">
          До афіші
        </Link>
      </p>
    )

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm">
        <ArrowLeft size={16} /> Назад до афіші
      </Link>
      <div className="flex items-end gap-4 rounded-card bg-gradient-to-br from-plum to-plum-dark p-8 text-white">
        <span className="font-pixel text-8xl leading-none">{formatDay(event.starts_at)}</span>
        <span>
          <span className="block font-display text-3xl">{formatMonth(event.starts_at)}</span>
          <span className="text-sm opacity-80">{formatWeekdayTime(event)}</span>
        </span>
      </div>
      <h1 className="font-display text-4xl">{event.title}</h1>
      {event.description && <p className="max-w-2xl text-plum/80">{event.description}</p>}
      <p className="font-display text-2xl">{formatPrice(event)}</p>
      <p className="text-sm text-plum/70">{[event.venue_name, event.venue_address].filter(Boolean).join(' · ')}</p>

      {similar.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-3xl">Схожі події</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
