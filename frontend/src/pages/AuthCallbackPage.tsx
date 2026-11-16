import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { FormError } from '../components/auth/AuthFields'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useAuth } from '../lib/auth-context'
import { safeNext, urlAuthError } from '../lib/auth-errors'

/**
 * Сюди Supabase повертає після підтвердження email і входу через Google.
 * supabase-js сам обробляє токени/код з URL (detectSessionInUrl), AuthProvider
 * чекає на це в getSession — тож нам лишається дочекатися `loading === false`.
 */
export default function AuthCallbackPage() {
  const [params] = useSearchParams()
  const { user, loading } = useAuth()
  // читаємо один раз: після обробки supabase-js чистить URL
  const [urlError] = useState(urlAuthError)
  const next = safeNext(params.get('next'))

  if (!loading && user) return <Navigate to={next} replace />

  return (
    <section className="flex justify-center py-12">
      <Card padding="lg" className="w-full max-w-md text-center">
        {loading ? (
          <div aria-live="polite">
            <Loader2 size={32} className="mx-auto animate-spin text-plum" aria-hidden />
            <h1 className="mt-4 text-3xl">Входимо…</h1>
            <p className="mt-2 text-plum-soft">Зачекай секунду, перевіряємо твій вхід.</p>
          </div>
        ) : (
          <div className="space-y-5 text-left">
            <h1 className="text-center text-3xl">Не вдалося увійти</h1>
            <FormError>{urlError ?? 'Посилання недійсне або застаріло. Спробуй увійти ще раз.'}</FormError>
            <Button to="/auth" className="w-full">
              До входу
            </Button>
          </div>
        )}
      </Card>
    </section>
  )
}
