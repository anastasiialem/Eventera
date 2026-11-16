import { Link, NavLink, Outlet } from 'react-router-dom'

const nav = [
  { to: '/', label: 'Афіша', end: true },
  { to: '/waitlist', label: 'Я чекаю на…' },
  { to: '/support', label: 'Підтримати' },
]

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl">
          <span className="inline-block h-6 w-6 rounded-full border border-dashed border-plum/50 p-1">
            <span className="block h-full w-full rounded-full bg-coral" />
          </span>
          eventera
        </Link>
        <nav className="order-3 flex w-full justify-center gap-1 rounded-full bg-card p-1 text-sm shadow-soft sm:order-none sm:w-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 transition-colors ${isActive ? 'bg-plum-dark text-white' : 'hover:bg-powder'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex gap-2 text-sm">
          <Link to="/auth" className="rounded-full border border-plum/20 px-4 py-2">
            Увійти
          </Link>
          <Link to="/auth?mode=signup" className="rounded-full bg-plum px-4 py-2 text-white">
            Реєстрація
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
        <Outlet />
      </main>

      <footer className="mx-auto mb-6 w-[calc(100%-2rem)] max-w-6xl rounded-card bg-plum-dark px-8 py-10 text-white/80">
        <p className="font-display text-3xl text-white">eventera</p>
        <p className="mt-2 max-w-sm text-sm">
          Афіша Львова, яка сама слідкує за твоїми артистами. Зроблено студентками у Львові.
        </p>
      </footer>
    </div>
  )
}
