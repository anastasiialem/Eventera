import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Crown, ExternalLink, Heart, Hourglass, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { getLatestVipRequest, logClick, requestVip } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { formatVipDate, VIP_NOTE, VIP_PAY_URL, VIP_PRICE } from '../../lib/vip'
import { useVip } from '../../lib/vip-context'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toast-context'
import { TariffTable } from './TariffTable'
import { FRESH_QUERY } from '../../lib/fresh-query'

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-plum-dark text-sm font-medium text-white"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium text-ink">{title}</p>
        {children}
      </div>
    </li>
  )
}

/** Модалка VIP: тарифи, куди йдуть гроші, два кроки ручної оплати. */
export function VipModal({ open, onClose, reason }: { open: boolean; onClose: () => void; reason?: string }) {
  const { user } = useAuth()
  const { isVip, until } = useVip()
  const toast = useToast()
  const queryClient = useQueryClient()
  const email = user?.email ?? ''
  const key = ['vip-request', user?.id]

  const { data: request, isLoading } = useQuery({
    queryKey: key,
    queryFn: getLatestVipRequest,
    enabled: open && Boolean(user) && !isVip,
    ...FRESH_QUERY,
  })

  const submit = useMutation({
    mutationFn: () => requestVip(email),
    onSuccess: (row) => {
      queryClient.setQueryData(key, row)
      toast('Дякуємо! Перевіримо оплату до 24 годин', { tone: 'success' })
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Не вдалося надіслати заявку', { tone: 'error' }),
  })

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email)
      toast('Email скопійовано', { tone: 'success', duration: 2000 })
    } catch {
      toast('Не вдалося скопіювати — виділи email вручну', { tone: 'error' })
    }
  }

  const pending = request?.status === 'pending'

  return (
    <Modal open={open} onClose={onClose} title="VIP-підписка" className="max-w-lg">
      <div className="space-y-5">
        {reason && (
          <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral-deep" role="status">
            {reason}
          </p>
        )}

        <TariffTable />

        <div className="space-y-2 rounded-2xl bg-powder px-4 py-3 text-sm leading-relaxed text-plum">
          <p className="flex gap-2">
            <Crown size={16} className="mt-0.5 shrink-0 text-plum-dark" aria-hidden />
            <span>
              <b className="font-medium text-ink">VIP — {VIP_PRICE} ₴/міс.</b> {VIP_NOTE}.
            </span>
          </p>
          <p className="flex gap-2">
            <Heart size={16} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden />
            <span>
              <b className="font-medium text-ink">«Задонатити»</b> — це окремо: донат на фонд «Повернись живим».
            </span>
          </p>
        </div>

        {isVip && until ? (
          <p className="rounded-2xl bg-lavender-soft px-4 py-3 text-center font-medium text-plum-dark">
            VIP активний до {formatVipDate(until)}. Дякуємо, що підтримуєш Eventera!
          </p>
        ) : isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-plum motion-reduce:animate-none" aria-label="Завантаження" />
          </div>
        ) : pending ? (
          <div className="flex items-start gap-3 rounded-2xl bg-lavender-soft px-4 py-3 text-sm text-plum-dark" role="status">
            <Hourglass size={18} className="mt-0.5 shrink-0" aria-hidden />
            <p>
              <b className="font-medium">Перевіряємо оплату — до 24 годин.</b> Щойно підтвердимо, біля аватара з’явиться
              бейдж VIP.
            </p>
          </div>
        ) : (
          <ol className="space-y-5">
            <Step n={1} title={`Оплати ${VIP_PRICE} ₴ у банку «Eventera VIP»`}>
              {VIP_PAY_URL ? (
                <Button href={VIP_PAY_URL} className="w-full" onClick={() => void logClick('vip_pay')}>
                  Оплатити {VIP_PRICE} ₴ <ExternalLink size={16} aria-hidden />
                </Button>
              ) : (
                <>
                  <Button className="w-full" disabled>
                    Оплатити {VIP_PRICE} ₴
                  </Button>
                  <p className="text-xs text-plum-soft">Оплата VIP скоро з’явиться — банку ще налаштовуємо.</p>
                </>
              )}
              <div className="flex items-center gap-2 rounded-2xl border border-line/15 px-3 py-2 text-sm">
                <p className="min-w-0 flex-1 text-plum">
                  У коментарі до платежу вкажи свій email:{' '}
                  <b className="select-all break-all font-medium text-ink">{email}</b>
                </p>
                <Button variant="ghost" size="sm" onClick={() => void copyEmail()} aria-label="Скопіювати email">
                  <Copy size={15} aria-hidden /> <span className="hidden sm:inline">Скопіювати</span>
                </Button>
              </div>
            </Step>
            <Step n={2} title="Після оплати натисни">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => submit.mutate()}
                disabled={submit.isPending || !email}
                aria-busy={submit.isPending}
              >
                {submit.isPending && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />}
                Я оплатив(-ла)
              </Button>
              {request?.status === 'rejected' && (
                <p className="text-xs text-coral-deep">
                  Попередню оплату не знайшли. Перевір коментар із email і спробуй ще раз.
                </p>
              )}
            </Step>
          </ol>
        )}
      </div>
    </Modal>
  )
}
