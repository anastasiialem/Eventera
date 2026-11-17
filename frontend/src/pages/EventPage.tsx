import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { EventCard } from '../components/EventCard'
import { DateHero } from '../components/event/DateHero'
import { InfoCards } from '../components/event/InfoCards'
import { DonateBlock, TelegramReminder } from '../components/event/SideBlocks'
import { TicketsCard } from '../components/event/TicketsCard'
import { Button } from '../components/ui/Button'
import { DashedRings } from '../components/ui/DashedRings'
import { Skeleton } from '../components/ui/Skeleton'
import { getEvent, getSimilar } from '../lib/api'

/** «Назад до афіші» зберігає фільтри: EventCard кладе в state.back шлях афіші з query. */
function useBackTo() {
  const { state } = useLocation() as { state: { back?: unknown } | null }
  const back = typeof state?.back === 'string' ? state.back : ''
  return back.startsWith('/') && !back.startsWith('//') && !back.startsWith('/event/') ? back : '/'
}

function BackLink({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full py-1 text-sm text-plum transition hover:text-coral-deep"
    >
      <ArrowLeft size={16} aria-hidden /> Назад до афіші
    </Link>
  )
}

function EventSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Завантаження події">
      <Skeleton className="h-5 w-36" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="space-y-5">
          <Skeleton className="aspect-[4/3] w-full rounded-[28px] sm:aspect-[16/7]" />
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-96 rounded-[28px]" />
      </div>
    </div>
  )
}

function EventNotFound({ backTo }: { backTo: string }) {
  return (
    <div className="space-y-6">
      <BackLink to={backTo} />
      <section className="relative isolate overflow-hidden rounded-card bg-card px-6 py-16 text-center shadow-soft sm:py-24">
        <DashedRings
          rings={4}
          size={420}
          className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 text-plum/15"
        />
        <h1 className="font-display text-3xl sm:text-4xl">Такої події не знайшли</h1>
        <p className="mx-auto mt-3 max-w-md text-plum/70">
          Можливо, її скасували, вона вже минула або посилання з помилкою. Зазирни в афішу — там ще багато всього
          у Львові.
        </p>
        <p aria-hidden className="mt-4 font-script text-coral">
          see you tonight, Lviv
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to={backTo}>До афіші</Button>
          <Button to="/waitlist" variant="outline">
            Я чекаю на…
          </Button>
        </div>
      </section>
    </div>
  )
}

export default function EventPage() {
  const { id = '' } = useParams()
  const backTo = useBackTo()
  const validId = /^\d+$/.test(id)

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id),
    enabled: validId,
  })
  const { data: similar = [] } = useQuery({
    queryKey: ['similar', id],
    queryFn: () => getSimilar(id),
    enabled: validId && Boolean(event),
  })

  useEffect(() => {
    if (!event) return
    const prev = document.title
    document.title = `${event.title} — eventera`
    return () => {
      document.title = prev
    }
  }, [event])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [id])

  if (validId && isLoading) return <EventSkeleton />
  if (!event) return <EventNotFound backTo={backTo} />

  return (
    <div className="space-y-5">
      <BackLink to={backTo} />

      {/* Мобільний: одна колонка, «Квитки» одразу під назвою (обгортки — display:contents + order).
          Десктоп: ліворуч контент, праворуч sticky-колонка. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="contents lg:block lg:space-y-8">
          <header className="order-1 space-y-4 lg:space-y-5">
            <DateHero event={event} />
            <h1 className="break-words font-display text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">{event.title}</h1>
          </header>

          <div className="order-3 space-y-6">
            {event.description?.trim() && (
              <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-plum/85 sm:text-lg">
                {event.description.trim()}
              </p>
            )}
            {event.artists.length > 0 && (
              <p className="text-sm text-plum-soft">
                Виступають: <span className="text-ink">{event.artists.map((a) => a.name).join(', ')}</span>
              </p>
            )}
            <InfoCards event={event} />
          </div>

          {similar.length > 0 && (
            <section className="order-5 space-y-4 pt-2" aria-labelledby="similar-title">
              <h2 id="similar-title" className="font-display text-3xl sm:text-4xl">
                Схожі події
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {similar.map((e) => (
                  <EventCard key={e.id} event={e} backTo={backTo} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="contents lg:sticky lg:top-6 lg:block lg:space-y-4">
          <TicketsCard event={event} className="order-2" />
          <div className="order-4 space-y-4">
            <TelegramReminder />
            <DonateBlock />
          </div>
        </aside>
      </div>
    </div>
  )
}
