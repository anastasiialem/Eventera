import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type GelVariant = 'donate' | 'telegram' | 'neutral'

// Повні назви класів літералами: Tailwind викидає з @layer components усе, чого не бачить у коді,
// тож `gel--${variant}` не спрацює.
const VARIANT_CLASS: Record<GelVariant, string> = {
  donate: 'gel--donate',
  telegram: 'gel--telegram',
  neutral: 'gel--neutral',
}

interface GelTileProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GelVariant
  /** Hover / фокус: підйом на 4px, м'яка тінь, насиченіше ядро, частіша вібрація іконок */
  interactive?: boolean
  /** Декор під контентом, обрізаний по формі плитки (кола, що обертаються, тощо) */
  decor?: ReactNode
}

/**
 * Плитка з «гелевою» текстурою: розмита кольорова крапля (.gel / .gel__bg в index.css).
 * Текст — темно-сливовий. НЕ додавай overflow-hidden на саму плитку — обріжеться розмитий край;
 * усе, що може вилазити за межі, передавай через `decor`.
 */
export function GelTile({
  variant = 'neutral',
  interactive = false,
  decor,
  className,
  children,
  ...rest
}: GelTileProps) {
  return (
    <div className={cn('gel', VARIANT_CLASS[variant], interactive && 'gel--interactive', className)} {...rest}>
      <span aria-hidden className="gel__bg" />
      {decor && (
        <span aria-hidden className="gel__decor">
          {decor}
        </span>
      )}
      {children}
    </div>
  )
}
