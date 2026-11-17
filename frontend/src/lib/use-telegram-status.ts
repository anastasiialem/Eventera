import { useQuery } from '@tanstack/react-query'
import { getTelegramStatus } from './api'
import { useAuth } from './auth-context'

/**
 * Чи прив'язаний Telegram (рядок у telegram_links). linked = false і коли невідомо
 * (гість / RLS не дає читати) — тоді показуємо лише «Підключити».
 * Перечитується при поверненні на вкладку — після /start у боті статус оновиться сам.
 */
export function useTelegramStatus() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['telegram-status', user?.id],
    queryFn: getTelegramStatus,
    enabled: Boolean(user),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  return { linked: Boolean(user && query.data?.linked), username: query.data?.username ?? null }
}
