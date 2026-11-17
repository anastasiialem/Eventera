import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { getGenres } from '../../lib/api'
import { cn } from '../../lib/cn'
import { eventsWord, formatAgo } from '../../lib/format'
import type { EventCategory } from '../../types'
import { Pill, Segment } from '../ui/Pill'
import { Skeleton } from '../ui/Skeleton'
import { useHomeFilters, type PeriodOption, type PriceOption } from './use-home-filters'

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: 'all', label: 'Усі' },
  { value: 'week', label: 'Цей тиждень' },
  { value: 'month', label: 'Цей місяць' },
  { value: 'season', label: 'Сезон' },
  { value: 'year', label: 'Рік' },
]

const CATEGORY_PILLS: { value: EventCategory | null; label: string }[] = [
  { value: null, label: 'Усі' },
  { value: 'concert', label: 'Концерти' },
  { value: 'theatre', label: 'Театр' },
  { value: 'festival', label: 'Фестивалі' },
  { value: 'opera', label: 'Опера' },
  { value: 'other', label: 'Інше' },
]

const PRICE_OPTIONS: { value: PriceOption; label: string }[] = [
  { value: '', label: 'Будь-яка ціна' },
  { value: '300', label: 'До 300 ₴' },
  { value: '500', label: 'До 500 ₴' },
  { value: '1000', label: 'До 1000 ₴' },
  { value: 'free', label: 'Безкоштовно' },
]

/** Нативний select у вигляді пілюлі (доступний з клавіатури й зручний на мобільному). */
function SelectPill({
  label,
  value,
  onChange,
  active,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  active: boolean
  children: ReactNode
}) {
  return (
    <label className="relative inline-flex shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 cursor-pointer appearance-none rounded-full border bg-card pl-4 pr-9 text-sm text-plum shadow-soft transition',
          active ? 'border-plum/40' : 'border-line/10 hover:border-line/30',
        )}
      >
        {children}
      </select>
      <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-plum" />
    </label>
  )
}

/** «оновлено X хв тому», перераховується щохвилини. */
function useAgo(iso: string | number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  return iso ? formatAgo(iso, now) : null
}

interface Props {
  total: number
  loading: boolean
  /** max(event_sources.last_seen_at) або час запиту */
  updatedAt: string | number | null
}

/** Заголовок «Афіша» + лічильник, сегмент періоду, пілюлі категорій, селекти ціни й жанру. */
export function AfishaFilters({ total, loading, updatedAt }: Props) {
  const { state, update } = useHomeFilters()
  const ago = useAgo(updatedAt)
  const { data: genres = [] } = useQuery({ queryKey: ['genres'], queryFn: getGenres, staleTime: 30 * 60_000 })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="afisha-title" className="text-4xl sm:text-5xl">
            Афіша
          </h2>
          <p className="mt-2 flex h-6 items-center gap-1.5 text-sm text-plum-soft" aria-live="polite">
            {loading ? (
              <Skeleton className="h-4 w-44" />
            ) : (
              <>
                <span className="font-pixel text-lg font-black leading-none text-plum">{total}</span>
                <span>
                  {eventsWord(total)}
                  {ago && ` · оновлено ${ago}`}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
          <Segment
            label="Період"
            options={PERIOD_OPTIONS}
            value={(state.period ?? '') as PeriodOption}
            onChange={(period) => update({ period, when: null })}
          />
        </div>
      </div>

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0 lg:overflow-visible">
        <div role="group" aria-label="Категорія" className="flex gap-2">
          {CATEGORY_PILLS.map((c) => (
            <Pill key={c.label} active={state.category === c.value} onClick={() => update({ cat: c.value })}>
              {c.label}
            </Pill>
          ))}
        </div>
        <div className="ml-auto flex gap-2 pl-2">
          <SelectPill label="Ціна" value={state.price} active={Boolean(state.price)} onChange={(v) => update({ price: v })}>
            {PRICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectPill>
          <SelectPill label="Жанр" value={state.genre} active={Boolean(state.genre)} onChange={(v) => update({ genre: v })}>
            <option value="">Усі жанри</option>
            {genres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
            {/* жанр з URL, якого ще немає в списку — щоб select не показував чуже значення */}
            {state.genre && !genres.some((g) => g.slug === state.genre) && <option value={state.genre}>{state.genre}</option>}
          </SelectPill>
        </div>
      </div>
    </div>
  )
}
