import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'few' | 'new' | 'category' | 'success' | 'neutral' | 'vip'

const tones: Record<BadgeTone, string> = {
  few: 'bg-coral-soft text-coral-deep', // «Мало квитків»
  new: 'bg-lavender-soft text-plum', // «Нове»
  category: 'bg-black/40 text-white backdrop-blur-sm', // «Концерт» поверх фото
  success: 'bg-white text-success', // «Підключено»
  neutral: 'bg-plum/5 text-plum-soft',
  vip: 'bg-plum-dark text-white tracking-wide', // «VIP»
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
