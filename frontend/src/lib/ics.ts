// Файл .ics для кнопки «У календар» — генерується повністю на клієнті.
import type { Event } from '../types'

const TZ = 'Europe/Kyiv'
const DEFAULT_DURATION_MS = 2 * 3600 * 1000

/** 20261121T170000Z */
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Дата за Києвом як YYYYMMDD (+ addDays) — для подій «весь день». */
function kyivDate(d: Date, addDays = 0) {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d)
    .split('-')
    .map(Number)
  return new Date(Date.UTC(y, m - 1, day + addDays)).toISOString().slice(0, 10).replace(/-/g, '')
}

/** Екранування тексту за RFC 5545. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** Розрив довгих рядків (≤75 октетів; кирилиця — 2 байти, тож ріжемо по 36 символів). */
function fold(line: string) {
  const chars = [...line]
  if (chars.length <= 36) return line
  const parts: string[] = []
  for (let i = 0; i < chars.length; i += 36) parts.push(chars.slice(i, i + 36).join(''))
  return parts.join('\r\n ')
}

export function buildIcs(event: Event, pageUrl: string): string {
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + DEFAULT_DURATION_MS)
  const location = [event.venue_name, event.venue_address, 'Львів'].filter(Boolean).join(', ')
  const ticket = event.ticket_url ?? event.sources[0]?.url
  const description = [event.description, ticket && `Квитки: ${ticket}`, `Eventera: ${pageUrl}`]
    .filter(Boolean)
    .join('\n\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eventera//Lviv events//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:event-${event.id}@eventera`,
    `DTSTAMP:${utcStamp(new Date())}`,
    ...(event.is_all_day
      ? [`DTSTART;VALUE=DATE:${kyivDate(start)}`, `DTEND;VALUE=DATE:${kyivDate(event.ends_at ? end : start, 1)}`]
      : [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`]),
    `SUMMARY:${esc(event.title)}`,
    location && `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(description)}`,
    `URL:${pageUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(event.title)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean) as string[]

  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Завантажити .ics (на телефоні відкриється календар). */
export function downloadIcs(event: Event) {
  const pageUrl = `${window.location.origin}/event/${event.id}`
  const blob = new Blob([buildIcs(event, pageUrl)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `eventera-${event.slug || event.id}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
