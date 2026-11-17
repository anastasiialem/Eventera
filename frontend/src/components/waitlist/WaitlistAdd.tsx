import { Check, Plus } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { findSubscription, lower } from '../../lib/use-subscription-actions'
import { FREE_LIMIT } from '../../lib/vip'
import { useVip } from '../../lib/vip-context'
import type { Subscription } from '../../types'

const POPULAR = ['МУР', 'ТНМК', 'Latexfauna', 'sadsvit', 'Океан Ельзи', 'Антитіла']

export interface ArtistOption {
  id: number
  name: string
}

interface Props {
  /** Артисти з наявних подій — для автопідказок і точного artist_id */
  artists: ArtistOption[]
  subscriptions: Subscription[]
  onAdd: (name: string, artistId?: number) => boolean
}

/** Інпут «Артист, гурт або театр…» з автопідказками + чипи популярних. */
export function WaitlistAdd({ artists, subscriptions, onAdd }: Props) {
  const { isVip, openVip } = useVip()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const inputId = useId()

  const byName = useMemo(() => new Map(artists.map((a) => [lower(a.name), a])), [artists])

  const suggestions = useMemo(() => {
    const q = lower(value)
    if (q.length < 1) return []
    return artists
      .filter((a) => lower(a.name).includes(q) && !findSubscription(subscriptions, a.name, a.id))
      .sort((a, b) => Number(!lower(b.name).startsWith(q)) - Number(!lower(a.name).startsWith(q)) || a.name.localeCompare(b.name, 'uk'))
      .slice(0, 6)
  }, [value, artists, subscriptions])

  const showList = open && suggestions.length > 0

  const submit = (name: string, artistId?: number) => {
    const known = artistId ?? byName.get(lower(name))?.id
    if (onAdd(byName.get(lower(name))?.name ?? name, known)) {
      setValue('')
      setActive(-1)
      setOpen(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (showList && active >= 0) submit(suggestions[active].name, suggestions[active].id)
    else submit(value)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div className="rounded-[28px] bg-card p-4 shadow-soft sm:p-6">
      <form onSubmit={onSubmit} className="flex gap-2 sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            Артист, гурт або театр
          </label>
          <input
            id={inputId}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setOpen(true)
              setActive(-1)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
            placeholder="Артист, гурт або театр…"
            autoComplete="off"
            maxLength={100}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
            className="h-12 w-full rounded-full border border-line/15 bg-white/70 px-5 text-base text-ink placeholder:text-plum/45 focus:border-plum/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/50 focus-visible:ring-offset-0"
          />
          {showList && (
            <ul
              id={listId}
              role="listbox"
              className="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl border border-line/10 bg-card py-1.5 shadow-lift"
            >
              {suggestions.map((a, i) => (
                <li
                  key={a.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => submit(a.name, a.id)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 px-5 py-2.5 text-sm',
                    i === active ? 'bg-powder text-ink' : 'text-plum',
                  )}
                >
                  <span className="truncate">{a.name}</span>
                  <span className="shrink-0 text-xs text-coral-deep">є подія у Львові</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-plum px-4 text-sm font-medium text-white transition hover:bg-plum-dark active:scale-[.97] sm:px-6"
        >
          <Plus size={18} aria-hidden /> Додати
        </button>
      </form>

      {!isVip && (
        <p className="mt-3 px-1 text-xs text-plum-soft">
          <span className="font-medium text-plum">
            {Math.min(subscriptions.length, FREE_LIMIT)} / {FREE_LIMIT}
          </span>{' '}
          у безкоштовному тарифі ·{' '}
          <button type="button" onClick={() => openVip()} className="font-medium text-plum underline underline-offset-2">
            VIP — без обмежень
          </button>
        </p>
      )}

      <p className="mb-2.5 mt-4 text-xs text-plum-soft">Найчастіше чекають студенти Львова:</p>
      <div className="flex flex-wrap gap-2">
        {POPULAR.map((name) => {
          const artist = byName.get(lower(name))
          const added = Boolean(findSubscription(subscriptions, name, artist?.id))
          return (
            <button
              key={name}
              type="button"
              disabled={added}
              onClick={() => submit(name, artist?.id)}
              title={artist ? 'Є подія у Львові' : undefined}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition active:scale-[.97]',
                added
                  ? 'border-transparent bg-lavender-soft text-plum'
                  : 'border-line/15 bg-card text-plum hover:border-line/35',
                artist && 'font-semibold text-ink',
              )}
            >
              {added ? <Check size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
              {name}
              <span className="sr-only">{added ? ' — уже в списку' : ' — додати'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
