import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { Skeleton } from './ui/Skeleton'

/** Сторінка лише для залогінених. Гостей — на реєстрацію з поверненням назад (?next=). */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="space-y-4 py-8" aria-busy="true" aria-label="Завантаження">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!user) {
    const next = location.pathname + location.search
    return <Navigate to={`/auth?mode=signup&next=${encodeURIComponent(next)}`} replace />
  }

  return <>{children}</>
}
