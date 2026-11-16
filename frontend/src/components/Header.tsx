import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { cn } from '../lib/cn'
import { displayNameOf, useSession } from '../lib/useSession'
import { Button } from './ui/Button'
import { Logo } from './ui/Logo'

const nav = [
  { to: '/', label: 'Афіша', end: true },
  { to: '/waitlist', label: 'Я чекаю на…' },
  { to: '/support', label: 'Підтримати' },
]

function Avatar({ name }: { name: string }) {
  return (
    <Link
      to="/waitlist"
      aria-label={`Мій акаунт: ${name}`}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-lavender font-display text-lg text-plum-dark shadow-soft transition hover:brightness-105"
    >
      {(name[0] ?? '•').toUpperCase()}
    </Link>
  )
}

export function Header() {
  const { session, loading } = useSession()
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const name = displayNameOf(session)
  const close = () => setOpen(false)

  const authButtons = session ? (
    <Avatar name={name} />
  ) : (
    <>
      <Button to="/auth" variant="outline" size="sm" onClick={close}>
        Увійти
      </Button>
      <Button to="/auth?mode=signup" variant="primary" size="sm" onClick={close}>
        Реєстрація
      </Button>
    </>
  )

  return (
    <header className="relative z-40 mx-auto w-full max-w-page px-4 pt-4 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <Logo />

        <nav
          aria-label="Головна навігація"
          className="hidden items-center gap-1 rounded-full bg-card p-1 text-sm shadow-soft md:flex"
        >
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-4 py-2 transition-colors',
                  isActive ? 'bg-plum-dark text-white' : 'text-plum hover:bg-powder',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className={cn('hidden min-w-[13rem] items-center justify-end gap-2 md:flex', loading && 'invisible')}>
          {authButtons}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Закрити меню' : 'Відкрити меню'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-plum shadow-soft md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            className="absolute inset-x-4 top-[4.5rem] rounded-card bg-card p-3 shadow-lift md:hidden"
          >
            <nav aria-label="Мобільна навігація" className="flex flex-col">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={close}
                  className={({ isActive }) =>
                    cn('rounded-2xl px-4 py-3 text-base', isActive ? 'bg-plum-dark text-white' : 'text-plum hover:bg-powder')
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            {!loading && (
              <div className="mt-3 flex items-center gap-2 border-t border-line/10 px-1 pt-3 [&>a]:flex-1">
                {session ? (
                  <Link to="/waitlist" onClick={close} className="flex items-center gap-3 px-3 py-1 text-plum">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lavender font-display text-plum-dark">
                      {(name[0] ?? '•').toUpperCase()}
                    </span>
                    {name}
                  </Link>
                ) : (
                  authButtons
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
