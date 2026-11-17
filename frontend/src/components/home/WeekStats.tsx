import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { getStats } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { cn } from '../../lib/cn'
import { GelTile } from '../ui/GelTile'
import { Skeleton } from '../ui/Skeleton'

const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, '0')

interface StatProps {
  loading: boolean
  value: number
  label: string
  /** Гостю — одна, більша цифра, щоб плитка не виглядала порожньою */
  big?: boolean
  className?: string
}

function Stat({ loading, value, label, big = false, className }: StatProps) {
  return (
    <div className="text-center">
      {loading ? (
        <Skeleton className={cn('mx-auto w-20', big ? 'h-20' : 'h-14')} />
      ) : (
        <span className={cn(
            'block font-pixel font-black leading-[0.85]',
            big ? 'text-7xl sm:text-8xl' : 'text-6xl sm:text-7xl',
            className,
          )}>
          {pad2(value)}
        </span>
      )}
      <span className="mt-1 block text-xs text-plum-soft">{label}</span>
    </div>
  )
}

/**
 * «Цього тижня у Львові»: нові події за 7 днів; залогіненим — ще й події від артистів зі списку.
 * Гостю — лише одна (більша) цифра; вхід — кнопкою в хедері.
 */
export function WeekStats() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['stats', user?.id ?? null],
    queryFn: getStats,
    staleTime: 5 * 60_000,
  })

  return (
    <GelTile variant="neutral" className="rounded-tile">
      <section
        aria-labelledby="week-title"
        className="relative overflow-hidden rounded-[inherit] px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6"
      >
        <div className="flex items-start justify-end gap-3">
          <h2 id="week-title" className="pt-1 font-sans text-sm font-medium text-plum sm:text-[15px]">
            Цього тижня у Львові
          </h2>
          <Bell size={30} strokeWidth={1.5} className="shrink-0 text-plum-dark" aria-hidden />
        </div>

        {/* Чорний силует електрогітари (прозорий PNG). Цифри Doto перекривають її нижню частину, як на макеті. */}
        <img
          src="/images/guitar.png"
          alt=""
          width={448}
          height={160}
          draggable={false}
          className="pointer-events-none relative -mt-3 ml-0 h-auto w-[82%] max-w-[460px] select-none sm:-mt-5 sm:ml-1"
        />

        {/* -mt у % рахується від ширини блоку, тож перекриття масштабується разом із гітарою */}
        <div className="relative -mt-[min(11%,4rem)] flex items-end justify-end gap-4 sm:gap-5">
          <Stat
            loading={isLoading}
            value={data?.events_this_week ?? 0}
            label="нових подій"
            big={!user}
            className="text-plum"
          />
          {user && (
            <Stat
              loading={isLoading}
              value={data?.from_your_artists ?? 0}
              label="від твоїх артистів"
              className="text-coral-deep"
            />
          )}
        </div>
      </section>
    </GelTile>
  )
}
