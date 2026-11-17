import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, LogOut, Send } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotificationPrefs, logClick, TELEGRAM_BOT_URL, updateNotificationPrefs } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { DONATE_URL } from '../../lib/donate'
import { useTelegramLink } from '../../lib/use-telegram-link'
import { useTelegramStatus } from '../../lib/use-telegram-status'
import type { NotificationPrefs } from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { DashedRings } from '../ui/DashedRings'
import { GelTile } from '../ui/GelTile'
import { Skeleton } from '../ui/Skeleton'
import { useToast } from '../ui/toast-context'

const botHandle = '@' + (TELEGRAM_BOT_URL.match(/t\.me\/([\w_]+)/)?.[1] ?? 'Eventera_lviv_bot')

/** Картка Telegram: «Підключено» (є рядок у telegram_links) або «Підключити» → linkTelegram(). */
export function TelegramCard() {
  const telegram = useTelegramLink()
  const { linked, username } = useTelegramStatus()

  return (
    <GelTile variant="telegram" className="overflow-hidden rounded-[28px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl text-plum-dark">Telegram</h2>
        {linked && (
          <Badge tone="success" className="py-1 shadow-soft">
            <Check size={14} aria-hidden /> Підключено
          </Badge>
        )}
      </div>

      <div className="relative mx-auto my-3 flex aspect-square w-40 items-center justify-center">
        <DashedRings rings={2} size={160} inner={74} className="absolute inset-0 h-full w-full text-plum/45" />
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-plum text-white shadow-lift">
          {telegram.pending ? (
            <Loader2 size={24} className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Send size={24} strokeWidth={1.7} className="-translate-x-px translate-y-px" aria-hidden />
          )}
        </span>
      </div>

      {linked ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 truncate text-plum-dark/80">
            {username ? `@${username} · ` : ''}
            {botHandle}
          </span>
          <button
            type="button"
            onClick={telegram.start}
            disabled={telegram.pending}
            className="shrink-0 font-medium text-plum-dark underline underline-offset-2 disabled:opacity-60"
          >
            {telegram.pending ? 'Прокидаємо бота…' : 'Змінити'}
          </button>
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <p className="text-sm text-plum-dark/80">Напишемо одразу, щойно хтось зі списку оголосить подію у Львові.</p>
          <Button onClick={telegram.start} disabled={telegram.pending} aria-busy={telegram.pending} className="w-full">
            {telegram.pending ? 'Прокидаємо бота…' : 'Підключити'}
          </Button>
        </div>
      )}
    </GelTile>
  )
}

function PrefRow({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2 text-sm text-plum has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-px h-5 w-5 shrink-0 cursor-pointer rounded accent-plum"
      />
      <span>{children}</span>
    </label>
  )
}

const MAX_PRICE_DEFAULT = 500

/** «Як повідомляти» → profiles.email_alerts / telegram_alerts (+ remind_day_before / max_price, якщо є колонки). */
export function NotifyPrefsCard() {
  const { user, refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const key = ['notification-prefs', user?.id]
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: getNotificationPrefs,
    enabled: Boolean(user),
  })

  const mutation = useMutation({
    mutationFn: updateNotificationPrefs,
    onMutate: async (patch: Partial<NotificationPrefs>) => {
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<typeof data>(key)
      queryClient.setQueryData<typeof data>(key, (old) => (old ? { ...old, prefs: { ...old.prefs, ...patch } } : old))
      return { prev }
    },
    onSuccess: () => toast('Налаштування збережено', { tone: 'success', duration: 2000 }),
    onError: (_e, _p, ctx) => {
      queryClient.setQueryData(key, ctx?.prev)
      toast('Не вдалося зберегти налаштування', { tone: 'error' })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-prefs'] })
      void refreshProfile()
    },
  })

  const set = (patch: Partial<NotificationPrefs>) => mutation.mutate(patch)
  const prefs = data?.prefs

  return (
    <section className="rounded-[28px] bg-card p-5 shadow-soft sm:p-6" aria-labelledby="prefs-title">
      <h2 id="prefs-title" className="mb-2 text-2xl">
        Як повідомляти
      </h2>
      {isLoading ? (
        <div className="space-y-3 pt-2">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ) : !prefs || isError ? (
        <p className="text-sm text-plum-soft">Не вдалося завантажити налаштування — спробуй оновити сторінку.</p>
      ) : (
        <div>
          <PrefRow checked={prefs.telegram_alerts} onChange={(v) => set({ telegram_alerts: v })}>
            <b className="font-semibold text-ink">Telegram</b> — одразу після анонсу
          </PrefRow>
          <PrefRow checked={prefs.email_alerts} onChange={(v) => set({ email_alerts: v })}>
            <b className="font-semibold text-ink">Email</b> — на {user?.email ?? 'твою пошту'}
          </PrefRow>
          {data.extended && (
            <>
              <PrefRow checked={Boolean(prefs.remind_day_before)} onChange={(v) => set({ remind_day_before: v })}>
                Нагадати за день до події
              </PrefRow>
              <PrefRow
                checked={prefs.max_price != null}
                onChange={(v) => set({ max_price: v ? MAX_PRICE_DEFAULT : null })}
              >
                Тільки події до {prefs.max_price ?? MAX_PRICE_DEFAULT} ₴
              </PrefRow>
            </>
          )}
        </div>
      )}
    </section>
  )
}

/** «Акаунт»: email, «Вийти», «Підтримати збір». */
export function AccountCard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const onSignOut = async () => {
    await signOut()
    toast('Вихід виконано — до зустрічі!')
    navigate('/')
  }

  return (
    <section className="rounded-[28px] bg-card p-5 shadow-soft sm:p-6" aria-labelledby="account-title">
      <h2 id="account-title" className="text-2xl">
        Акаунт
      </h2>
      <p className="mt-1 truncate text-sm text-plum">{user?.email}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void onSignOut()}>
          <LogOut size={15} aria-hidden /> Вийти
        </Button>
        {DONATE_URL ? (
          <Button href={DONATE_URL} variant="soft" size="sm" onClick={() => void logClick('donate')}>
            Підтримати збір
          </Button>
        ) : (
          <Button to="/support" variant="soft" size="sm">
            Підтримати збір
          </Button>
        )}
      </div>
    </section>
  )
}
