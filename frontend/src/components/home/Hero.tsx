import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { DashedRings } from '../ui/DashedRings'
import { Pill } from '../ui/Pill'
import { HeroSlideshow } from './HeroSlideshow'
import { scrollToAfisha, useHomeFilters } from './use-home-filters'

/** Лівий темний блок головної: фото, заголовок, пошук і швидкі фільтри. */
export function Hero() {
  const { state, update } = useHomeFilters()
  // Поле синхронізується з ?q= при зміні URL (напр. «Скинути фільтри»).
  const [draft, setDraft] = useState(state.q)
  const [syncedQ, setSyncedQ] = useState(state.q)
  if (syncedQ !== state.q) {
    setSyncedQ(state.q)
    setDraft(state.q)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update({ q: draft.trim() || null })
    scrollToAfisha()
  }

  const quick = (patch: Parameters<typeof update>[0]) => {
    update(patch)
    scrollToAfisha()
  }

  return (
    <div className="rounded-[42px] border border-[#EFC3D0] p-1.5">
      <section
        aria-labelledby="hero-title"
        className="relative isolate flex min-h-[500px] flex-col overflow-hidden rounded-[36px] bg-plum-dark px-6 pb-7 pt-20 text-white sm:px-8 sm:pb-9 lg:min-h-[540px] lg:pt-24"
      >
        <HeroSlideshow />

        {/* Пунктирні дуги */}
        <DashedRings rings={2} size={620} inner={78} strokeWidth={1.4} className="absolute -right-[300px] -top-[250px] -z-10 text-white/30" />
        <DashedRings rings={1} size={420} inner={100} strokeWidth={1.2} className="absolute -right-[260px] top-[150px] -z-10 hidden text-white/20 sm:block" />

        <p
          aria-hidden
          className="absolute right-6 top-9 -rotate-[8deg] font-script text-base text-[#F4A893] sm:right-10 sm:top-12 sm:text-xl lg:text-2xl"
        >
          see you tonight, Lviv
        </p>

        <h1
          id="hero-title"
          className="max-w-[15ch] font-display text-[2.6rem] leading-[1.05] text-white [text-shadow:0_2px_24px_rgba(0,0,0,.35)] sm:text-6xl"
        >
          Всі події Львова в одному місці.
        </h1>

        <p className="mt-auto max-w-[34rem] pt-10 text-[15px] leading-relaxed text-white/85 sm:text-base">
          Збираємо афіші з Concert.ua, Karabas, сайтів театрів і закладів. Підпишись на артиста — і дізнаєшся про його
          концерт першим, поки квитки ще є.
        </p>

        <form
          role="search"
          onSubmit={submit}
          className="mt-6 flex max-w-[36rem] items-center gap-1.5 rounded-full bg-black/45 p-1.5 ring-1 ring-white/10 backdrop-blur"
        >
          <label htmlFor="hero-search" className="sr-only">
            Пошук подій
          </label>
          <input
            id="hero-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Артист, вистава або місце…"
            enterKeyHint="search"
            className="h-11 min-w-0 flex-1 rounded-full bg-card px-5 text-sm text-ink placeholder:text-plum-soft/80 focus-visible:ring-offset-0 sm:h-12"
          />
          <Button type="submit" variant="accent" className="h-11 px-3.5 min-[400px]:px-4 sm:h-12 sm:px-6">
            <Search size={16} aria-hidden />
            <span className="max-[399px]:sr-only">Знайти</span>
          </Button>
        </form>

        <div className="-mx-6 mt-4 flex gap-2 overflow-x-auto px-6 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
          <Pill tone="dark" active={state.when === 'today'} onClick={() => quick({ when: state.when === 'today' ? null : 'today' })}>
            Сьогодні
          </Pill>
          <Pill
            tone="dark"
            active={state.when === 'weekend'}
            onClick={() => quick({ when: state.when === 'weekend' ? null : 'weekend' })}
          >
            Ці вихідні
          </Pill>
          <Pill tone="dark" active={state.price === '300'} onClick={() => quick({ price: state.price === '300' ? null : '300' })}>
            До 300 ₴
          </Pill>
          <Pill tone="dark" active={state.price === 'free'} onClick={() => quick({ price: state.price === 'free' ? null : 'free' })}>
            Безкоштовно
          </Pill>
        </div>
      </section>
    </div>
  )
}
