import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'outline' | 'soft'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-plum text-white hover:bg-plum-dark',
  accent: 'bg-coral text-white hover:brightness-95',
  ghost: 'bg-transparent text-plum hover:bg-plum/5',
  outline: 'border border-line/20 bg-card/60 text-plum hover:border-line/40 hover:bg-card',
  soft: 'bg-coral-soft text-coral-deep hover:brightness-[.98]',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-sm',
  lg: 'h-12 px-7 text-base',
}

const iconSizes: Record<ButtonSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

interface Common {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Кругла кнопка-іконка (дзвіночок, поділитися). Обов'язково з aria-label. */
  icon?: boolean
  className?: string
  children: ReactNode
}

type Extra = { 'aria-label'?: string; onClick?: () => void }
type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>
type AsLink = Common & Extra & { to: string }
type AsAnchor = Common & Extra & { href: string; target?: string }

export type ButtonProps = AsButton | AsLink | AsAnchor

function buttonClasses({
  variant = 'primary',
  size = 'md',
  icon = false,
  className,
}: Pick<Common, 'variant' | 'size' | 'icon' | 'className'> = {}) {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-full font-medium transition',
    'active:scale-[.97] disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    icon ? iconSizes[size] : sizes[size],
    className,
  )
}

/** Кнопка: <button>, або <Link> (якщо є `to`), або зовнішнє <a> (якщо є `href`). */
export function Button(props: ButtonProps) {
  const { variant, size, icon, className, children, ...rest } = props
  const cls = buttonClasses({ variant, size, icon, className })

  if ('to' in rest) {
    const { to, ...linkRest } = rest
    return (
      <Link to={to} className={cls} {...linkRest}>
        {children}
      </Link>
    )
  }
  if ('href' in rest) {
    const { href, target = '_blank', ...aRest } = rest
    return (
      <a href={href} target={target} rel="noopener noreferrer" className={cls} {...aRest}>
        {children}
      </a>
    )
  }
  const { type = 'button', ...btnRest } = rest
  return (
    <button type={type} className={cls} {...btnRest}>
      {children}
    </button>
  )
}
