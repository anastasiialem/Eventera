import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ToastContext, type ToastOptions, type ToastTone } from './toast-context'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const icons = { info: Info, success: CheckCircle2, error: AlertCircle }
const iconColor = { info: 'text-lavender', success: 'text-emerald-300', error: 'text-coral' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const reduce = useReducedMotion()

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (message: string, { tone = 'info', duration = 4000 }: ToastOptions = {}) => {
      const id = nextId.current++
      setItems((list) => [...list.slice(-2), { id, message, tone }])
      window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = icons[t.tone]
            return (
              <motion.div
                key={t.id}
                layout={!reduce}
                role={t.tone === 'error' ? 'alert' : 'status'}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
                className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-plum-dark px-4 py-3 text-sm text-white shadow-lift"
              >
                <Icon size={18} className={cn('shrink-0', iconColor[t.tone])} />
                <span className="flex-1">{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Закрити сповіщення"
                  className="rounded-full p-1 text-white/60 transition hover:text-white"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
