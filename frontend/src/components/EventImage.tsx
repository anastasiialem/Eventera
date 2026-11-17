import { useState } from 'react'
import { cn } from '../lib/cn'
import { CATEGORY_PLACEHOLDER, normalizeCategory, photoCredit, pickEventImage } from '../lib/eventImage'
import type { Event } from '../types'

interface Props {
  event: Pick<Event, 'id' | 'category' | 'image_url' | 'title'> & Partial<Pick<Event, 'sources'>>
  /** Класи обгортки (розмір / позиціювання). Картинка заповнює її повністю. */
  className?: string
  /** Підпис «Фото: {джерело}» у куті — лише для офіційного фото (сторінка події) */
  caption?: boolean
  captionClassName?: string
  /** Фото над першим екраном: вантажити одразу, а не lazy */
  priority?: boolean
  /** Чисто декоративне фото (поруч уже є назва події) → alt="" */
  decorative?: boolean
}

/**
 * Фото події: image_url (офіційне) → якщо немає або не завантажилось — фото за категорією
 * (детерміноване від id) → якщо й воно впало — лишається градієнт-плейсхолдер.
 * Поки вантажиться — розмитий градієнт у тон категорії, потім плавна поява.
 */
export function EventImage({
  event,
  className,
  caption = false,
  captionClassName,
  priority = false,
  decorative = false,
}: Props) {
  const [officialFailed, setOfficialFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  const { src, official } = pickEventImage(event, officialFailed)
  const loaded = loadedSrc === src
  const credit =
    caption && official && loaded ? photoCredit({ image_url: event.image_url, sources: event.sources ?? [] }) : null

  // Дочірні шари — absolute; якщо позиціювання не задали ззовні, обгортка стає relative
  const positioned = /(^|\s)(absolute|fixed|relative|sticky)(\s|$)/.test(className ?? '')

  return (
    <div className={cn('overflow-hidden', !positioned && 'relative', className)}>
      <div
        aria-hidden
        className="absolute inset-0 scale-110 blur-xl"
        style={{ background: CATEGORY_PLACEHOLDER[normalizeCategory(event.category)] }}
      />
      {!(fallbackFailed && !official) && (
        <img
          key={src}
          src={src}
          alt={decorative ? '' : event.title}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          // кешоване фото може завантажитись раніше за onLoad — перевіряємо complete одразу
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0 && loadedSrc !== src) setLoadedSrc(src)
          }}
          onLoad={() => setLoadedSrc(src)}
          onError={() => (official ? setOfficialFailed(true) : setFallbackFailed(true))}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {credit && (
        <span
          className={cn(
            'pointer-events-none absolute z-10 max-w-[60%] truncate text-[10px] leading-none text-white/55',
            captionClassName ?? 'bottom-2 right-3',
          )}
        >
          Фото: {credit}
        </span>
      )}
    </div>
  )
}
