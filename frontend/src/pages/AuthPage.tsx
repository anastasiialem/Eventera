import { ArrowLeft, MailCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { FormError, PasswordField, SubmitButton, TextField } from '../components/auth/AuthFields'
import { AuthShell } from '../components/auth/AuthShell'
import { useToast } from '../components/ui/toast-context'
import { useAuth } from '../lib/auth-context'
import { authErrorMessage, isEmail, MIN_PASSWORD, PASSWORD_HINT, passwordErrorMessage, safeNext } from '../lib/auth-errors'
import { cn } from '../lib/cn'
import { markVipPending } from '../lib/vip'
import {
  isSupabaseConfigured,
  resendSignupEmail,
  sendPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
} from '../lib/supabase'

const GOOGLE_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE === 'true'
const RESEND_COOLDOWN = 60

type Mode = 'signin' | 'signup'
type View = 'form' | 'check-email' | 'forgot' | 'forgot-sent'

export default function AuthPage() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('mode') === 'signup' ? 'signup' : 'signin'
  const next = safeNext(params.get('next'))
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState<View>('form')
  const [email, setEmail] = useState('')

  // ?vip=1 — прийшли з «Підписатися»: після входу модалка VIP відкриється сама
  const wantsVip = params.get('vip') === '1'
  useEffect(() => {
    if (wantsVip) markVipPending()
  }, [wantsVip])

  // Уже залогінені — одразу далі
  if (!loading && user && view === 'form') return <Navigate to={next} replace />

  const setMode = (m: Mode) => {
    const p = new URLSearchParams(params)
    if (m === 'signup') p.set('mode', 'signup')
    else p.delete('mode')
    setParams(p, { replace: true })
  }

  return (
    <AuthShell>
      {!isSupabaseConfigured && (
        <div className="mb-6">
          <FormError>Вхід тимчасово недоступний: Supabase не налаштовано.</FormError>
        </div>
      )}

      {view === 'form' && (
        <AuthForm
          mode={mode}
          next={next}
          email={email}
          setEmail={setEmail}
          onModeChange={setMode}
          onForgot={() => setView('forgot')}
          onNeedsConfirm={() => setView('check-email')}
          onSignedIn={() => navigate(next, { replace: true })}
        />
      )}
      {view === 'check-email' && <CheckEmail email={email} next={next} onBack={() => setView('form')} />}
      {view === 'forgot' && (
        <ForgotForm email={email} setEmail={setEmail} onSent={() => setView('forgot-sent')} onBack={() => setView('form')} />
      )}
      {view === 'forgot-sent' && <ForgotSent email={email} onBack={() => setView('form')} />}
    </AuthShell>
  )
}

/* ─────────────────────────── Вхід / Реєстрація ─────────────────────────── */

interface AuthFormProps {
  mode: Mode
  next: string
  email: string
  setEmail: (v: string) => void
  onModeChange: (m: Mode) => void
  onForgot: () => void
  onNeedsConfirm: () => void
  onSignedIn: () => void
}

