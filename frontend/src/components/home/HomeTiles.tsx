import { Heart, Loader2, Send } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { logClick } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useTelegramLink } from '../../lib/use-telegram-link'
import { DashedRings } from '../ui/DashedRings'

const DONATE_URL = import.meta.env.VITE_DONATE_URL || null

// Поки статичний градієнт у палітрах GelTile з CLAUDE.md; гелева текстура і «вібрація» — Промпт 7.
const tileBg = {
  donate:
    'bg-[radial-gradient(60%_55%_at_40%_64%,#F2708A_0%,#F8B0B9_48%,transparent_82%),radial-gradient(45%_40%_at_80%_20%,#FFD9D2_0%,transparent_70%),linear-gradient(#FFEFEC,#FFEFEC)]',
  telegram:
    'bg-[radial-gradient(60%_55%_at_40%_64%,#9A7DD3_0%,#C8B5EE_48%,transparent_82%),radial-gradient(45%_40%_at_80%_20%,#EDE4FF_0%,transparent_70%),linear-gradient(#F5F0FD,#F5F0FD)]',
}

const tileClass =
  'group relative isolate flex aspect-square w-full flex-col overflow-hidden rounded-tile p-4 text-left shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lift hover:saturate-[1.15] sm:p-6'

function TileTitle({ children }: { children: ReactNode }) {
  return <span className="relative z-10 max-w-[9ch] font-display text-base leading-tight text-plum-dark sm:text-xl">{children}</span>
}

/** Плитка «Задонать!» → банка monobank (VITE_DONATE_URL), без неї — /support. */
function DonateTile() {
  const content = (
    <>
      <span aria-hidden className={cn('absolute inset-0 -z-10', tileBg.donate)} />
      <TileTitle>Задонать!</TileTitle>
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <DashedRings rings={3} size={220} inner={48} className="absolute h-[78%] w-[78%] text-coral-deep/45" />
        <span className="relative flex items-center justify-center">
          <Heart
            strokeWidth={1}
            strokeDasharray="2.2 1.6"
            className="absolute h-[clamp(4.5rem,13vw,6.5rem)] w-[clamp(4.5rem,13vw,6.5rem)] text-coral-deep/70"
          />
          <Heart
            fill="currentColor"
            strokeWidth={0}
            className="h-[clamp(2.6rem,7.5vw,3.75rem)] w-[clamp(2.6rem,7.5vw,3.75rem)] text-[#C9503F]"
          />
        </span>
      </span>
      <span
        aria-hidden
        className="absolute bottom-[9%] right-[9%] -rotate-[10deg] text-right font-script text-sm leading-[1.9] text-plum-dark/80 sm:text-xl"
      >
        with
        <br />
        &nbsp;&nbsp;love
      </span>
    </>
  )

  if (!DONATE_URL) {
    return (
      <Link to="/support" className={tileClass} aria-label="Задонать на «Повернись живим»">
        {content}
      </Link>
    )
  }
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void logClick('donate')}
      className={tileClass}
      aria-label="Задонать на «Повернись живим» (банка monobank, відкриється в новій вкладці)"
    >
      {content}
    </a>
  )
}

/** Плитка «Сповіщення в Telegram» → linkTelegram() через useTelegramLink. */
function TelegramTile() {
  const telegram = useTelegramLink()
  return (
    <button
      type="button"
      onClick={telegram.start}
      disabled={telegram.pending}
      aria-busy={telegram.pending}
      className={cn(tileClass, 'disabled:cursor-progress')}
    >
      <span aria-hidden className={cn('absolute inset-0 -z-10', tileBg.telegram)} />
      <TileTitle>
        Сповіщення <span className="whitespace-nowrap">в Telegram</span>
      </TileTitle>
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <DashedRings rings={2} size={220} inner={70} className="absolute h-[70%] w-[70%] text-plum/45" />
        <span className="relative flex h-[30%] w-[30%] items-center justify-center rounded-full bg-plum-dark text-white shadow-lift">
          {telegram.pending ? (
            <Loader2 className="h-[38%] w-[38%] animate-spin motion-reduce:animate-none" />
          ) : (
            <Send className="h-[40%] w-[40%] -translate-x-[4%] translate-y-[4%]" strokeWidth={1.6} />
          )}
        </span>
      </span>
      {telegram.pending && (
        <span className="absolute inset-x-3 bottom-3 z-10 rounded-full bg-white/70 px-3 py-1 text-center text-xs text-plum-dark backdrop-blur sm:bottom-4">
          Прокидаємо бота…
        </span>
      )}
    </button>
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
