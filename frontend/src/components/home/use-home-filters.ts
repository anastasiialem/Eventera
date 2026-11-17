import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { EventCategory, EventFilters, Period, When } from '../../types'

/** Значення селекта «Будь-яка ціна» (і пілюль «До 300 ₴» / «Безкоштовно» в hero). */
export type PriceOption = '' | '300' | '500' | '1000' | 'free'

export const DEFAULT_PERIOD: Period = 'month'

const PERIODS: Period[] = ['week', 'month', 'season', 'year']
const CATEGORIES: EventCategory[] = ['concert', 'theatre', 'festival', 'opera', 'other']
const PRICES: PriceOption[] = ['300', '500', '1000', 'free']
const WHENS: When[] = ['today', 'weekend']

export interface HomeFilterState {
  q: string
  /** null, коли активний швидкий фільтр when — тоді жоден сегмент не підсвічений */
  period: Period | null
  when: When | null
  category: EventCategory | null
  price: PriceOption
  genre: string
}

const pick = <T extends string>(v: string | null, allowed: readonly T[]): T | null =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : null

/**
 * Усі фільтри головної живуть у query params:
 *   ?q=&period=week|month|season|year&when=today|weekend&cat=&price=300|500|1000|free&genre=<slug>
 * period за замовчуванням — «Цей місяць» (як на макеті) і в URL не пишеться.
 */
export function useHomeFilters() {
  const [params, setParams] = useSearchParams()

  const state: HomeFilterState = useMemo(() => {
    const when = pick(params.get('when'), WHENS)
    return {
      q: params.get('q') ?? '',
      when,
      period: when ? null : (pick(params.get('period'), PERIODS) ?? DEFAULT_PERIOD),
      category: pick(params.get('cat'), CATEGORIES),
      price: pick(params.get('price'), PRICES) ?? '',
      genre: params.get('genre') ?? '',
    }
  }, [params])

  const filters: EventFilters = useMemo(
    () => ({
      q: state.q.trim() || undefined,
      when: state.when ?? undefined,
      period: state.period ?? undefined,
      category: state.category ?? undefined,
      free: state.price === 'free' || undefined,
      price_max: state.price && state.price !== 'free' ? Number(state.price) : undefined,
      genre: state.genre || undefined,
    }),
    [state],
  )

  /** Оновити кілька параметрів; null / '' — прибрати з URL. */
  const update = useCallback(
    (patch: Partial<Record<'q' | 'period' | 'when' | 'cat' | 'price' | 'genre', string | null>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || v === '') next.delete(k)
            else next.set(k, v)
          }
          if (next.get('period') === DEFAULT_PERIOD) next.delete('period')
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true, preventScrollReset: true }), [setParams])

  const isFiltered =
    Boolean(state.q || state.when || state.category || state.price || state.genre) ||
    (state.period !== null && state.period !== DEFAULT_PERIOD)

  return { state, filters, update, reset, isFiltered }
}

export const AFISHA_ID = 'afisha'

export function scrollToAfisha() {
  const el = document.getElementById(AFISHA_ID)
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}
