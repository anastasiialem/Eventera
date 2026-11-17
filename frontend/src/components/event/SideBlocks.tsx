import { Check, Heart, Loader2, Plus, Send } from 'lucide-react'
import { logClick } from '../../lib/api'
import { cn } from '../../lib/cn'
import { DONATE_URL } from '../../lib/donate'
import { useTelegramLink } from '../../lib/use-telegram-link'
import { useTelegramStatus } from '../../lib/use-telegram-status'
import { Button } from '../ui/Button'
import { DashedRings } from '../ui/DashedRings'
import { GelTile } from '../ui/GelTile'


/** Кнопка «Задонатити»: банка monobank (VITE_DONATE_URL), без неї — /support. */
export function DonateButton({ className, children = 'Задонатити' }: { className?: string; children?: string }) {
  if (!DONATE_URL)
    return (
      <Button to="/support" variant="outline" className={cn('bg-white', className)}>
        {children} <Plus size={16} aria-hidden />
      </Button>
    )
  return (
    <Button
      href={DONATE_URL}
      variant="outline"
      className={cn('border-transparent bg-white hover:bg-white', className)}
      onClick={() => void logClick('donate')}
    >
      {children} <Plus size={16} aria-hidden />
    </Button>
  )
}

/** Telegram-нагадування на сторінці події. Кнопка — через linkTelegram(). */
export function TelegramReminder() {
  const telegram = useTelegramLink()
  const { linked } = useTelegramStatus()

  const icon = (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-plum text-white shadow-soft">
      {telegram.pending ? (
        <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden />
      ) : linked ? (
        <Check size={20} aria-hidden />
      ) : (
        <Send size={20} className="-translate-x-px translate-y-px" aria-hidden />
      )}
    </span>
  )

  if (linked)
    return (
      <GelTile variant="telegram" className="flex items-center gap-4 rounded-[28px] p-5">
        {icon}
        <p className="text-sm leading-relaxed">
          Telegram підключено — напишемо, щойно в артистів із твого списку з&apos;явиться подія у Львові.
        </p>
      </GelTile>
    )

  return (
    <GelTile variant="telegram" interactive className="rounded-[28px]">
      <button
        type="button"
        onClick={telegram.start}
        disabled={telegram.pending}
        aria-busy={telegram.pending}
        className="flex w-full items-center gap-4 rounded-[28px] p-5 text-left disabled:cursor-progress"
      >
        {icon}
        <span className="text-sm leading-relaxed">
          {telegram.pending ? (
            'Прокидаємо бота…'
          ) : (
            <>
              Нагадаємо в Telegram, щойно з&apos;явиться нова подія твоїх артистів.{' '}
              <span className="font-medium underline underline-offset-2">Підключити</span>
            </>
          )}
        </span>
      </button>
    </GelTile>
  )
}

/** «Йдеш на концерт — підтримай збір». */
export function DonateBlock() {
  return (
    <GelTile variant="donate" className="overflow-hidden rounded-[28px] p-6">
      <DashedRings
        rings={3}
        size={240}
        inner={45}
        className="absolute -right-10 top-1/2 -z-[1] -translate-y-1/2 text-coral-deep/40"
      />
      <span aria-hidden className="absolute right-[13%] top-1/2 -z-[1] -translate-y-1/2">
        <Heart
          strokeWidth={1}
          strokeDasharray="2.2 1.6"
          className="absolute -left-[22px] -top-[22px] h-[100px] w-[100px] text-coral-deep/60"
        />
        <Heart fill="currentColor" strokeWidth={0} className="h-14 w-14 text-[#C9503F]" />
      </span>
      <h2 className="max-w-[12ch] text-[1.65rem] leading-tight text-plum-dark">Йдеш на концерт — підтримай збір</h2>
      <p className="mt-3 max-w-[18ch] text-sm leading-relaxed text-plum-dark/80">
        Навіть кілька гривень допоможе «Повернись живим»!
      </p>
      <DonateButton className="mt-5 shadow-soft" />
    </GelTile>
  )
}
