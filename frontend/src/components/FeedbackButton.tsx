import { MessageCircleHeart, X } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { sendFeedback } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { cn } from '../lib/cn'
import { VIP_PRICE } from '../lib/vip'
import type { WouldPay } from '../types'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { useToast } from './ui/toast-context'

const PROMPT_DELAY_MS = 2 * 60_000
/** Пропонуємо відгук лише новим акаунтам (зареєструвались до 7 днів тому). */
const PROMPT_WINDOW_MS = 7 * 24 * 3600_000
const promptKey = (uid: string) => `eventera:feedback-prompted:${uid}`

function wasPrompted(uid: string) {
  try {
    return localStorage.getItem(promptKey(uid)) !== null
  } catch {
    return true // без сховища не показуємо, щоб не набридати при кожному візиті
  }
}

function markPrompted(uid: string) {
  try {
    localStorage.setItem(promptKey(uid), String(Date.now()))
  } catch {
    /* ignore */
  }
}

const payOptions: [WouldPay, string][] = [
  ['yes', 'Так'],
  ['maybe', 'Можливо'],
  ['no', 'Ні'],
]

const textareaCls =
  'mt-1.5 w-full resize-y rounded-2xl border border-line/15 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-plum/40 focus:border-plum/40'

function FeedbackForm({ onDone }: { onDone: () => void }) {
  const { pathname } = useLocation()
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [liked, setLiked] = useState('')
  const [disliked, setDisliked] = useState('')
  const [wouldPay, setWouldPay] = useState<WouldPay>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ids = useId()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!rating) {
      setError('Обери оцінку від 1 до 5')
      return
    }
    setBusy(true)
    const ok = await sendFeedback({ rating, liked, disliked, would_pay: wouldPay, page: pathname })
    setBusy(false)
    if (ok) {
      toast('Дякуємо за відгук! Ми все читаємо', { tone: 'success' })
      onDone()
    } else {
      toast('Не вдалося надіслати відгук — спробуй ще раз', { tone: 'error' })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset>
        <legend className="text-sm font-medium text-ink">Як тобі Eventera?</legend>
        <div className="mt-2 flex gap-2" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className={cn(
                'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-full border font-pixel text-xl font-black transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-plum/40',
                rating === n ? 'border-plum bg-plum text-white' : 'border-line/15 bg-white text-plum hover:border-plum/40',
              )}
            >
              <input
                type="radio"
                name={`${ids}-rating`}
                value={n}
                checked={rating === n}
                onChange={() => {
                  setRating(n)
                  setError(null)
                }}
                className="sr-only"
                aria-label={`${n} з 5`}
              />
              {n}
            </label>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-coral-deep">{error}</p>}
      </fieldset>

      <label className="block text-sm font-medium text-ink">
        Що сподобалось?
        <textarea rows={2} maxLength={2000} value={liked} onChange={(e) => setLiked(e.target.value)} className={textareaCls} />
      </label>
      <label className="block text-sm font-medium text-ink">
        Що заважало або чого бракує?
        <textarea
          rows={2}
          maxLength={2000}
          value={disliked}
          onChange={(e) => setDisliked(e.target.value)}
          className={textareaCls}
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Чи оформив(-ла) би ти VIP за {VIP_PRICE} ₴/міс?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {payOptions.map(([v, label]) => (
            <label
              key={v}
              className={cn(
                'flex h-10 cursor-pointer items-center justify-center rounded-full border text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-plum/40',
                wouldPay === v ? 'border-plum bg-plum text-white' : 'border-line/15 bg-white text-plum hover:border-plum/40',
              )}
            >
              <input
                type="radio"
                name={`${ids}-pay`}
                value={v}
                checked={wouldPay === v}
                onChange={() => setWouldPay(v)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" className="w-full" disabled={busy} aria-busy={busy}>
        {busy ? 'Надсилаємо…' : 'Надіслати відгук'}
      </Button>
    </form>
  )
}

/** Плаваюча кнопка «Відгук» → таблиця feedback. Новим акаунтам через 2 хв — одна ненав’язлива підказка. */
export function FeedbackButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [nudge, setNudge] = useState(false)
  const uid = user?.id
  const createdAt = user?.created_at

  useEffect(() => {
    if (!uid || !createdAt || wasPrompted(uid)) return
    const created = new Date(createdAt).getTime()
    if (!Number.isFinite(created) || Date.now() - created > PROMPT_WINDOW_MS) return
    const t = setTimeout(
      () => {
        markPrompted(uid)
        setNudge(true)
      },
      Math.max(0, created + PROMPT_DELAY_MS - Date.now()),
    )
    return () => clearTimeout(t)
  }, [uid, createdAt])

  const openForm = () => {
    setNudge(false)
    setOpen(true)
  }

  return (
    <>
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-2 sm:right-6">
        {nudge && (
          <div role="status" className="relative w-60 rounded-2xl bg-card p-4 pr-9 text-sm text-plum shadow-lift">
            <p>Як тобі Eventera? Поділися враженнями — це 30 секунд.</p>
            <button type="button" onClick={openForm} className="mt-2 font-medium text-plum-dark underline underline-offset-2">
              Залишити відгук
            </button>
            <button
              type="button"
              onClick={() => setNudge(false)}
              aria-label="Закрити підказку"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-plum-soft hover:bg-plum/5"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={openForm}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-plum-dark px-4 text-sm font-medium text-white shadow-lift transition hover:bg-plum active:scale-[.97]"
        >
          <MessageCircleHeart size={18} aria-hidden /> Відгук
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Твій відгук">
        <FeedbackForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}
