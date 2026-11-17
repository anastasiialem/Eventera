import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { logClick } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { markVipPending, takeVipPending, vipUntil } from '../../lib/vip'
import { VipContext, type VipState } from '../../lib/vip-context'
import { VipModal } from './VipModal'

/**
 * Стан VIP + модалка «Підписатися». Гість → /auth?mode=signup&next=<поточна>&vip=1,
 * після входу модалка відкривається сама (прапорець у localStorage переживає лист-підтвердження).
 */
export function VipProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>()

  const until = vipUntil(profile)
  const untilMs = until?.getTime() ?? null
  const userId = user?.id

  // Синхронізація з localStorage: прапорець ставиться до редіректу на /auth
  useEffect(() => {
    if (!userId || !takeVipPending()) return
    // без clearTimeout у cleanup: прапорець уже знято, а StrictMode перезапускає ефект
    window.setTimeout(() => {
      setReason(undefined)
      setOpen(true)
    }, 0)
  }, [userId])

  const openVip = useCallback(
    (why?: string) => {
      void logClick('subscribe')
      if (!userId) {
        markVipPending()
        const back = location.pathname + location.search
        navigate(`/auth?mode=signup&next=${encodeURIComponent(back)}&vip=1`)
        return
      }
      setReason(why)
      setOpen(true)
    },
    [userId, location.pathname, location.search, navigate],
  )

  const value = useMemo<VipState>(
    () => ({ isVip: untilMs !== null, until: untilMs !== null ? new Date(untilMs) : null, openVip }),
    [untilMs, openVip],
  )
  const close = useCallback(() => setOpen(false), [])

  return (
    <VipContext.Provider value={value}>
      {children}
      <VipModal open={open} onClose={close} reason={reason} />
    </VipContext.Provider>
  )
}
