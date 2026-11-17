import { useEffect } from 'react'
import { Button } from '../components/ui/Button'
import { DashedRings } from '../components/ui/DashedRings'

export default function NotFoundPage() {
  useEffect(() => {
    const prev = document.title
    document.title = 'Сторінку не знайдено — eventera'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <section className="relative isolate overflow-hidden rounded-card bg-card px-6 py-16 text-center shadow-soft sm:py-24">
      <DashedRings rings={4} size={420} className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 text-plum/15" />
      <p className="font-pixel text-7xl text-plum sm:text-8xl">404</p>
      <h1 className="mt-4 font-display text-3xl sm:text-4xl">Сторінку не знайдено</h1>
      <p className="mx-auto mt-3 max-w-md text-plum/70">
        Можливо, подія вже минула або посилання змінилося. Повернись до афіші — там є що подивитися.
      </p>
      <p aria-hidden className="mt-4 font-script text-coral">don't miss it</p>
      <div className="mt-8 flex justify-center">
        <Button to="/" variant="primary">
          На головну
        </Button>
      </div>
    </section>
  )
}
