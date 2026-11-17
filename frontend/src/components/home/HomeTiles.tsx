import { Heart, Loader2, Send } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { logClick } from '../../lib/api'
import { DONATE_URL } from '../../lib/donate'
import { useTelegramLink } from '../../lib/use-telegram-link'
import { DashedRings } from '../ui/DashedRings'
import { GelTile } from '../ui/GelTile'
import { GradientHeart, VibratingIcon } from '../ui/VibratingIcon'

/** Клікабельна область на всю плитку; контент поверх розмитої краплі. */
const hitClass =
  'relative flex h-full w-full flex-col rounded-[inherit] p-4 text-left focus-visible:ring-offset-powder disabled:cursor-progress sm:p-6'

function TileTitle({ children }: { children: ReactNode }) {
  return (
    <span className="relative z-10 max-w-[9ch] font-display text-base leading-tight text-plum-dark sm:text-xl">
      {children}
    </span>
  )
}

/** Пунктирні кола, що повільно обертаються (обрізані формою плитки через GelTile.decor). */
function SpinningRings({ variant }: { variant: 'donate' | 'telegram' }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      {variant === 'donate' ? (
        <>
          <span className="spin-slow absolute flex h-[78%] w-[78%]">
            <DashedRings rings={2} size={220} inner={62} className="h-full w-full text-coral-deep/45" />
          </span>
          <span className="spin-slow-reverse absolute flex h-[48%] w-[48%]">
            <DashedRings rings={1} size={220} inner={100} className="h-full w-full text-coral-deep/50" />
          </span>
        </>
      ) : (
        <>
          <span className="spin-slow-reverse absolute flex h-[70%] w-[70%]">
            <DashedRings rings={1} size={220} inner={100} className="h-full w-full text-plum/45" />
          </span>
          <span className="spin-slow absolute flex h-[54%] w-[54%]">
            <DashedRings rings={1} size={220} inner={100} strokeWidth={1.4} className="h-full w-full text-plum/40" />
          </span>
        </>
      )}
    </span>
  )
}

/** Плитка «Задонать!» → банка monobank (VITE_DONATE_URL) + logClick('donate'); без неї — /support. */
function DonateTile() {
  const content = (
    <>
      <TileTitle>Задонать!</TileTitle>
      <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <VibratingIcon pulse className="relative items-center justify-center">
          {/* напівпрозорий білий контур — на насиченому ядрі */}
          <Heart
            strokeWidth={1}
            strokeDasharray="2.2 1.6"
            className="absolute h-[clamp(4.5rem,13vw,6.5rem)] w-[clamp(4.5rem,13vw,6.5rem)] text-white/50"
          />
          <GradientHeart className="h-[clamp(2.6rem,7.5vw,3.75rem)] w-[clamp(2.6rem,7.5vw,3.75rem)] drop-shadow-[0_6px_14px_rgba(196,84,66,.35)]" />
        </VibratingIcon>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[9%] right-[9%] -rotate-[10deg] text-right font-script text-sm leading-[1.9] text-plum-dark/85 sm:text-xl"
      >
        with
        <br />
        &nbsp;&nbsp;love
      </span>
    </>
  )

  return (
    <GelTile variant="donate" interactive className="aspect-square w-full" decor={<SpinningRings variant="donate" />}>
      {DONATE_URL ? (
        <a
          href={DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void logClick('donate')}
          className={hitClass}
          aria-label="Задонать на «Повернись живим» (банка monobank, відкриється в новій вкладці)"
        >
          {content}
        </a>
      ) : (
        <Link to="/support" className={hitClass} aria-label="Задонать на «Повернись живим»">
          {content}
        </Link>
      )}
    </GelTile>
  )
}

/**
 * Плитка «Сповіщення в Telegram» → useTelegramLink(): гість — на реєстрацію,
 * залогінений — персональне посилання на бота (фолбек — VITE_TELEGRAM_BOT_URL), завжди logClick('telegram').
 */
function TelegramTile() {
  const telegram = useTelegramLink()
  return (
    <GelTile
      variant="telegram"
      interactive
      className="aspect-square w-full"
      decor={<SpinningRings variant="telegram" />}
    >
      <button
        type="button"
        onClick={telegram.start}
        disabled={telegram.pending}
        aria-busy={telegram.pending}
        className={hitClass}
      >
        <TileTitle>
          Сповіщення <span className="whitespace-nowrap">в Telegram</span>
        </TileTitle>
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <VibratingIcon delay={1} className="h-[30%] w-[30%]">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-[linear-gradient(145deg,#7A5A8E,#5A3A6E)] text-white shadow-[0_10px_24px_rgba(90,58,110,.35),inset_0_1px_0_rgba(255,255,255,.25)]">
              {telegram.pending ? (
                <Loader2 className="h-[38%] w-[38%] animate-spin motion-reduce:animate-none" />
              ) : (
                <Send className="h-[40%] w-[40%] -translate-x-[4%] translate-y-[4%]" strokeWidth={1.6} />
              )}
            </span>
          </VibratingIcon>
        </span>
        {telegram.pending && (
          <span className="absolute inset-x-3 bottom-3 z-10 rounded-full bg-white/75 px-3 py-1 text-center text-xs text-plum-dark sm:bottom-4">
            Прокидаємо бота…
          </span>
        )}
      </button>
    </GelTile>
  )
}

/** Дві плитки під блоком «Цього тижня». Під ними — місце під SupportActions (Промпт 9). */
export function HomeTiles() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5">
      <DonateTile />
      <TelegramTile />
    </div>
  )
}
