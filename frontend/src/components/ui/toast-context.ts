import { createContext, useContext } from 'react'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastOptions {
  tone?: ToastTone
  /** мс до автозникнення, за замовчуванням 4000 */
  duration?: number
}

export type ShowToast = (message: string, options?: ToastOptions) => void

export const ToastContext = createContext<ShowToast | null>(null)

/** const toast = useToast(); toast('Додано до «Я чекаю на…»', { tone: 'success' }) */
export function useToast(): ShowToast {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast() потрібно викликати всередині <ToastProvider>')
  return ctx
}
