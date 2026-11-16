import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import AuthCallbackPage from './pages/AuthCallbackPage'
import AuthPage from './pages/AuthPage'
import AuthResetPage from './pages/AuthResetPage'
import EventPage from './pages/EventPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import SupportPage from './pages/SupportPage'
import WaitlistPage from './pages/WaitlistPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="event/:id" element={<EventPage />} />
        <Route path="waitlist" element={<WaitlistPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route path="auth/reset" element={<AuthResetPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
