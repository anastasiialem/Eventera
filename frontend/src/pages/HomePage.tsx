import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
import { EventCard } from '../components/EventCard'
import { Button } from '../components/ui/Button'
import { EVENTS_PAGE_SIZE, getEvents } from '../lib/api'
import { useTelegramLink } from '../lib/use-telegram-link'
import type { EventFilters } from '../types'

/** «6 подій», «1 подія», «3 події» */
function eventsWord(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'подія'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'події'
  return 'подій'
}

export default function HomePage() {
  // Фільтри входять у queryKey: зміна фільтрів скидає пагінацію до першої сторінки.
  const filters: EventFilters = {}
  const telegram = useTelegramLink()

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['events', filters],
    queryFn: ({ pageParam }) => getEvents({ ...filters, offset: pageParam, limit: EVENTS_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length
      return last.items.length > 0 && next < last.total ? next : undefined
    },
  })

  const events = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  return (
    <div className="space-y-6">
      <section className="rounded-card bg-plum-dark px-6 py-12 text-white">
        <p className="font-script text-coral">see you tonight, Lviv</p>
        <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Всі події Львова в одному місці</h1>
        <Button variant="accent" className="mt-6" onClick={telegram.start} disabled={telegram.pending} aria-busy={telegram.pending}>
          {telegram.pending ? (
            <>
              <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> Прокидаємо бота…
            </>
          ) : (
            <>
              <Send size={18} /> Сповіщення в Telegram
            </>
          )}
        </Button>
      </section>

      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-3xl">Афіша</h2>
        {!isLoading && (
          <span className="text-sm text-plum/60">
            <span className="font-pixel">{total}</span> {eventsWord(total)}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-plum/60">Завантажуємо афішу…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="lg" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? (
                  <>
                    <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> Завантажуємо…
                  </>
                ) : (
                  'Показати ще події'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
