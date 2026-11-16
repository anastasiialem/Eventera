import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Підйом на 4px і глибша тінь при наведенні */
  hover?: boolean
}

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' }

export function Card({ padding = 'md', hover = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card bg-card shadow-soft',
        paddings[padding],
        hover && 'transition duration-200 hover:-translate-y-1 hover:shadow-lift',
        className,
      )}
      {...rest}
    />
  )
}
