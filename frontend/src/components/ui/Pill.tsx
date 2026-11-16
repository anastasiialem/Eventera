import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  /** dark — для пілюль поверх фото (hero: «Сьогодні», «Ці вихідні») */
  tone?: 'light' | 'dark'
}

/** Фільтр-пілюля: «Усі», «Концерти», «Театр»… */
export function Pill({ active = false, tone = 'light', className, children, ...rest }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm transition',
        tone === 'light' &&
          (active ? 'bg-plum text-white shadow-soft' : 'border border-line/10 bg-card text-plum hover:border-line/30'),
        tone === 'dark' &&
          (active
            ? 'bg-white text-plum-dark'
            : 'border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/20'),
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** На всю ширину з рівними сегментами (таби «Вхід / Реєстрація») */
  stretch?: boolean
  label?: string
}

/** Сегмент-таби: «Цей тиждень / Цей місяць / Сезон / Рік», «Вхід / Реєстрація». */
export function Segment<T extends string>({ options, value, onChange, className, stretch, label }: SegmentProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('rounded-full bg-powder-deep/80 p-1', stretch ? 'flex w-full' : 'inline-flex', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 whitespace-nowrap rounded-full px-4 text-sm transition',
              stretch && 'flex-1',
              active ? 'bg-card text-ink shadow-soft' : 'text-plum-soft hover:text-plum',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
