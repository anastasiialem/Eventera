import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HERO_EVENT_SLIDES, HERO_INTERVAL_MS, HERO_PHOTOS } from '../../config/hero'
import { getEvents } from '../../lib/api'
import { cn } from '../../lib/cn'
import { formatDayMonth } from '../../lib/format'

interface Slide {
  src: string
  /** Для фото події — підпис-посилання */
  event?: { id: number; title: string; starts_at: string }
}

/** Найближчі події з офіційним фото (якщо бекенд/Supabase недоступні — просто без них). */
function useEventSlides(): Slide[] {
  const { data } = useQuery({
    queryKey: ['hero-event-slides'],
    queryFn: () => getEvents({ limit: 12, offset: 0 }),
    staleTime: 10 * 60_000,
  })
  return useMemo(
    () =>
      (data?.items ?? [])
        .filter((e) => e.image_url && e.status !== 'cancelled')
        .slice(0, HERO_EVENT_SLIDES)
        .map((e) => ({ src: e.image_url!, event: { id: e.id, title: e.title, starts_at: e.starts_at } })),
    [data],
  )
}

/** true, поки вкладка видима (document.visibilityState) */
function usePageVisible() {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  )
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

/**
 * Фото-фон hero: crossfade 1.2 с кожні 6 с, легкий Ken Burns, темний оверлей,
 * предзавантаження наступного фото, пауза у фоновій вкладці, крапки-індикатори.
 * prefers-reduced-motion → без Ken Burns (index.css). Рендериться всередині relative-контейнера hero.
 */
export function HeroSlideshow() {
  const eventSlides = useEventSlides()
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const slides = useMemo<Slide[]>(
    () => [...HERO_PHOTOS.map((src) => ({ src })), ...eventSlides].filter((s) => !failed.has(s.src)),
    [eventSlides, failed],
  )

  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  /** Слайди, яким уже дозволено вантажитись: поточний + наступний (предзавантаження) */
  const [loadable, setLoadable] = useState<ReadonlySet<string>>(() => new Set(HERO_PHOTOS.slice(0, 2)))
  const [hovered, setHovered] = useState(false)
  const visible = usePageVisible()

  const count = slides.length
  const current = count ? index % count : 0
  const next = count ? (current + 1) % count : 0

  const go = (to: number) => {
    if (to === current) return
    setPrev(current)
    setIndex(to)
  }

  // Предзавантаження наступного фото (і поточного — на випадок, якщо список змінився)
  const nextSrc = slides[next]?.src
  const currentSrc = slides[current]?.src
  if ((nextSrc && !loadable.has(nextSrc)) || (currentSrc && !loadable.has(currentSrc))) {
    const add = new Set(loadable)
    if (nextSrc) add.add(nextSrc)
    if (currentSrc) add.add(currentSrc)
    setLoadable(add)
  }

  // Автоперемикання; пауза, коли вкладка неактивна
  useEffect(() => {
    if (count < 2 || !visible || hovered) return
    const t = window.setTimeout(() => {
      setPrev(current)
      setIndex((current + 1) % count)
    }, HERO_INTERVAL_MS)
    return () => window.clearTimeout(t)
  }, [count, current, visible, hovered])

  const active = slides[current]

  return (
    <>
      <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
        {slides.map((s, i) => {
          const isCurrent = i === current
          const isLeaving = i === prev && !isCurrent
          return (
            <img
              key={s.src}
              src={loadable.has(s.src) ? s.src : undefined}
              alt=""
              decoding="async"
              fetchPriority={i === 0 ? 'high' : 'low'}
              referrerPolicy="no-referrer"
              onError={() => setFailed((f) => new Set(f).add(s.src))}
              className={cn(
                'hero-slide absolute inset-0 h-full w-full object-cover will-change-[opacity,transform]',
                isCurrent ? 'opacity-100' : 'opacity-0',
                // Ken Burns лишається на слайді, що згасає, — щоб не «стрибав» масштаб під час crossfade
                (isCurrent || isLeaving) && 'ken-burns',
              )}
            />
          )
        })}
      </div>

      {/* Темний оверлей: заголовок угорі й пошук унизу читаються на будь-якому фото */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(14,8,12,.55)_0%,rgba(14,8,12,.25)_38%,rgba(14,8,12,.55)_62%,rgba(8,4,7,.92)_100%)]"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />

      {count > 1 && (
        <div
          className="absolute left-5 top-6 z-10 flex max-w-[60%] flex-col items-start sm:left-7 lg:top-8"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="flex shrink-0 items-center" role="group" aria-label="Фото в шапці">
            {slides.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => go(i)}
                aria-label={`Фото ${i + 1} з ${count}`}
                aria-current={i === current ? 'true' : undefined}
                className="flex h-6 w-3.5 items-center justify-center rounded-full focus-visible:ring-offset-0 sm:w-5"
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-[opacity,transform] duration-300',
                    // активна — коралова, як крапка біля заголовка на макеті
                    i === current ? 'scale-[1.35] bg-coral opacity-100' : 'bg-white opacity-50',
                  )}
                />
              </button>
            ))}
          </div>
          {active?.event && (
            <Link
              to={`/event/${active.event.id}`}
              className="ml-1 max-w-full truncate rounded-full bg-black/35 px-2.5 py-0.5 text-[11px] text-white/90 backdrop-blur transition-opacity hover:opacity-80 sm:text-xs"
            >
              {active.event.title} · {formatDayMonth(active.event.starts_at)}
            </Link>
          )}
        </div>
      )}
    </>
  )
}
