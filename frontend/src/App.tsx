import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import AuthCallbackPage from './pages/AuthCallbackPage'
import AuthPage from './pages/AuthPage'
import AuthResetPage from './pages/AuthResetPage'
import EventPage from './pages/EventPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import StyleguidePage from './pages/StyleguidePage'
import SupportPage from './pages/SupportPage'
import WaitlistPage from './pages/WaitlistPage'

export default function App() {
  return (
    <Routes>
      {/* /auth — повноекранна розкладка за design/04-auth.png, без хедера/футера */}
      <Route path="auth" element={<AuthPage />} />
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
        {/* ТИМЧАСОВО: перевірка дизайн-системи */}
        <Route path="styleguide" element={<StyleguidePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
