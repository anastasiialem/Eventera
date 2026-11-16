// ТИМЧАСОВА сторінка для візуальної перевірки дизайн-системи. Прибрати маршрут /styleguide перед фінальним демо.
import { ArrowUpRight, Bell, Plus, Search, Share2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { EventCard } from '../components/EventCard'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DashedRings } from '../components/ui/DashedRings'
import { Modal } from '../components/ui/Modal'
import { Pill, Segment } from '../components/ui/Pill'
import { EventCardSkeleton, Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/toast-context'
import { mockEvents } from '../mocks/events'

const swatches = [
  ['powder', '#F5E9EC', 'bg-powder'],
  ['powder-deep', '#EADCE2', 'bg-powder-deep'],
  ['card', '#FFFBFA', 'bg-card'],
  ['plum', '#4A2A3F', 'bg-plum'],
  ['plum-dark', '#2E1B28', 'bg-plum-dark'],
  ['plum-soft', '#7A5C70', 'bg-plum-soft'],
  ['coral', '#E8806A', 'bg-coral'],
  ['coral-soft', '#FBE0DA', 'bg-coral-soft'],
  ['coral-deep', '#C45442', 'bg-coral-deep'],
  ['lavender', '#C9B6E4', 'bg-lavender'],
  ['lavender-soft', '#ECE4F7', 'bg-lavender-soft'],
] as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl sm:text-3xl">{title}</h2>
      {children}
    </section>
  )
}

const categories = ['Усі', 'Концерти', 'Театр', 'Фестивалі'] as const
type Period = 'week' | 'month' | 'season' | 'year'

