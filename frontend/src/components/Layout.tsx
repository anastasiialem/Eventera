import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-page flex-1 px-4 pb-16 pt-6 sm:px-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
