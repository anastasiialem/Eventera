import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

const inputCls =
  'h-12 w-full rounded-2xl border border-line/15 bg-card px-4 text-base text-ink shadow-[inset_0_1px_2px_rgb(74_42_63/0.04)] ' +
  'placeholder:text-plum-soft/70 transition focus:border-plum/40 focus:outline-none focus:ring-2 focus:ring-lavender/60 ' +
  'disabled:opacity-60'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  error?: string
  /** Елемент праворуч від підпису (напр. «Не пам’ятаєш пароль?») */
  aside?: ReactNode
}

export function TextField({ label, error, aside, id, ...rest }: FieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-plum">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-err` : undefined}
        className={cn(inputCls, error && 'border-coral-deep/60')}
        {...rest}
      />
      {error && (
        <p id={`${fieldId}-err`} className="text-sm text-coral-deep">
          {error}
        </p>
      )}
    </div>
  )
}

export function PasswordField({ label, error, aside, id, ...rest }: FieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-plum">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-err` : undefined}
          className={cn(inputCls, 'pr-12', error && 'border-coral-deep/60')}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Сховати пароль' : 'Показати пароль'}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-plum-soft transition hover:bg-powder hover:text-plum"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p id={`${fieldId}-err`} className="text-sm text-coral-deep">
          {error}
        </p>
      )}
    </div>
  )
}

/** Загальна помилка форми (від Supabase). */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-deep">
      <AlertCircle size={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  )
}

/** Основна кнопка форми: блокується і показує спінер під час запиту. */
export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-plum text-base font-medium text-white transition hover:bg-plum-dark active:scale-[.98] disabled:cursor-wait disabled:opacity-70"
    >
      {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
