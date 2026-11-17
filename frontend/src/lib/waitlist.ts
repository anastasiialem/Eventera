import type { Event, Subscription } from '../types'
import { lower } from './use-subscription-actions'

/** Найближча майбутня подія для запису списку (events відсортовані за датою). */
export function matchEvent(sub: Subscription, events: Event[]): Event | undefined {
  const label = lower(sub.label)
  const kw = lower(sub.keyword ?? sub.label)
  return events.find((e) => {
    if (sub.kind === 'event') return e.id === sub.event_id
    if (sub.kind === 'artist')
      return e.artists.some((a) => a.id === sub.artist_id || (label && lower(a.name) === label))
    return kw.length >= 2 && (lower(e.title).includes(kw) || e.artists.some((a) => lower(a.name).includes(kw)))
  })
}
