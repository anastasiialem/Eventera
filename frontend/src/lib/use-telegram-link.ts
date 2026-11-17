import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui/toast-context'
import { linkTelegram } from './api'
import { useAuth } from './auth-context'

/**
 * Дія «Сповіщення в Telegram» для будь-якої кнопки:
 *   const { start, pending } = useTelegramLink()
 *   <button onClick={start} disabled={pending}>{pending ? 'Прокидаємо бота…' : '…'}</button>
 * `start` треба викликати прямо в onClick (див. linkTelegram).
 */
export function useTelegramLink() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [pending, setPending] = useState(false)

  const start = useCallback(() => {
    if (pending) return
    if (user) setPending(true)
    linkTelegram({ isLoggedIn: Boolean(user), navigate })
      .then((result) => {
        if (result === 'auth') toast('Зареєструйся, щоб отримувати сповіщення в Telegram')
        if (result === 'fallback')
          toast('Не вдалося підключитися до бота — відкрили його напряму. Спробуй ще раз пізніше', {
            tone: 'error',
            duration: 6000,
          })
      })
      .finally(() => setPending(false))
  }, [pending, user, navigate, toast])

  return { start, pending }
}
