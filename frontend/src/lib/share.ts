import type { ShowToast } from '../components/ui/toast-context'
import type { Event } from '../types'

/** «Покликати друга»: Web Share API, інакше — копіюємо посилання. */
export async function shareEvent(event: Pick<Event, 'id' | 'title'>, toast: ShowToast) {
  const url = `${window.location.origin}/event/${event.id}`
  if (navigator.share) {
    try {
      await navigator.share({ title: event.title, text: `${event.title} — у Львові. Ходімо разом?`, url })
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast('Посилання скопійовано — надішли другу', { tone: 'success' })
  } catch {
    toast('Не вдалося скопіювати посилання', { tone: 'error' })
  }
}
