import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { getStats } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { Skeleton } from '../ui/Skeleton'
import { Guitar } from './Guitar'

const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, '0')

/** «Цього тижня у Львові»: нові події за 7 днів і події від артистів зі списку. */
export function WeekStats() {
  const { user } = useAuth()
  const location = useLocation()
  const { data, isLoading } = useQuery({ queryKey: ['stats', user?.id ?? null], queryFn: getStats, staleTime: 5 * 60_000 })
  const next = encodeURIComponent(location.pathname + location.search)

  return (
    <section
      aria-labelledby="week-title"
      className="relative overflow-hidden rounded-tile bg-card px-5 pb-5 pt-5 shadow-soft sm:px-7 sm:pt-6"
    >
      <div className="flex items-start justify-end gap-3">
        <h2 id="week-title" className="pt-1 font-sans text-sm font-medium text-plum sm:text-[15px]">
          Цього тижня у Львові
        </h2>
        <Bell size={30} strokeWidth={1.5} className="shrink-0 text-plum-dark" aria-hidden />
      </div>

      <Guitar className="pointer-events-none absolute left-2 top-6 w-[86%] max-w-[500px] text-plum-dark sm:left-4" />

      <div className="relative mt-16 flex items-end justify-end gap-4 sm:mt-24 sm:gap-5">
        <div className="text-center">
          {isLoading ? (
            <Skeleton className="mx-auto h-14 w-20" />
          ) : (
            <span className="block font-pixel text-6xl font-black leading-[0.85] text-plum sm:text-7xl">
              {pad2(data?.events_this_week ?? 0)}
            </span>
          )}
          <span className="mt-1 block text-xs text-plum-soft">нових подій</span>
        </div>
        <div className="text-center">
          {user ? (
            <>
              {isLoading ? (
                <Skeleton className="mx-auto h-14 w-20" />
              ) : (
                <span className="block font-pixel text-6xl font-black leading-[0.85] text-coral-deep sm:text-7xl">
                  {pad2(data?.from_your_artists ?? 0)}
                </span>
              )}
              <span className="mt-1 block text-xs text-plum-soft">від твоїх артистів</span>
            </>
          ) : (
            <>
              <Link
                to={`/auth?next=${next}`}
                className="relative z-10 block pb-1 font-display text-3xl leading-none text-coral-deep underline decoration-coral/50 underline-offset-4 transition hover:decoration-coral sm:text-4xl"
              >
                Увійди
              </Link>
              <span className="mt-1 block text-xs text-plum-soft">щоб бачити своїх артистів</span>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
