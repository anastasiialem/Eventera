import { useState } from 'react'
import type { Event } from '../types'

/** Детермінований номер 1..3 від id — однакове фото для події при кожному рендері. */
function categoryImage(e: Pick<Event, 'id' | 'category'>) {
  const s = String(e.id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return `/images/categories/${e.category}-${(h % 3) + 1}.jpg`
}

interface Props {
  event: Pick<Event, 'id' | 'category' | 'image_url' | 'title'>
  className?: string
}

/** image_url, якщо є й завантажився; інакше фото за категорією; інакше градієнт. */
export function EventImage({ event, className = '' }: Props) {
  const [stage, setStage] = useState<0 | 1 | 2>(event.image_url ? 0 : 1)
  const src = stage === 0 ? event.image_url! : categoryImage(event)

  if (stage === 2) {
    return <div className={`bg-gradient-to-br from-plum to-plum-dark ${className}`} aria-hidden />
  }
  return (
    <img
      src={src}
      alt={event.title}
      loading="lazy"
      className={`object-cover ${className}`}
      onError={() => setStage((s) => (s === 0 ? 1 : 2))}
    />
  )
}
