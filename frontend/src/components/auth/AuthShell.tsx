import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DashedRings } from '../ui/DashedRings'
import { Logo } from '../ui/Logo'

/**
 * Розкладка /auth за design/04-auth.png: ліворуч декоративна панель
 * «не встиг купити квитки на подію?», праворуч — форма.
 * Фото: якщо покласти public/images/auth/cover.jpg — воно ляже під градієнт.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <aside
        className="relative isolate flex min-h-[15rem] flex-col justify-between overflow-hidden bg-plum-dark p-5 text-white sm:min-h-[18rem] sm:p-8 lg:sticky lg:top-0 lg:h-screen"
        style={{
          backgroundImage: [
            'linear-gradient(180deg, rgb(46 27 40 / .35) 0%, rgb(46 27 40 / .55) 55%, rgb(46 27 40 / .85) 100%)',
            'url(/images/auth/cover.jpg)',
            'radial-gradient(60% 55% at 30% 70%, rgb(232 128 106 / .55), transparent 70%)',
            'radial-gradient(50% 45% at 80% 20%, rgb(201 182 228 / .45), transparent 70%)',
          ].join(', '),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <DashedRings
          rings={4}
          size={520}
          className="absolute -right-40 -top-40 -z-10 text-white/20 sm:-right-24 sm:-top-24"
        />
        <div className="flex items-center justify-between">
          <Logo light />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90 backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeft size={16} /> На головну
          </Link>
        </div>

        <div className="relative mt-8 max-w-xl pb-6 lg:pb-16">
          <p className="font-display text-[2rem] leading-[1.05] sm:text-5xl lg:text-6xl xl:text-7xl">
            не встиг купити квитки на подію?
          </p>
          <p
            aria-hidden
            className="absolute -bottom-2 left-16 -rotate-12 font-script text-lg text-white/90 sm:left-28 sm:text-2xl lg:bottom-4"
          >
            not you anymore!
          </p>
        </div>
      </aside>

      <main className="flex items-start justify-center px-4 py-10 sm:px-6 lg:items-center lg:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
