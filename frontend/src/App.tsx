import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PageSkeleton } from './components/ui/Skeleton'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

// Головна — у основному бандлі; решта сторінок вантажиться окремими чанками, коли на них переходять.
// Suspense для сторінок у Layout — навколо <Outlet />.
const EventPage = lazy(() => import('./pages/EventPage'))
const WaitlistPage = lazy(() => import('./pages/WaitlistPage'))
const SupportPage = lazy(() => import('./pages/SupportPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const AuthResetPage = lazy(() => import('./pages/AuthResetPage'))
// Дизайн-система — лише в `npm run dev`; у продакшн-збірку не потрапляє
const StyleguidePage = import.meta.env.DEV ? lazy(() => import('./pages/StyleguidePage')) : null

export default function App() {
  return (
    <Routes>
      {/* /auth — повноекранна розкладка за design/04-auth.png, без хедера/футера */}
      <Route
        path="auth"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <AuthPage />
          </Suspense>
        }
      />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="event/:id" element={<EventPage />} />
        <Route
          path="waitlist"
          element={
            <ProtectedRoute>
              <WaitlistPage />
            </ProtectedRoute>
          }
        />
        <Route path="support" element={<SupportPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route path="auth/reset" element={<AuthResetPage />} />
        {StyleguidePage && <Route path="styleguide" element={<StyleguidePage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
