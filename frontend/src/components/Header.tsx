import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Heart, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { cn } from '../lib/cn'
import { useAuth } from '../lib/auth-context'
import { Button } from './ui/Button'
import { Logo } from './ui/Logo'

const nav = [
  { to: '/', label: 'Афіша', end: true },
  { to: '/waitlist', label: 'Я чекаю на…' },
  { to: '/support', label: 'Підтримати' },
]

function initial(name: string) {
  return (name.trim()[0] ?? '•').toUpperCase()
}

/** Аватар з першою літерою імені + меню «Мій список» / «Вийти». */
function AccountMenu({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Мій акаунт: ${name}`}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-lavender font-display text-lg text-plum-dark shadow-soft transition hover:brightness-105"
      >
        {initial(name)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            className="absolute right-0 top-[3.25rem] z-50 w-56 rounded-card bg-card p-2 shadow-lift"
          >
            <p className="truncate px-3 pb-2 pt-1 text-sm text-plum-soft">{name}</p>
            <Link
              to="/waitlist"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-plum hover:bg-powder"
            >
              <Heart size={18} /> Мій список
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSignOut()
              }}
              className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-plum hover:bg-powder"
            >
              <LogOut size={18} /> Вийти
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Header() {
  const { user, loading, displayName: name, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const close = () => setOpen(false)
  const handleSignOut = async () => {
    close()
    await signOut()
    navigate('/')
  }

  const authButtons = user ? (
    <AccountMenu name={name} onSignOut={handleSignOut} />
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
                {user ? (
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex items-center gap-3 px-3 py-1 text-plum">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lavender font-display text-plum-dark">
                        {initial(name)}
                      </span>
                      <span className="truncate">{name}</span>
                    </div>
                    <Link to="/waitlist" onClick={close} className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-plum hover:bg-powder">
                      <Heart size={18} /> Мій список
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-plum hover:bg-powder"
                    >
                      <LogOut size={18} /> Вийти
                    </button>
                  </div>
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
