import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type GelVariant = 'donate' | 'telegram' | 'neutral'

interface GelTileProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GelVariant
  /** Hover: насиченість +15% і підйом на 4px */
  interactive?: boolean
}

/**
 * Плитка з «гелевою» текстурою: розмита кольорова крапля (.gel / .gel__bg в index.css).
 * Текст — темно-сливовий; декор усередині — position:absolute.
 */
export function GelTile({ variant = 'neutral', interactive = false, className, children, ...rest }: GelTileProps) {
  return (
    <div
      className={cn(
        'gel',
        `gel--${variant}`,
        interactive && 'transition duration-200 hover:-translate-y-1 hover:saturate-[1.15]',
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="gel__bg" />
      {children}
    </div>
  )
}
