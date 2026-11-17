import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormError, PasswordField, SubmitButton } from '../components/auth/AuthFields'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useToast } from '../components/ui/toast-context'
import { useAuth } from '../lib/auth-context'
import { authErrorMessage, MIN_PASSWORD, PASSWORD_HINT, passwordErrorMessage, urlAuthError } from '../lib/auth-errors'
import { updatePassword } from '../lib/supabase'

/** Сторінка з листа «Скинути пароль»: supabase-js створює тимчасову сесію з URL, тут задаємо новий пароль. */
export default function AuthResetPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [urlError] = useState(urlAuthError)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    const errs: typeof fieldErrors = {}
    if (password.length < MIN_PASSWORD) errs.password = `Мінімум ${MIN_PASSWORD} символів`
    if (confirm !== password) errs.confirm = 'Паролі не збігаються'
    setFieldErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const { error: err } = await updatePassword(password)
      if (err) throw err
      toast('Пароль оновлено', { tone: 'success' })
      navigate('/waitlist', { replace: true })
    } catch (err) {
      // weak_password / same_password — під полем «Новий пароль», решта — загальною помилкою
      const passwordMsg = passwordErrorMessage(err)
      if (passwordMsg) setFieldErrors((f) => ({ ...f, password: passwordMsg }))
      else setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex justify-center py-12">
      <Card padding="lg" className="w-full max-w-md">
        {loading ? (
          <div className="text-center" aria-live="polite">
            <Loader2 size={32} className="mx-auto animate-spin text-plum" aria-hidden />
            <p className="mt-3 text-plum-soft">Перевіряємо посилання…</p>
          </div>
        ) : !user ? (
          <div className="space-y-5">
            <h1 className="text-3xl">Посилання не спрацювало</h1>
            <FormError>{urlError ?? 'Посилання недійсне або застаріло. Запроси нове.'}</FormError>
            <Button to="/auth" className="w-full">
              До входу
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl sm:text-4xl">Новий пароль</h1>
            <p className="mt-2 text-plum-soft">Придумай пароль для {user.email}.</p>
            <form onSubmit={submit} noValidate className="mt-6 space-y-4">
              <PasswordField
                label="Новий пароль"
                autoComplete="new-password"
                placeholder="Придумай пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                hint={PASSWORD_HINT}
                disabled={busy}
                autoFocus
              />
              <PasswordField
                label="Повтори пароль"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={fieldErrors.confirm}
                disabled={busy}
              />
              {error && <FormError>{error}</FormError>}
              <SubmitButton busy={busy}>{busy ? 'Зберігаємо…' : 'Зберегти пароль'}</SubmitButton>
            </form>
          </>
        )}
      </Card>
    </section>
  )
}
