import { Check, Heart, Loader2, Send } from 'lucide-react'
import { useTelegramLink } from '../../lib/use-telegram-link'
import { useTelegramStatus } from '../../lib/use-telegram-status'
import { SupportActions } from '../SupportActions'
import { DashedRings } from '../ui/DashedRings'
import { GelTile } from '../ui/GelTile'
import { GradientHeart, VibratingIcon } from '../ui/VibratingIcon'

/** Telegram-нагадування на сторінці події. Кнопка — через linkTelegram(); поруч — SupportActions. */
export function TelegramReminder() {
  const telegram = useTelegramLink()
  const { linked } = useTelegramStatus()

  return (
    <GelTile variant="telegram" className="space-y-4 rounded-[28px] p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#7A5A8E,#5A3A6E)] text-white shadow-soft">
          {telegram.pending ? (
            <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : linked ? (
            <Check size={20} aria-hidden />
          ) : (
            <Send size={20} className="-translate-x-px translate-y-px" aria-hidden />
          )}
        </span>
        <div className="min-w-0 text-sm leading-relaxed text-plum-dark">
          {linked ? (
            <p>Telegram підключено — напишемо, щойно в артистів із твого списку з&apos;явиться подія у Львові.</p>
          ) : (
            <>
              <p>Нагадаємо в Telegram, щойно з&apos;явиться нова подія твоїх артистів. Це безкоштовно.</p>
              <button
                type="button"
                onClick={telegram.start}
                disabled={telegram.pending}
                aria-busy={telegram.pending}
                className="mt-1 font-medium underline underline-offset-2 disabled:cursor-progress disabled:no-underline"
              >
                {telegram.pending ? 'Прокидаємо бота…' : 'Підключити'}
              </button>
            </>
          )}
        </div>
      </div>
      <SupportActions />
    </GelTile>
  )
}

/** «Йдеш на концерт — підтримай збір». */
export function DonateBlock() {
  return (
    <GelTile
      variant="donate"
      className="rounded-[28px] p-6"
      decor={
        <span className="spin-slow absolute -right-10 top-1/2 -mt-[120px] flex">
          <DashedRings rings={3} size={240} inner={45} className="text-coral-deep/40" />
        </span>
      }
    >
      <span aria-hidden className="pointer-events-none absolute right-[13%] top-[38%] -translate-y-1/2">
        <VibratingIcon pulse className="relative items-center justify-center">
          <Heart strokeWidth={1} strokeDasharray="2.2 1.6" className="absolute h-[100px] w-[100px] text-white/50" />
          <GradientHeart className="h-14 w-14 drop-shadow-[0_6px_14px_rgba(196,84,66,.35)]" />
        </VibratingIcon>
      </span>
      <h2 className="relative max-w-[12ch] text-[1.65rem] leading-tight text-plum-dark">Йдеш на концерт — підтримай збір</h2>
      <p className="relative mt-3 max-w-[18ch] text-sm leading-relaxed text-plum-dark/80">
        Навіть кілька гривень допоможе «Повернись живим»!
      </p>
      <SupportActions className="relative mt-5" />
    </GelTile>
  )
}
