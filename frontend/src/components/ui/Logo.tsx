import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { DashedRings } from './DashedRings'

/** Лого: пунктирне коло з кораловою крапкою + «eventera» (Prata). */
export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="eventera — на головну"
      className={cn('inline-flex items-center gap-2.5 font-display text-2xl leading-none', light ? 'text-white' : 'text-ink', className)}
    >
      <span className="relative inline-flex h-8 w-8 items-center justify-center">
        <DashedRings rings={1} size={32} inner={100} strokeWidth={1.3} className="absolute inset-0 text-plum/60" />
        <span className="h-3.5 w-3.5 rounded-full bg-coral" />
      </span>
      eventera
    </Link>
  )
}
