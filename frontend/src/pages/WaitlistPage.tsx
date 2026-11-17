import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { WaitlistAdd, type ArtistOption } from '../components/waitlist/WaitlistAdd'
import { WaitlistList } from '../components/waitlist/WaitlistList'
import { AccountCard, NotifyPrefsCard, TelegramCard } from '../components/waitlist/WaitlistSide'
import { getEvents } from '../lib/api'
import { useSubscriptionActions } from '../lib/use-subscription-actions'
import { useSubscriptions } from '../lib/use-subscriptions'

/** Скільки майбутніх подій беремо для статусів і автопідказок. */
const UPCOMING_LIMIT = 500

export default function WaitlistPage() {
  const { subscriptions, isLoading } = useSubscriptions()
  const { add, remove } = useSubscriptionActions()
  const { data: upcoming } = useQuery({
    queryKey: ['events', 'upcoming', UPCOMING_LIMIT],
    queryFn: () => getEvents({ limit: UPCOMING_LIMIT }),
    staleTime: 5 * 60_000,
  })
  const events = useMemo(() => upcoming?.items ?? [], [upcoming])

  /** Унікальні артисти наявних подій — для автопідказок. */
  const artists = useMemo(() => {
    const map = new Map<number, ArtistOption>()
    for (const e of events) for (const a of e.artists) if (!map.has(a.id)) map.set(a.id, { id: a.id, name: a.name })
    return [...map.values()]
  }, [events])

  useEffect(() => {
    const prev = document.title
    document.title = 'Я чекаю на… — eventera'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <header className="relative pt-8 sm:pt-10">
          <p
            aria-hidden
            className="absolute -left-1 top-0 -rotate-6 font-script text-xl text-coral-deep sm:-left-8 sm:text-2xl"
          >
            your waitlist
          </p>
          <h1 className="font-display text-5xl leading-tight sm:text-6xl">Я чекаю на…</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-plum/80">
            Додай артистів, гурти чи театри. Щойно хтось із них оголосить подію у Львові — напишемо тобі в Telegram.
          </p>
        </header>

        <WaitlistAdd artists={artists} subscriptions={subscriptions} onAdd={add} />
        <WaitlistList subscriptions={subscriptions} events={events} loading={isLoading} onRemove={remove} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <TelegramCard />
        <NotifyPrefsCard />
        <AccountCard />
      </aside>
    </div>
  )
}
