import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui/toast-context'
import type { Event, Subscription } from '../types'
import { addSubscription, removeSubscription } from './api'
import { useAuth } from './auth-context'
import { useSubscriptions } from './use-subscriptions'
import { FREE_LIMIT } from './vip'
import { useVip } from './vip-context'

export const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/** Тимчасові (ще не збережені) записи мають від'ємний id. */
export const isPendingSub = (s: Subscription) => s.id < 0

/** Чи вже є такий артист / ключове слово у списку. */
export function findSubscription(list: Subscription[], name: string, artistId?: number | null) {
  const n = lower(name)
  return list.find(
    (s) => (artistId != null && s.artist_id === artistId) || lower(s.label) === n || lower(s.keyword) === n,
  )
}

interface AddVars {
  name: string
  artistId?: number
}

/**
 * Додавання / видалення в «Я чекаю на…» з оптимістичним оновленням кешу ['subscriptions', userId]
 * і тостами українською. Помилка → відкат і тост.
 */
export function useSubscriptionActions() {
  const { user } = useAuth()
  const { isVip, openVip } = useVip()
  const queryClient = useQueryClient()
  const toast = useToast()
  const userId = user?.id
  const key = ['subscriptions', userId]

  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    void queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  const addMutation = useMutation({
    mutationFn: ({ name, artistId }: AddVars) => addSubscription(name, { artistId }),
    onMutate: async ({ name, artistId }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<Subscription[]>(key)
      const temp: Subscription = {
        id: -Date.now() - Math.floor(Math.random() * 1000),
        kind: artistId ? 'artist' : 'keyword',
        artist_id: artistId ?? null,
        event_id: null,
        keyword: artistId ? null : name,
        created_at: new Date().toISOString(),
        label: name,
      }
      queryClient.setQueryData<Subscription[]>(key, (old = []) => [temp, ...old])
      return { prev, tempId: temp.id }
    },
    onSuccess: (sub, { name }, ctx) => {
      queryClient.setQueryData<Subscription[]>(key, (old = []) =>
        old.map((s) => (s.id === ctx?.tempId ? { ...sub, label: sub.label || name } : s)),
      )
      toast(`«${name}» — у списку «Я чекаю на…». Повідомимо, щойно буде подія у Львові`, { tone: 'success' })
    },
    onError: (err, _vars, ctx) => {
      queryClient.setQueryData(key, ctx?.prev)
      toast(err instanceof Error ? err.message : 'Не вдалося додати — спробуй ще раз', { tone: 'error' })
    },
    onSettled: settle,
  })

  const removeMutation = useMutation({
    mutationFn: (sub: Subscription) => removeSubscription(sub.id),
    onMutate: async (sub) => {
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<Subscription[]>(key)
      queryClient.setQueryData<Subscription[]>(key, (old = []) => old.filter((s) => s.id !== sub.id))
      return { prev }
    },
    onSuccess: (_d, sub) => toast(`«${sub.label}» прибрано зі списку`),
    onError: (_err, _sub, ctx) => {
      queryClient.setQueryData(key, ctx?.prev)
      toast('Не вдалося прибрати — спробуй ще раз', { tone: 'error' })
    },
    onSettled: settle,
  })

  const { mutate: addMutate } = addMutation
  const { mutate: removeMutate } = removeMutation

  /** Повертає false, якщо назва закоротка або вже є у списку. */
  const add = useCallback(
    (name: string, artistId?: number) => {
      const clean = name.trim().replace(/\s+/g, ' ')
      if (clean.length < 2) {
        toast('Назва має містити щонайменше 2 символи', { tone: 'error' })
        return false
      }
      const list = queryClient.getQueryData<Subscription[]>(['subscriptions', userId]) ?? []
      if (findSubscription(list, clean, artistId)) {
        toast(`«${clean}» уже є у твоєму списку`)
        return false
      }
      if (!isVip && list.length >= FREE_LIMIT) {
        openVip(`В безкоштовному тарифі — до ${FREE_LIMIT} артистів`)
        return false
      }
      addMutate({ name: clean, artistId })
      return true
    },
    [addMutate, queryClient, toast, userId, isVip, openVip],
  )

  const remove = useCallback(
    (sub: Subscription) => {
      if (isPendingSub(sub)) return
      removeMutate(sub)
    },
    [removeMutate],
  )

  return { add, remove }
}

/**
 * Дзвіночок / «Ти чекаєш на цього артиста»: підписка на першого артиста події
 * (немає артистів — на назву події як keyword). Гостя — на реєстрацію.
 */
export function useBell(event: Event) {
  const { user } = useAuth()
  const { subscriptions } = useSubscriptions()
  const { add, remove } = useSubscriptionActions()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  const artist = event.artists[0]
  const name = artist?.name ?? event.title
  const current = findSubscription(subscriptions, name, artist?.id)

  const toggle = () => {
    if (!user) {
      toast('Зареєструйся, щоб отримати сповіщення про нові концерти')
      navigate(`/auth?mode=signup&next=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    // clicks.kind='subscribe' — лише кнопка VIP «Підписатися»; дзвіночок у статистику не пишемо
    if (current) remove(current)
    else add(name, artist?.id)
  }

  return {
    active: Boolean(current),
    pending: Boolean(current && isPendingSub(current)),
    toggle,
    name,
    hasArtist: Boolean(artist),
  }
}
