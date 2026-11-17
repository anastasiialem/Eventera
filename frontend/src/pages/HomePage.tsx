import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Loader2, RotateCcw, SearchX } from 'lucide-react'
import { EventCard } from '../components/EventCard'
import { AfishaFilters } from '../components/home/AfishaFilters'
import { Hero } from '../components/home/Hero'
import { HomeTiles } from '../components/home/HomeTiles'
import { AFISHA_ID, useHomeFilters } from '../components/home/use-home-filters'
import { WaitedBanner } from '../components/home/WaitedBanner'
import { WeekStats } from '../components/home/WeekStats'
import { SupportActions } from '../components/SupportActions'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EventCardSkeleton } from '../components/ui/Skeleton'
import { EVENTS_PAGE_SIZE, getEvents, getLastUpdated } from '../lib/api'

/** Пунктирні «з’єднання» між hero і правою колонкою (тільки декор, лише на десктопі). */
function Connectors() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      fill="none"
      className="pointer-events-none absolute inset-0 hidden h-full w-full text-plum/30 lg:block"
    >
      <g stroke="currentColor" strokeWidth={1.2} strokeDasharray="5 6" vectorEffect="non-scaling-stroke">
        <path d="M500 345 C 525 340, 540 320, 556 296" vectorEffect="non-scaling-stroke" />
        <path d="M500 405 L 556 400" vectorEffect="non-scaling-stroke" />
        <path d="M535 335 C 560 330, 590 318, 640 318" vectorEffect="non-scaling-stroke" />
        <path d="M770 336 L 790 336" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}

export default function HomePage() {
  // Фільтри з URL входять у queryKey: зміна фільтрів скидає пагінацію до першої сторінки.
  const { filters, reset, isFiltered } = useHomeFilters()

  const { data, isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage, dataUpdatedAt } =
    useInfiniteQuery({
      queryKey: ['events', filters],
      queryFn: ({ pageParam }) => getEvents({ ...filters, offset: pageParam, limit: EVENTS_PAGE_SIZE }),
      initialPageParam: 0,
      getNextPageParam: (last) => {
        const next = last.offset + last.items.length
        return last.items.length > 0 && next < last.total ? next : undefined
      },
    })
  const { data: lastUpdated } = useQuery({ queryKey: ['events-last-updated'], queryFn: getLastUpdated, staleTime: 5 * 60_000 })

  const events = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  return (
    <div>
      <div className="relative xl:-mx-12">
        <Connectors />
        <div className="relative grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
          <Hero />
          <div className="flex flex-col gap-4 sm:gap-5 lg:pt-1.5">
            <WeekStats />
            <HomeTiles />
            <SupportActions />
          </div>
        </div>
      </div>

      <section id={AFISHA_ID} aria-labelledby="afisha-title" className="scroll-mt-20 space-y-6 pt-14 sm:pt-16">
        <AfishaFilters total={total} loading={isLoading} updatedAt={lastUpdated ?? (dataUpdatedAt || null)} />

        <WaitedBanner />

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
            <p className="font-display text-2xl text-ink">Не вдалося завантажити афішу</p>
            <p className="text-sm text-plum-soft">Перевір з’єднання з інтернетом і спробуй ще раз.</p>
            <Button onClick={() => void refetch()} disabled={isRefetching}>
              {isRefetching ? <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> : <RotateCcw size={18} />}
              Спробувати ще
            </Button>
          </Card>
        ) : events.length === 0 ? (
          <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lavender-soft text-plum" aria-hidden>
              <SearchX size={24} />
            </span>
            <p className="font-display text-2xl text-ink">Нічого не знайшли — спробуй інший фільтр</p>
            {isFiltered && (
              <Button variant="outline" onClick={reset}>
                Скинути фільтри
              </Button>
            )}
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
            {hasNextPage && (
              <div className="flex justify-center pt-4">
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
      </section>
    </div>
  )
}