function AuthForm({ mode, next, email, setEmail, onModeChange, onForgot, onNeedsConfirm, onSignedIn }: AuthFormProps) {
  const isSignup = mode === 'signup'
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({})

  const switchMode = (m: Mode) => {
    setError(null)
    setFieldErrors({})
    onModeChange(m)
  }

  const validate = () => {
    const errs: typeof fieldErrors = {}
    if (isSignup && !name.trim()) errs.name = 'Як до тебе звертатись?'
    if (!isEmail(email)) errs.email = 'Введи коректний email, напр. you@gmail.com'
    if (password.length < MIN_PASSWORD) errs.password = `Мінімум ${MIN_PASSWORD} символів`
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!validate()) return
    setBusy(true)
    try {
      if (isSignup) {
        const { data, error: err } = await signUp(email.trim(), password, name, next)
        if (err) throw err
        // Якщо email уже є і підтвердження ввімкнено, Supabase не повертає помилку,
        // а віддає «порожнього» користувача без identities.
        if (data.user && data.user.identities?.length === 0) throw { code: 'user_already_exists' }
        if (data.session) onSignedIn()
        else onNeedsConfirm()
      } else {
        const { error: err } = await signIn(email.trim(), password)
        if (err) throw err
        onSignedIn()
      }
    } catch (err) {
      // Вимоги до пароля від Supabase (weak_password) — під полем пароля, решта — загальною помилкою
      const passwordMsg = isSignup ? passwordErrorMessage(err) : null
      if (passwordMsg) setFieldErrors((f) => ({ ...f, password: passwordMsg }))
      else setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    setGoogleBusy(true)
    const { error: err } = await signInWithGoogle(next).catch((e: unknown) => ({ error: e }))
    // При успіху браузер іде на Google — стан скидаємо лише при помилці
    if (err) {
      setError(authErrorMessage(err))
      setGoogleBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-4xl sm:text-5xl">{isSignup ? 'Створи акаунт' : 'З поверненням'}</h1>
      <p className="mt-3 text-plum-soft">
        {isSignup
          ? 'Збережи свій список «Я чекаю на…» і отримуй сповіщення про нові події.'
          : 'Увійди, щоб побачити свій список «Я чекаю на…».'}
      </p>

      <div role="tablist" aria-label="Вхід або реєстрація" className="mt-7 grid grid-cols-2 gap-1 rounded-full bg-powder-deep p-1">
        {(
          [
            ['signin', 'Вхід'],
            ['signup', 'Реєстрація'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              'h-10 rounded-full text-sm transition',
              mode === m ? 'bg-card font-medium text-ink shadow-soft' : 'text-plum-soft hover:text-plum',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        {isSignup && (
          <TextField
            label="Ім’я"
            name="name"
            autoComplete="given-name"
            placeholder="Як до тебе звертатись"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            disabled={busy}
            maxLength={60}
          />
        )}
        <TextField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          disabled={busy}
        />
        <PasswordField
          label="Пароль"
          name="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          placeholder={isSignup ? 'Придумай пароль' : 'Твій пароль'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint={isSignup ? PASSWORD_HINT : undefined}
          disabled={busy}
          aside={
            !isSignup && (
              <button type="button" onClick={onForgot} className="text-sm text-plum-soft underline-offset-2 hover:text-plum hover:underline">
                Не пам’ятаєш пароль?
              </button>
            )
          }
        />

        {error && <FormError>{error}</FormError>}

        <SubmitButton busy={busy}>
          {busy ? (isSignup ? 'Реєструємо…' : 'Входимо…') : isSignup ? 'Зареєструватися' : 'Увійти'}
        </SubmitButton>
      </form>

      {GOOGLE_ENABLED && (
        <>
          <div className="my-5 flex items-center gap-3 text-sm text-plum-soft">
            <span className="h-px flex-1 bg-line/15" />
            або
            <span className="h-px flex-1 bg-line/15" />
          </div>
          <button
            type="button"
            onClick={google}
            disabled={googleBusy || busy}
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-line/15 bg-card font-medium text-ink shadow-soft transition hover:border-line/30 active:scale-[.98] disabled:opacity-60"
          >
            <GoogleIcon />
            Продовжити з Google
          </button>
        </>
      )}

    </div>
  )
}

/* ─────────────────────────── Перевір пошту ─────────────────────────── */

function CheckEmail({ email, next, onBack }: { email: string; next: string; onBack: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const resend = async () => {
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await resendSignupEmail(email.trim(), next)
      if (err) throw err
      toast('Лист надіслано ще раз', { tone: 'success' })
      setCooldown(RESEND_COOLDOWN)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="text-center" aria-live="polite">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lavender-soft text-plum">
        <MailCheck size={30} />
      </span>
      <h1 className="mt-5 text-4xl">Перевір пошту</h1>
      <p className="mt-3 text-plum-soft">
        Ми надіслали лист на <b className="font-medium text-ink">{email}</b>. Натисни посилання в ньому, щоб підтвердити
        акаунт. Якщо листа немає — зазирни в «Спам».
      </p>
      {error && (
        <div className="mt-5 text-left">
          <FormError>{error}</FormError>
        </div>
      )}
      <button
        type="button"
        onClick={resend}
        disabled={busy || cooldown > 0}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full border border-line/15 bg-card font-medium text-plum shadow-soft transition hover:border-line/30 disabled:opacity-60"
      >
        {busy ? 'Надсилаємо…' : cooldown > 0 ? `Надіслати ще раз (${cooldown} с)` : 'Надіслати ще раз'}
      </button>
      <BackLink onClick={onBack}>Змінити email</BackLink>
    </div>
  )
}

/* ─────────────────────────── Забули пароль ─────────────────────────── */

function ForgotForm({
  email,
  setEmail,
  onSent,
  onBack,
}: {
  email: string
  setEmail: (v: string) => void
  onSent: () => void
  onBack: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!isEmail(email)) {
      setFieldError('Введи коректний email, напр. you@gmail.com')
      return
    }
    setFieldError(undefined)
    setBusy(true)
    try {
      const { error: err } = await sendPasswordReset(email.trim())
      if (err) throw err
      onSent()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-4xl">Не пам’ятаєш пароль?</h1>
      <p className="mt-3 text-plum-soft">Введи email — надішлемо посилання, щоб задати новий пароль.</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
          disabled={busy}
          autoFocus
        />
        {error && <FormError>{error}</FormError>}
        <SubmitButton busy={busy}>{busy ? 'Надсилаємо…' : 'Надіслати посилання'}</SubmitButton>
      </form>
      <BackLink onClick={onBack}>Назад до входу</BackLink>
    </div>
  )
}

function ForgotSent({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="text-center" aria-live="polite">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lavender-soft text-plum">
        <MailCheck size={30} />
      </span>
      <h1 className="mt-5 text-4xl">Перевір пошту</h1>
      <p className="mt-3 text-plum-soft">
        Якщо <b className="font-medium text-ink">{email}</b> зареєстровано, там уже лист із посиланням для нового
        пароля.
      </p>
      <BackLink onClick={onBack}>Назад до входу</BackLink>
    </div>
  )
}

function BackLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mt-5 flex items-center gap-1.5 text-sm text-plum-soft hover:text-plum"
    >
      <ArrowLeft size={16} /> {children}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
