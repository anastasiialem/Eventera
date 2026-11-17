import { useQuery } from '@tanstack/react-query'
import { Crown, ExternalLink, Heart } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect } from 'react'
import { SupportActions } from '../components/SupportActions'
import { Button } from '../components/ui/Button'
import { DashedRings } from '../components/ui/DashedRings'
import { GelTile } from '../components/ui/GelTile'
import { DonateHeart } from '../components/ui/VibratingIcon'
import { TariffTable } from '../components/vip/TariffTable'
import { getDonateCount, logClick } from '../lib/api'
import { DONATE_NOTE, DONATE_URL } from '../lib/donate'
import { VIP_NOTE, VIP_PRICE } from '../lib/vip'

/** «перехід» / «переходи» / «переходів» */
function transitionsWord(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'перехід'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'переходи'
  return 'переходів'
}

function DonateSection() {
  const { data: count } = useQuery({ queryKey: ['donate-count'], queryFn: getDonateCount, staleTime: 60_000 })

  return (
    <GelTile
      variant="donate"
      className="rounded-[32px] p-6 sm:p-8"
      decor={
        <span className="spin-slow absolute -right-16 -top-16 flex">
          <DashedRings rings={3} size={260} inner={45} className="text-coral-deep/35" />
        </span>
      }
    >
      {/* серце в центрі пунктирних кіл (центр кіл — 66px від правого й верхнього краю) */}
      <span aria-hidden className="pointer-events-none absolute right-[38px] top-[38px]">
        <DonateHeart className="h-14 w-14" />
      </span>
      <section aria-labelledby="donate-title" className="relative space-y-5">
        <p className="flex items-center gap-2 text-sm font-medium text-coral-deep">
          <Heart size={16} className="fill-current" aria-hidden /> Донат
        </p>
        <h2 id="donate-title" className="pr-14 font-display text-3xl leading-tight text-plum-dark sm:pr-16 sm:text-4xl">
          Донат на «Повернись живим»
        </h2>
        <p className="max-w-md text-plum-dark/80">{DONATE_NOTE}.</p>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {DONATE_URL && (
            <div className="w-fit rounded-3xl bg-white p-3 shadow-soft">
              <QRCodeSVG
                value={DONATE_URL}
                size={148}
                fgColor="#2E1B28"
                bgColor="#FFFFFF"
                title="QR-код банки «Повернись живим»"
              />
            </div>
          )}
          <div className="space-y-3">
            {DONATE_URL ? (
              <Button href={DONATE_URL} variant="accent" size="lg" onClick={() => void logClick('donate')}>
                <Heart size={18} className="fill-white/90" aria-hidden /> Перейти на банку <ExternalLink size={16} aria-hidden />
              </Button>
            ) : (
              <p className="text-sm text-plum-dark/70">Посилання на банку скоро з’явиться.</p>
            )}
            {DONATE_URL && <p className="text-xs text-plum-dark/70">Або відскануй QR-код камерою телефона.</p>}
            {count !== undefined && count > 0 && (
              <p className="text-sm text-plum-dark">
                <span className="font-pixel text-3xl font-black leading-none">{count}</span>{' '}
                {transitionsWord(count)} на банку з сайту Eventera
              </p>
            )}
          </div>
        </div>
      </section>
    </GelTile>
  )
}

function VipSection() {
  return (
    <section aria-labelledby="vip-title" className="space-y-5 rounded-[32px] bg-card p-6 shadow-soft sm:p-8">
      <p className="flex items-center gap-2 text-sm font-medium text-plum">
        <Crown size={16} aria-hidden /> Підписка
      </p>
      <h2 id="vip-title" className="font-display text-3xl leading-tight sm:text-4xl">
        VIP-підписка
      </h2>
      <p className="text-plum/80">
        <b className="font-display text-xl font-normal text-ink">{VIP_PRICE} ₴/міс.</b> {VIP_NOTE}. Сповіщення про нові
        події лишаються безкоштовними для всіх.
      </p>
      <TariffTable />
      <SupportActions />
      <p className="text-xs text-plum-soft">
        VIP — на розвиток Eventera. «Задонатити» — окремо, донат на «Повернись живим».
      </p>
    </section>
  )
}

export default function SupportPage() {
  useEffect(() => {
    const prev = document.title
    document.title = 'Підтримати — eventera'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="space-y-8 py-4 sm:py-8">
      <header className="relative pt-6">
        <p aria-hidden className="absolute -left-1 top-0 -rotate-6 font-script text-xl text-coral-deep sm:text-2xl">
          with love
        </p>
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">Підтримати</h1>
        <p className="mt-3 max-w-xl text-plum/80">
          Два різні способи: донат на «Повернись живим» або VIP-підписка, що допомагає розвивати Eventera.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <DonateSection />
        <VipSection />
      </div>
    </div>
  )
}