export default function StyleguidePage() {
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [cat, setCat] = useState<(typeof categories)[number]>('Усі')
  const [period, setPeriod] = useState<Period>('month')
  const [mode, setMode] = useState<'in' | 'up'>('up')
  const [bell, setBell] = useState(true)

  return (
    <div className="space-y-14">
      <header className="space-y-2">
        <p className="font-script text-coral">with love</p>
        <h1 className="text-4xl sm:text-5xl">Styleguide</h1>
        <p className="max-w-xl text-plum-soft">Тимчасова сторінка: усі токени й спільні компоненти Eventera.</p>
      </header>

      <Section title="Палітра">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {swatches.map(([name, hex, cls]) => (
            <div key={name} className="overflow-hidden rounded-2xl bg-card shadow-soft">
              <div className={`h-16 border-b border-line/10 ${cls}`} />
              <div className="p-3 text-xs">
                <p className="font-medium">{name}</p>
                <p className="text-plum-soft">{hex}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Типографіка">
        <Card className="space-y-6">
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-plum-soft">font-display · Prata</p>
            <p className="font-display text-4xl text-ink sm:text-5xl">Всі події Львова в одному місці</p>
            <p className="mt-2 font-display text-xl">
              Жадан і Собаки · <span className="uppercase">листопада</span> · від 450 ₴
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-plum-soft">font-sans · Onest 400 / 500 / 600</p>
            <p>Збираємо афіші з Concert.ua, Karabas, сайтів театрів і закладів.</p>
            <p className="font-medium">Підпишись на артиста — і дізнаєшся про його концерт першим.</p>
            <p className="font-semibold">Вхід вільний</p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-plum-soft">font-pixel · Doto 900 (тільки цифри)</p>
            <p className="flex flex-wrap items-baseline gap-6 font-pixel text-ink">
              <span className="text-7xl leading-none">21</span>
              <span className="text-5xl leading-none">
                47 <span className="text-coral">03</span>
              </span>
              <span className="text-3xl">6</span>
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-plum-soft">font-script · Homemade Apple</p>
            <p className="flex flex-wrap gap-x-8 gap-y-2 font-script text-xl text-coral">
              <span>see you tonight, Lviv</span>
              <span>with love</span>
              <span>don't miss it</span>
            </p>
          </div>
        </Card>
      </Section>

      <Section title="Кнопки">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Квитки</Button>
            <Button variant="accent">
              <Search size={16} /> Знайти
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="outline">Показати ще події</Button>
            <Button variant="soft">
              <Bell size={16} /> Ти чекаєш на цього артиста
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg" variant="accent">
              Купити на Concert.ua <ArrowUpRight size={18} />
            </Button>
            <Button variant="primary">
              <Plus size={16} /> Додати
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              icon
              variant={bell ? 'accent' : 'outline'}
              aria-label="Сповіщення"
              aria-pressed={bell}
              onClick={() => setBell((b) => !b)}
            >
              <Bell size={18} />
            </Button>
            <Button icon variant="outline" aria-label="Поділитися">
              <Share2 size={18} />
            </Button>
            <span className="text-sm text-plum-soft">← icon-кнопки (дзвіночок перемикається)</span>
          </div>
        </Card>
      </Section>

      <Section title="Пілюлі й сегменти">
        <Card className="space-y-5">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {categories.map((c) => (
              <Pill key={c} active={c === cat} onClick={() => setCat(c)}>
                {c}
              </Pill>
            ))}
          </div>
          <Segment<Period>
            label="Період"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: 'Цей тиждень' },
              { value: 'month', label: 'Цей місяць' },
              { value: 'season', label: 'Сезон' },
              { value: 'year', label: 'Рік' },
            ]}
          />
          <div className="max-w-sm">
            <Segment
              stretch
              label="Вхід або реєстрація"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'in', label: 'Вхід' },
                { value: 'up', label: 'Реєстрація' },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2 rounded-2xl bg-plum-dark p-4">
            <Pill tone="dark">Сьогодні</Pill>
            <Pill tone="dark" active>
              Ці вихідні
            </Pill>
            <Pill tone="dark">До 300 ₴</Pill>
            <Pill tone="dark">Безкоштовно</Pill>
          </div>
        </Card>
      </Section>

      <Section title="Бейджі">
        <Card className="flex flex-wrap items-center gap-3">
          <Badge tone="few">Мало квитків</Badge>
          <Badge tone="new">Нове</Badge>
          <Badge tone="neutral">Рок / інді</Badge>
          <span className="rounded-xl bg-plum p-2">
            <Badge tone="category">Концерт</Badge>
          </span>
          <span className="rounded-xl bg-lavender p-2">
            <Badge tone="success">✓ Підключено</Badge>
          </span>
        </Card>
      </Section>

      <Section title="Картки й декор">
        <div className="grid gap-5 md:grid-cols-3">
          <Card hover>
            <p className="text-xs text-plum-soft">Квитки</p>
            <p className="mt-1 font-display text-4xl text-ink">450–1 200 ₴</p>
            <p className="mt-3 text-sm text-plum-soft">Card з hover — підйом на 4px.</p>
          </Card>
          <Card className="relative flex min-h-[200px] items-center justify-center overflow-hidden">
            <DashedRings rings={3} size={200} className="text-plum/40" />
            <span className="absolute h-6 w-6 rounded-full bg-coral" />
          </Card>
          <div className="relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-card bg-plum-dark">
            <DashedRings rings={4} size={260} inner={30} className="absolute -right-16 -top-16 text-white/30" />
            <p className="relative font-script text-lg text-coral">don't miss it</p>
          </div>
        </div>
      </Section>

      <Section title="Скелетони">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <EventCardSkeleton />
          <Card className="space-y-3 sm:col-span-1 lg:col-span-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
        </div>
      </Section>

      <Section title="Modal і Toast">
        <Card className="flex flex-wrap gap-3">
          <Button onClick={() => setModal(true)}>Відкрити Modal</Button>
          <Button variant="outline" onClick={() => toast('Посилання скопійовано')}>
            Toast info
          </Button>
          <Button variant="accent" onClick={() => toast('Додано до «Я чекаю на…»', { tone: 'success' })}>
            Toast success
          </Button>
          <Button variant="ghost" onClick={() => toast('Не вдалося зберегти. Спробуй ще раз', { tone: 'error' })}>
            Toast error
          </Button>
        </Card>
        <Modal open={modal} onClose={() => setModal(false)} title="Як тобі Eventera?">
          <p className="text-plum-soft">Оціни нас від 1 до 5 — це допоможе зробити афішу кращою.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(false)}>
              Скасувати
            </Button>
            <Button
              onClick={() => {
                setModal(false)
                toast('Дякуємо за відгук!', { tone: 'success' })
              }}
            >
              Надіслати
            </Button>
          </div>
        </Modal>
      </Section>

      <Section title="Сітка карток (1 / 2 / 4)">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {mockEvents.slice(0, 4).map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </Section>
    </div>
  )
}
