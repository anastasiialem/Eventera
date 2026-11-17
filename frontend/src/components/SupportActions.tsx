import { Crown, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { logClick } from '../lib/api'
import { cn } from '../lib/cn'
import { DONATE_URL } from '../lib/donate'
import { formatVipDate, VIP_PRICE } from '../lib/vip'
import { useVip } from '../lib/vip-context'

const base =
  'inline-flex min-h-[3.25rem] select-none flex-col items-center justify-center rounded-full px-3 py-1.5 text-center font-medium leading-tight transition active:scale-[.97]'

/**
 * «Задонатити» (банка «Повернись живим», ліворуч) і «Підписатися» (VIP 39 ₴/міс → модалка, праворуч).
 * ПРАВИЛО: пара — один раз на сторінці, біля блоку донату (футер не рахується).
 */
export function SupportActions({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
  const { isVip, until, openVip } = useVip()
  const dark = tone === 'dark'

  const subscribeCls = cn(
    base,
    dark ? 'bg-white text-plum-dark hover:bg-lavender-soft' : 'bg-plum text-white hover:bg-plum-dark',
  )
  const donateCls = cn(base, 'bg-coral text-white hover:brightness-95')
  const donateContent = (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Heart size={16} className="fill-white/90" aria-hidden /> Задонатити
    </span>
  )

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      {DONATE_URL ? (
        <a
          href={DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void logClick('donate')}
          className={donateCls}
          aria-label="Задонатити на «Повернись живим» (банка monobank, відкриється в новій вкладці)"
        >
          {donateContent}
        </a>
      ) : (
        <Link to="/support" className={donateCls}>
          {donateContent}
        </Link>
      )}

      <button type="button" onClick={() => openVip()} className={subscribeCls}>
        {isVip && until ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Crown size={15} aria-hidden /> VIP до {formatVipDate(until)}
          </span>
        ) : (
          <>
            <span className="text-sm">Підписатися</span>
            <span className={cn('text-[11px] font-normal', dark ? 'text-plum-soft' : 'text-white/70')}>
              VIP · {VIP_PRICE} ₴/міс
            </span>
          </>
        )}
      </button>
    </div>
  )
}
