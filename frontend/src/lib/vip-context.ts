import { createContext, useContext } from 'react'

export interface VipState {
  /** profiles.vip_until > now() */
  isVip: boolean
  until: Date | null
  /** Відкрити модалку VIP (гостя — спершу на реєстрацію). reason — рядок над тарифами. */
  openVip: (reason?: string) => void
}

export const VipContext = createContext<VipState | null>(null)

const fallback: VipState = { isVip: false, until: null, openVip: () => {} }

/** Поза <VipProvider> (напр. /auth) — безкоштовний тариф і порожня дія. */
export function useVip(): VipState {
  return useContext(VipContext) ?? fallback
}
