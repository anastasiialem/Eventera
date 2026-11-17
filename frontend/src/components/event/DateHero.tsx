import { CATEGORY_LABEL, formatDay, formatMonth, formatTime, formatWeekday } from '../../lib/format'
import type { Event } from '../../types'
import { DashedRings } from '../ui/DashedRings'
import { EventImage } from '../EventImage'

const STATUS_LABEL = { postponed: 'Перенесено', cancelled: 'Скасовано' } as const

/** Великий блок дати (design/07-event.jpg): сливовий градієнт, пунктирні дуги, «don't miss it». */
export function DateHero({ event }: { event: Event }) {
  const when = event.is_all_day ? 'весь день' : `початок о ${formatTime(event.starts_at)}`
  const status = event.status !== 'scheduled' ? STATUS_LABEL[event.status] : null

  return (
    <div className="relative isolate flex aspect-[4/3] flex-col overflow-hidden rounded-[28px] bg-plum-dark p-5 text-white shadow-lift sm:aspect-[16/7] sm:p-8 lg:rounded-[32px]">
      {/* Фото: офіційне image_url або за категорією. Без z-index — щоб підпис «Фото: …» (z-10) був над оверлеєм */}
      <EventImage
        event={event}
        decorative
        priority
        caption
        captionClassName="right-5 top-3 sm:right-8 sm:top-4"
        className="absolute inset-0"
      />
      {/* сливовий градієнт поверх фото — текст читається завжди */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 90% at 85% 0%, rgb(140 100 128 / .45), transparent 70%), linear-gradient(160deg, rgb(74 42 63 / .72) 0%, rgb(46 27 40 / .95) 100%)',
        }}
      />
      {/* пунктирні дуги вгорі праворуч */}
      <DashedRings
        rings={3}
        size={520}
        inner={42}
        strokeWidth={1.6}
        className="absolute -right-[18%] -top-[45%] h-[150%] w-auto text-white/35 sm:-right-[8%] sm:-top-[38%] sm:h-[135%]"
      />

      <div className="relative flex flex-wrap gap-2">
        <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm backdrop-blur-sm">
          {CATEGORY_LABEL[event.category]}
        </span>
        {event.genres.slice(0, 2).map((g) => (
          <span key={g.slug} className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm backdrop-blur-sm">
            {g.name}
          </span>
        ))}
        {status && (
          <span className="rounded-full bg-coral px-3.5 py-1.5 text-sm font-medium text-plum-dark">{status}</span>
        )}
      </div>

      <div className="relative mt-auto flex items-end gap-3 sm:gap-5">
        <span className="font-pixel text-[5.5rem] font-black leading-[0.75] sm:text-[8.5rem] lg:text-[10rem]">
          {formatDay(event.starts_at)}
        </span>
        <span className="min-w-0 pb-1 sm:pb-2">
          <span className="block font-display text-2xl leading-tight sm:text-4xl">{formatMonth(event.starts_at)}</span>
          <span className="mt-1 block text-sm text-white/80 sm:text-base">
            {formatWeekday(event.starts_at)} · {when}
          </span>
        </span>
      </div>

      <span
        aria-hidden
        className="absolute bottom-5 right-5 hidden -rotate-6 font-script text-lg text-coral sm:block lg:bottom-8 lg:right-9 lg:text-2xl"
      >
        don&apos;t miss it
      </span>
    </div>
  )
}
