import { useQuery } from '@tanstack/react-query'
import { EventCard } from '../components/EventCard'
import { getEvents } from '../lib/api'

export default function HomePage() {
  const { data: events = [], isLoading } = useQuery({ queryKey: ['events', {}], queryFn: () => getEvents() })

  return (
    <div className="space-y-6">
      <section className="rounded-card bg-plum-dark px-6 py-12 text-white">
        <p className="font-script text-coral">see you tonight, Lviv</p>
        <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Всі події Львова в одному місці</h1>
      </section>

      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-3xl">Афіша</h2>
        <span className="text-sm text-plum/60">
          <span className="font-pixel">{events.length}</span> подій
        </span>
      </div>

      {isLoading ? (
        <p className="text-plum/60">Завантажуємо афішу…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  )
}
