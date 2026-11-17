import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { logClick } from '../../lib/api'
import { formatDayMonth, plural } from '../../lib/format'
import { isPendingSub, lower } from '../../lib/use-subscription-actions'
import { matchEvent } from '../../lib/waitlist'
import type { Event, Subscription } from '../../types'
import { Skeleton } from '../ui/Skeleton'

const ticketUrl = (e: Event) =>
  [...e.sources].filter((s) => s.url).sort((a, b) => (a.price_min ?? Infinity) - (b.price_min ?? Infinity))[0]?.url ??
  e.ticket_url

interface Props {
  subscriptions: Subscription[]
  events: Event[]
  loading: boolean
  onRemove: (sub: Subscription) => void
}

export function WaitlistList({ subscriptions, events, loading, onRemove }: Props) {
  const reduce = useReducedMotion()
  const rows = subscriptions.map((sub) => ({ sub, event: matchEvent(sub, events) }))
  const withEvents = rows.filter((r) => r.event).length
  const n = subscriptions.length

  return (
    <section aria-labelledby="my-list" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="my-list" className="font-display text-3xl">
          Мій список
        </h2>
        {n > 0 && (
          <p className="text-sm text-plum-soft">
            {n} {plural(n, ['артист', 'артисти', 'артистів'])}
            {withEvents > 0 &&
              ` · ${withEvents} з ${plural(withEvents, ['новою подією', 'новими подіями', 'новими подіями'])}`}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Завантаження списку">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      ) : n === 0 ? (
        <div className="rounded-card border border-dashed border-line/20 bg-card/60 px-6 py-10 text-center">
          <p className="font-display text-xl text-ink">Поки порожньо</p>
          <p className="mt-2 text-sm text-plum-soft">
            Додай першого артиста вище або обери когось із популярних — і ми напишемо, щойно буде подія у Львові.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {rows.map(({ sub, event }) => {
              const pending = isPendingSub(sub)
              const url = event && ticketUrl(event)
              const fresh = event && (event.is_new || event.first_seen_at >= sub.created_at)
              return (
                <motion.li
                  key={lower(sub.label) || sub.id /* стабільний ключ: тимчасовий запис → збережений без перемонтування */}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
                  transition={{ duration: reduce ? 0 : 0.2 }}
                  className="flex items-center gap-3 rounded-card bg-card p-3 shadow-soft sm:gap-4 sm:p-4"
                >
                  <span
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#D9C6EC,#9A7DB8_60%,#7A5C94)] font-display text-xl text-white shadow-soft sm:h-14 sm:w-14"
                  >
                    {sub.label.trim().charAt(0).toUpperCase() || '?'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg text-ink sm:text-xl">{sub.label}</p>
                    {event ? (
                      <Link
                        to={`/event/${event.id}`}
                        className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-coral-deep hover:underline"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" aria-hidden />
                        <span className="truncate">
                          {fresh ? 'Нова подія' : 'Подія у Львові'} · {formatDayMonth(event.starts_at)}
                          {event.venue_name && `, ${event.venue_name}`}
                        </span>
                      </Link>
                    ) : (
                      <p className="mt-0.5 truncate text-sm text-plum-soft">
                        {pending ? 'Додаємо…' : 'Поки без анонсів у Львові · стежимо'}
                      </p>
                    )}
                  </div>

                  {event && url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void logClick('ticket', event.id)}
                      className="hidden h-10 shrink-0 items-center rounded-full bg-coral px-5 text-sm font-medium text-white transition hover:brightness-95 min-[420px]:inline-flex"
                    >
                      Квитки
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemove(sub)}
                    disabled={pending}
                    aria-label={`Прибрати «${sub.label}» зі списку`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lavender-soft/70 text-plum transition hover:bg-lavender-soft disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
                    ) : (
                      <X size={18} aria-hidden />
                    )}
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}
