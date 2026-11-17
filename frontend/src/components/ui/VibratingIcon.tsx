import { useId, type CSSProperties, type ReactNode } from 'react'
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

/** Серце з градієнтом #FF9A8A → #EC6B5C і легким відблиском. */
export function GradientHeart({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FF9A8A" />
          <stop offset="100%" stopColor="#EC6B5C" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="0.32" cy="0.3" r="0.32">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={HEART_PATH} fill={`url(#${id}-fill)`} />
      <path d={HEART_PATH} fill={`url(#${id}-shine)`} />
    </svg>
  )
}
