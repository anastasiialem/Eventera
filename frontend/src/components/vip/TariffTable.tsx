import { Check, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { FREE_LIMIT, VIP_PRICE, VIP_PRICE_LIMITS } from '../../lib/vip'

type Cell = boolean | string

const rows: { label: string; free: Cell; vip: Cell }[] = [
  { label: '«Я чекаю на…»', free: `до ${FREE_LIMIT} артистів`, vip: 'без обмежень' },
  { label: 'Сповіщення в Telegram і на email, щойно з’явилася подія', free: true, vip: true },
  { label: 'Нагадування за день до події', free: false, vip: true },
  { label: `Ліміт ціни для сповіщень (${VIP_PRICE_LIMITS.join(' / ')} ₴)`, free: false, vip: true },
  { label: 'Бейдж VIP біля аватара', free: false, vip: true },
]

function Value({ v }: { v: Cell }): ReactNode {
  if (v === true) return <Check size={18} className="mx-auto text-success" aria-label="так" />
  if (v === false) return <Minus size={18} className="mx-auto text-plum/30" aria-label="ні" />
  return <span className="text-xs font-medium sm:text-sm">{v}</span>
}

/** Табличка тарифів «Безкоштовно / VIP». */
export function TariffTable({ className }: { className?: string }) {
  return (
    <table className={cn('w-full table-fixed border-separate border-spacing-0 text-sm text-plum', className)}>
      <caption className="sr-only">Тарифи Eventera: безкоштовно і VIP</caption>
      <thead>
        <tr>
          <th scope="col" className="w-[46%] pb-2 text-left font-normal text-plum-soft">
            <span className="sr-only">Можливість</span>
          </th>
          <th scope="col" className="pb-2 text-center font-medium">
            Безкоштовно
          </th>
          <th scope="col" className="rounded-t-2xl bg-lavender-soft pb-2 pt-2 text-center font-medium text-plum-dark">
            VIP
            <span className="block font-display text-base leading-tight">{VIP_PRICE} ₴/міс</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.label}>
            <th scope="row" className="border-t border-line/10 py-2.5 pr-2 text-left text-xs font-normal leading-snug sm:text-sm">
              {r.label}
            </th>
            <td className="border-t border-line/10 px-1 py-2.5 text-center">
              <Value v={r.free} />
            </td>
            <td
              className={cn(
                'border-t border-line/10 bg-lavender-soft px-1 py-2.5 text-center text-plum-dark',
                i === rows.length - 1 && 'rounded-b-2xl',
              )}
            >
              <Value v={r.vip} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
