import { type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface VibratingIconProps {
  children: ReactNode
  /** Зсув фази в секундах — щоб сусідні плитки не трусились синхронно */
  delay?: number
  /** Додатково ледь пульсувати (scale 1 → 1.08) — для серця */
  pulse?: boolean
  className?: string
}

/**
 * «Телефон на беззвучному»: серія дрібного тремтіння (~0.45 с), пауза ~2 с, по колу.
 * Лише візуально (transform) — жодного звуку і navigator.vibrate.
 * Усередині .gel на hover вібрує частіше; prefers-reduced-motion → спокійна пульсація (index.css).
 */
export function VibratingIcon({ children, delay = 0, pulse = false, className }: VibratingIconProps) {
  const style = { '--vibe-delay': `${delay}s` } as CSSProperties
  return (
    <span aria-hidden className={cn('vibrate inline-flex will-change-transform', className)} style={style}>
      {pulse ? (
        <span className="heartbeat relative inline-flex items-center justify-center" style={style}>
          {children}
        </span>
      ) : (
        children
      )}
    </span>
  )
}

const HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'

/**
 * Серце донату: суцільне матове (без градієнта й відблиску), глибший відтінок рожевої плитки —
 * у тому ж стилі, що кружечок із літачком у Telegram-плитці. Вібрує і ледь пульсує.
 * Один компонент для плитки «Задонать!» на головній, блоку донату на сторінці події і /support.
 */
export function DonateHeart({ className }: { className?: string }) {
  return (
    <VibratingIcon pulse className="items-center justify-center">
      <svg viewBox="2 3 20 18.5" aria-hidden className={cn('drop-shadow-[0_8px_16px_rgba(168,64,52,.28)]', className)}>
        <path d={HEART_PATH} fill="#D2584A" />
      </svg>
    </VibratingIcon>
  )
}
