import { useQuery } from '@tanstack/react-query'
import { getSubscriptions } from './api'
import { useAuth } from './auth-context'
import { FRESH_QUERY } from './fresh-query'

/** Список «Я чекаю на…» поточного користувача (гостю — порожній, без запиту). */
export function useSubscriptions() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['subscriptions', user?.id],
    queryFn: getSubscriptions,
    enabled: Boolean(user),
    ...FRESH_QUERY,
  })
  return { ...query, subscriptions: user ? (query.data ?? []) : [] }
}
