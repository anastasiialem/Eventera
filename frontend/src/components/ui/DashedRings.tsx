import { cn } from '../../lib/cn'

interface DashedRingsProps {
  /** Кількість кіл */
  rings?: number
  /** Розмір у px (квадрат). Можна перебити класами w-/h-. */
  size?: number
  className?: string
  /** Товщина лінії в px при заданому size */
  strokeWidth?: number
  /** Радіус найменшого кола у % від найбільшого */
  inner?: number
}

/**
 * Пунктирні концентричні кола — декор із макета.
 * Колір — currentColor: <DashedRings className="text-white/40" />.
 * Кола чергуються: штрихи — крапки — штрихи…
 */
export function DashedRings({ rings = 3, size = 240, className, strokeWidth = 1.2, inner = 40 }: DashedRingsProps) {
  const unit = 100 / size // 1px у координатах viewBox
  const sw = strokeWidth * unit
  const outer = 50 - sw
  const minR = (outer * inner) / 100
  const step = rings > 1 ? (outer - minR) / (rings - 1) : 0

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      className={cn('pointer-events-none shrink-0', className)}
    >
      {Array.from({ length: rings }, (_, i) => (
        <circle
          key={i}
          cx="50"
          cy="50"
          r={minR + step * i}
          strokeDasharray={i % 2 === 1 ? `0 ${4 * unit}` : `${6 * unit} ${5 * unit}`}
        />
      ))}
    </svg>
  )
}
